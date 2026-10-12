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
import { getLockedPeriods } from "@/features/periods/services"
import {
  getCurrentPeriod,
  generateObligationForPeriod,
  generateTaxForPeriod,
  deterministicAutoId,
} from "./recurrence-engine"
import { recurringPeriods } from "./recurrence-generate"
import { toLocalDateString } from "./date-utils"
import type { Obligation, Tax } from "./types"

// Lock in-memory: evita que duas chamadas do mesmo browser (ex: duas abas
// abertas, ou múltiplos useEffect disparando) entrem na seção crítica ao
// mesmo tempo. Não cobre múltiplos aparelhos — pra esse caso, os ids
// determinísticos em generateObligationForPeriod/generateTaxForPeriod
// garantem idempotência via upsert do Supabase.
let runningPromise: Promise<void> | null = null

/** No máximo quantas competências pra trás o gap-fill recupera de uma vez. */
const MAX_BACKFILL = 24

/**
 * @param force pula a checagem "já rodou hoje". Use depois de marcar uma
 *   obrigação/guia como concluída, pra que a próxima instância apareça
 *   imediatamente em vez de esperar até amanhã.
 */
export async function checkAndGenerateRecurrences(force = false): Promise<void> {
  if (runningPromise) return runningPromise
  runningPromise = checkAndGenerateRecurrencesInner(force).finally(() => {
    runningPromise = null
  })
  return runningPromise
}

/** Competência base de uma série: a competência do item original (não a
 *  data de criação — criar em março a guia de janeiro não pode pular fev). */
function basePeriodOf(item: Pick<Obligation, "competencyMonth" | "createdAt"> & { generatedFor?: string }): string {
  if (item.competencyMonth && /^\d{4}-\d{2}/.test(item.competencyMonth)) return item.competencyMonth.slice(0, 7)
  if (item.generatedFor && /^\d{4}-\d{2}/.test(item.generatedFor)) return item.generatedFor.slice(0, 7)
  return toLocalDateString(new Date(item.createdAt)).slice(0, 7)
}

/**
 * Competências que a série deveria ter até o mês atual (respeitando o passo
 * da periodicidade — trimestral gera a cada 3 meses, não todo mês — e a data
 * final escolhida pelo usuário). Limita o gap-fill às últimas MAX_BACKFILL.
 */
function duePeriodsFor(master: Obligation | Tax, currentPeriod: string): string[] {
  if (!master.recurrence) return []
  const endPeriod = master.recurrenceEndDate ? master.recurrenceEndDate.slice(0, 7) : null
  const until = endPeriod && endPeriod < currentPeriod ? endPeriod : currentPeriod
  const all = recurringPeriods(basePeriodOf(master), master.recurrence, until, master.recurrenceInterval)
  return all.slice(-MAX_BACKFILL)
}

async function checkAndGenerateRecurrencesInner(force: boolean): Promise<void> {
  const now = new Date()
  const currentPeriod = getCurrentPeriod()
  const lastCheck = getLastRecurrenceCheck()

  // Verifica se já rodou hoje (usa data LOCAL pra não shiftar à noite UTC-3).
  // O parâmetro `force` ignora esse cache — usado após marcar item como
  // concluído pra gerar o próximo na hora.
  const today = toLocalDateString(now)
  if (!force && lastCheck === today) {
    return
  }

  // Marca AGORA, antes do trabalho pesado, pra que abas que abram durante a
  // execução não disparem outro run em paralelo. Se algo falhar lá embaixo,
  // o catch deixa rodar de novo (vide bloco abaixo).
  setLastRecurrenceCheck(today)

  try {
    // Competências fechadas não recebem itens novos (o banco recusaria).
    const locked = new Set((await getLockedPeriods()).map((p) => p.period))

    // ─── Obrigações ───────────────────────────────────────────────────────
    const obligations = await getObligations()
    const obligationIds = new Set(obligations.map((o) => o.id))
    const obligationKeys = new Set(
      obligations.map((o) => `${o.clientId}|${o.name}|${o.competencyMonth ?? o.generatedFor ?? ""}`),
    )
    const masters = obligations.filter((o) => o.autoGenerate && !o.parentObligationId)

    for (const master of masters) {
      for (const period of duePeriodsFor(master, currentPeriod)) {
        if (locked.has(period)) continue
        const already =
          obligationIds.has(deterministicAutoId(master.id, period)) ||
          obligations.some((o) => o.parentObligationId === master.id && o.generatedFor === period) ||
          obligationKeys.has(`${master.clientId}|${master.name}|${period}`)
        if (already) continue
        const generated = generateObligationForPeriod(master, period)
        await saveObligation(generated)
        obligationIds.add(generated.id)
        obligationKeys.add(`${master.clientId}|${master.name}|${period}`)
      }
    }

    // ─── Guias ────────────────────────────────────────────────────────────
    // Só clona guias marcadas com autoGenerate=true. Guias criadas via
    // template já vêm com todas as competências pré-geradas
    // (autoGenerate=false). Cópias geradas também recebem autoGenerate=false
    // (vide generateTaxForPeriod), então não há cascata.
    const taxes = await getTaxes()
    const taxIds = new Set(taxes.map((t) => t.id))
    const taxKeys = new Set(taxes.map((t) => `${t.clientId}|${t.name}|${t.competencyMonth ?? ""}`))
    const taxMasters = taxes.filter((t) => t.autoGenerate && t.dueDay !== undefined && t.recurrence)

    for (const tax of taxMasters) {
      for (const period of duePeriodsFor(tax, currentPeriod)) {
        if (locked.has(period)) continue
        const already =
          taxIds.has(deterministicAutoId(tax.id, period)) ||
          taxKeys.has(`${tax.clientId}|${tax.name}|${period}`)
        if (already) continue
        const generated = generateTaxForPeriod(tax, period)
        await saveTax(generated)
        taxIds.add(generated.id)
        taxKeys.add(`${tax.clientId}|${tax.name}|${period}`)
      }
    }

    // Parcelamentos não passam por aqui: são UM registro com contador interno
    // (currentInstallment), avançado por features/installments/actions.ts.
  } catch (error) {
    console.error("Erro ao gerar recorrências:", error)
    // Se algo deu errado, libera pra tentar novamente no próximo carregamento.
    setLastRecurrenceCheck("")
  }
}

/** Roda a verificação ao carregar e a cada 24h. Retorna a função de limpeza
 *  (pro useEffect desmontar o intervalo — antes ele vazava). */
export function initializeAutoRecurrence(): () => void {
  if (typeof window === "undefined") return () => {}
  void checkAndGenerateRecurrences()
  const id = window.setInterval(() => void checkAndGenerateRecurrences(), 24 * 60 * 60 * 1000)
  return () => window.clearInterval(id)
}
