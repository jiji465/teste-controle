import {
  getLastRecurrenceCheck,
  setLastRecurrenceCheck,
} from "./storage"
import {
  getObligations,
  getTaxes,
  saveObligation,
  saveTax,
} from "./supabase/database"
import {
  shouldGenerateRecurrence,
  getCurrentPeriod,
  generateObligationForPeriod,
  generateTaxForPeriod,
} from "./recurrence-engine"
import { buildSafeDate, toLocalDateString } from "./date-utils"

// Lock in-memory: evita que duas chamadas do mesmo browser (ex: duas abas
// abertas, ou múltiplos useEffect disparando) entrem na seção crítica ao
// mesmo tempo. Não cobre múltiplos aparelhos — pra esse caso, os ids
// determinísticos em generateObligationForPeriod/generateTaxForPeriod
// garantem idempotência via upsert do Supabase.
let runningPromise: Promise<void> | null = null

export async function checkAndGenerateRecurrences(): Promise<void> {
  if (runningPromise) return runningPromise
  runningPromise = checkAndGenerateRecurrencesInner().finally(() => {
    runningPromise = null
  })
  return runningPromise
}

async function checkAndGenerateRecurrencesInner(): Promise<void> {
  const now = new Date()
  const currentPeriod = getCurrentPeriod()
  const lastCheck = getLastRecurrenceCheck()

  // Verifica se já rodou hoje (usa data LOCAL pra não shiftar à noite UTC-3)
  const today = toLocalDateString(now)
  if (lastCheck === today) {
    return
  }

  // Marca AGORA, antes do trabalho pesado, pra que abas que abram durante a
  // execução não disparem outro run em paralelo. Se algo falhar lá embaixo,
  // o catch deixa rodar de novo (vide bloco abaixo).
  setLastRecurrenceCheck(today)

  // Verifica se é o primeiro dia do mês
  if (!shouldGenerateRecurrence(now)) {
    return
  }

  try {
    const { calculateNextDueDate } = await import("./recurrence-utils")
    
    // Gerar obrigações recorrentes
    const obligations = await getObligations()
    const obligationsToGenerate = obligations.filter(
      (o) =>
        o.autoGenerate &&
        !o.parentObligationId && // Apenas obrigações originais (não clones)
        !o.id.startsWith("auto-"), // Backstop: id determinístico marca clones
    )

    // Cap de segurança: nunca gera mais que 12 meses adiante do mês atual,
    // mesmo que recurrenceEndDate seja distante. Evita explodir o banco com
    // obrigações futuras que ainda nem foram revisadas.
    const MAX_MONTHS_AHEAD = 12
    const horizon = new Date(now.getFullYear(), now.getMonth() + MAX_MONTHS_AHEAD, 1)

    for (const obligation of obligationsToGenerate) {
      // Cap explícito definido pelo usuário no formulário
      const userEndDate = obligation.recurrenceEndDate
        ? new Date(obligation.recurrenceEndDate)
        : null

      // Find all generated instances for this obligation
      const instances = obligations.filter((o) => o.parentObligationId === obligation.id || o.id === obligation.id)

      // Find the latest due date among all instances
      let latestInstance = instances[0]
      let latestDueDate = new Date(0)

      for (const inst of instances) {
        const period = inst.generatedFor || `${new Date(inst.createdAt).getFullYear()}-${String(new Date(inst.createdAt).getMonth() + 1).padStart(2, "0")}`
        const [year, month] = period.split("-").map(Number)
        const dueDate = buildSafeDate(year, month - 1, inst.dueDay || 1)
        if (dueDate > latestDueDate) {
          latestDueDate = dueDate
          latestInstance = inst
        }
      }

      const nextDate = calculateNextDueDate(obligation, latestDueDate)

      // Para de gerar se passou do cap do usuário ou do cap de segurança
      if (userEndDate && nextDate > userEndDate) continue
      if (nextDate > horizon) continue

      const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`

      if (nextPeriod <= currentPeriod) {
        // Verify it doesn't already exist
        const alreadyGenerated = obligations.some(
          (o) => o.parentObligationId === obligation.id && o.generatedFor === nextPeriod,
        )

        if (!alreadyGenerated) {
          const newObligation = generateObligationForPeriod(obligation, nextPeriod)
          await saveObligation(newObligation)
        }
      }
    }

    // Gerar impostos recorrentes — só clona guias explicitamente marcadas
    // com autoGenerate=true. Guias criadas via template já vêm com todas as
    // competências do range pré-geradas (autoGenerate=false), então não
    // precisam passar por aqui. Sem esse filtro, o motor clonava TODA guia
    // todo mês, gerando duplicatas em massa.
    const taxes = await getTaxes()
    const [curYear, curMonth] = currentPeriod.split("-").map(Number)
    const currentPeriodStart = buildSafeDate(curYear, curMonth - 1, 1)
    const taxesToGenerate = taxes.filter((t) => {
      if (!t.autoGenerate) return false
      if (t.dueDay === undefined) return false
      // Guias anuais têm regra própria (dueMonth fixo) — geração mensal não se aplica.
      if (!t.recurrence || t.recurrence === "annual") return false
      if (t.recurrenceEndDate && new Date(t.recurrenceEndDate) < currentPeriodStart) return false
      // Cópias já geradas pelo motor têm prefixo "auto-" no id; nunca devem
      // virar candidatas (senão geram clones em cascata).
      if (t.id.startsWith("auto-")) return false
      return true
    })

    for (const tax of taxesToGenerate) {
      // Dedup duplo: por (clientId + name + competencyMonth=período) ou
      // pelo id determinístico que generateTaxForPeriod usa. Qualquer um
      // que case → já existe.
      const expectedId = `auto-${tax.id}-${currentPeriod}`
      const alreadyGenerated = taxes.some(
        (t) =>
          t.id === expectedId ||
          (t.clientId === tax.clientId && t.name === tax.name && t.competencyMonth === currentPeriod),
      )
      if (!alreadyGenerated) {
        const newTax = generateTaxForPeriod(tax, currentPeriod)
        await saveTax(newTax)
      }
    }

    // NOTA: A geração automática de PARCELAMENTOS foi removida intencionalmente.
    //
    // No modelo atual, um parcelamento é UM ÚNICO registro com contador interno
    // (currentInstallment / installmentCount). A próxima data de vencimento é
    // calculada dinamicamente como `firstDueDate + (currentInstallment - 1) meses`.
    // Quando o usuário marca a parcela atual como paga (via payCurrentInstallment),
    // o contador avança e a próxima parcela "aparece" automaticamente — sem precisar
    // duplicar registros no banco.
    //
    // O código antigo aqui clonava o registro com currentInstallment+1 todo dia 1
    // do mês, gerando duplicatas infinitas. Bug corrigido.

  } catch (error) {
    console.error("Erro ao gerar recorrências:", error)
    // Se algo deu errado, libera pra tentar novamente no próximo carregamento.
    setLastRecurrenceCheck("")
  }
}

// Hook para executar a verificação quando o app carrega
export function initializeAutoRecurrence(): void {
  if (typeof window !== "undefined") {
    // Executa imediatamente
    checkAndGenerateRecurrences()

    // Configura verificação diária (a cada 24 horas)
    setInterval(checkAndGenerateRecurrences, 24 * 60 * 60 * 1000)
  }
}
