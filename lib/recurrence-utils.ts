import type { Obligation, RecurrenceType } from "./types"
import { adjustForWeekend } from "./date-utils"

/**
 * Calcula a próxima data de vencimento baseada na recorrência
 */
export function calculateNextDueDate(obligation: Obligation, fromDate: Date = new Date()): Date {
  const nextDate = new Date(fromDate)

  switch (obligation.recurrence) {
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + (obligation.recurrenceInterval || 1))
      break
    case "bimonthly":
      nextDate.setMonth(nextDate.getMonth() + 2)
      break
    case "quarterly":
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case "semiannual":
      nextDate.setMonth(nextDate.getMonth() + 6)
      break
    case "annual":
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
    case "custom":
      if (obligation.recurrenceInterval) {
        nextDate.setMonth(nextDate.getMonth() + obligation.recurrenceInterval)
      }
      break
  }

  // Ajusta para o dia correto do mês
  nextDate.setDate(obligation.dueDay)

  // Se tem mês específico, ajusta
  if (obligation.dueMonth) {
    nextDate.setMonth(obligation.dueMonth - 1)
  }

  return nextDate
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
