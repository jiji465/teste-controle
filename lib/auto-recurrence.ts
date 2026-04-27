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

export async function checkAndGenerateRecurrences(): Promise<void> {
  const now = new Date()
  const currentPeriod = getCurrentPeriod()
  const lastCheck = getLastRecurrenceCheck()

  // Verifica se já rodou hoje (usa data LOCAL pra não shiftar à noite UTC-3)
  const today = toLocalDateString(now)
  if (lastCheck === today) {
    return
  }

  // Verifica se é o primeiro dia do mês
  if (!shouldGenerateRecurrence(now)) {
    return
  }

  try {
    const { calculateNextDueDate } = await import("./recurrence-utils")
    
    // Gerar obrigações recorrentes
    const obligations = await getObligations()
    const obligationsToGenerate = obligations.filter(
      (o) => o.autoGenerate && !o.parentObligationId, // Apenas obrigações originais
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

    // Gerar impostos recorrentes (com cap por recurrenceEndDate)
    const taxes = await getTaxes()
    const [curYear, curMonth] = currentPeriod.split("-").map(Number)
    const currentPeriodStart = buildSafeDate(curYear, curMonth - 1, 1)
    const taxesToGenerate = taxes.filter((t) => {
      if (t.dueDay === undefined) return false
      if (t.recurrenceEndDate && new Date(t.recurrenceEndDate) < currentPeriodStart) return false
      return true
    })

    for (const tax of taxesToGenerate) {
      const alreadyGenerated = taxes.some((t) => t.name === tax.name && t.createdAt.startsWith(currentPeriod))
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

    setLastRecurrenceCheck(today)
  } catch (error) {
    console.error("Erro ao gerar recorrências:", error)
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
