import type { Obligation, RecurrenceType } from "./types"

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
