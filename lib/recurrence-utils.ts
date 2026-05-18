import type { Obligation, RecurrenceType } from "./types"
import { adjustForWeekend, buildSafeDate } from "./date-utils"

/**
 * Calcula a próxima data de vencimento baseada na recorrência.
 *
 * - Mensal/bimestral/.../anual: avança o mês/ano com base em fromDate
 * - "custom": usa recurrenceInterval (em meses)
 * - Anual com dueMonth (DEFIS=3, DASN-SIMEI=5): sobrescreve o mês final
 * - Usa buildSafeDate pra clampar dueDay ao último dia do mês quando o mês
 *   não tem aquele dia (ex: dia 31 em fev vira 28/29, não estoura pra março)
 */
export function calculateNextDueDate(obligation: Obligation, fromDate: Date = new Date()): Date {
  // Calcula o (ano, mês) destino sem mexer no dia ainda — vamos clampar
  // no final via buildSafeDate.
  let year = fromDate.getFullYear()
  let monthIdx = fromDate.getMonth() // 0-based

  switch (obligation.recurrence) {
    case "monthly":
      monthIdx += obligation.recurrenceInterval || 1
      break
    case "bimonthly":
      monthIdx += 2
      break
    case "quarterly":
      monthIdx += 3
      break
    case "semiannual":
      monthIdx += 6
      break
    case "annual":
      year += 1
      break
    case "custom":
      if (obligation.recurrenceInterval) {
        monthIdx += obligation.recurrenceInterval
      }
      break
  }

  // Anual com mês fixo (ex: DEFIS = março, DASN-SIMEI = maio). Só faz
  // sentido pra recorrência ANUAL — pra outras, ignora pra não travar
  // todo mês na mesma data.
  if (obligation.recurrence === "annual" && obligation.dueMonth) {
    monthIdx = obligation.dueMonth - 1 // dueMonth é 1-based, monthIdx 0-based
  }

  // buildSafeDate normaliza overflow: setDate(31) em fev iria pra 3/mar;
  // buildSafeDate clampa pra 28/29.
  return buildSafeDate(year, monthIdx, obligation.dueDay)
}

/**
 * Gera próximas ocorrências de uma obrigação recorrente
 */
export function generateNextOccurrences(obligation: Obligation, monthsAhead = 3): Omit<Obligation, "id">[] {
  if (!obligation.autoGenerate) return []

  const occurrences: Omit<Obligation, "id">[] = []
  let currentDate = new Date()
  const endDate = obligation.recurrenceEndDate ? new Date(obligation.recurrenceEndDate) : null

  for (let i = 0; i < monthsAhead; i++) {
    const nextDate = calculateNextDueDate(obligation, currentDate)

    // Verifica se passou da data final
    if (endDate && nextDate > endDate) break

    const adjustedDate = adjustForWeekend(nextDate, obligation.weekendRule)
    const periodKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`

    occurrences.push({
      ...obligation,
      status: "pending",
      completedAt: undefined,
      completedBy: undefined,
      realizationDate: undefined,
      parentObligationId: obligation.id,
      generatedFor: periodKey,
      createdAt: new Date().toISOString(),
      history: [
        {
          id: crypto.randomUUID(),
          action: "created",
          description: `Obrigação gerada automaticamente para ${periodKey}`,
          timestamp: new Date().toISOString(),
        },
      ],
    })

    currentDate = nextDate
  }

  return occurrences
}

/**
 * Verifica se uma obrigação deve gerar novas ocorrências
 */
export function shouldGenerateOccurrences(obligation: Obligation): boolean {
  if (!obligation.autoGenerate) return false

  const endDate = obligation.recurrenceEndDate ? new Date(obligation.recurrenceEndDate) : null
  if (endDate && new Date() > endDate) return false

  return true
}

/**
 * Obtém descrição legível da recorrência
 */
export function getRecurrenceDescription(obligation: Obligation): string {
  const descriptions: Record<RecurrenceType, string> = {
    monthly: "Mensal",
    bimonthly: "Bimestral",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
    custom: obligation.recurrenceInterval
      ? `A cada ${obligation.recurrenceInterval} ${obligation.recurrenceInterval === 1 ? "mês" : "meses"}`
      : "Personalizado",
  }

  return descriptions[obligation.recurrence]
}
