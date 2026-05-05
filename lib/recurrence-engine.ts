import type { Obligation, Tax, RecurrenceType } from "./types"
import { adjustForWeekend, buildSafeDate } from "./date-utils"

export function shouldGenerateRecurrence(date: Date): boolean {
  // Always check for missing recurrences when the engine runs.
  // The system checks if it was already generated in the current period anyway.
  return true
}

export function getNextDueDate(
  currentDate: Date,
  dueDay: number,
  recurrence: RecurrenceType,
  recurrenceInterval?: number,
  weekendRule?: "postpone" | "anticipate" | "keep",
): Date {
  const next = new Date(currentDate)

  switch (recurrence) {
    case "monthly":
      next.setMonth(next.getMonth() + 1)
      break
    case "bimonthly":
      next.setMonth(next.getMonth() + 2)
      break
    case "quarterly":
      next.setMonth(next.getMonth() + 3)
      break
    case "semiannual":
      next.setMonth(next.getMonth() + 6)
      break
    case "annual":
      next.setFullYear(next.getFullYear() + 1)
      break
    case "custom":
      next.setMonth(next.getMonth() + (recurrenceInterval || 1))
      break
  }

  next.setDate(dueDay)

  if (weekendRule) {
    return adjustForWeekend(next, weekendRule)
  }

  return next
}

/** Prefixo determinístico pra IDs de itens gerados pelo motor de recorrência.
 *  Usar `auto-${originalId}-${period}` faz o save virar idempotente:
 *  duas execuções concorrentes (multi-tab/multi-aparelho) salvam com o
 *  MESMO id e o upsert do Supabase deduplica naturalmente, em vez de
 *  criar dois registros com UUIDs diferentes. */
function deterministicAutoId(originalId: string, period: string): string {
  return `auto-${originalId}-${period}`
}

export function generateObligationForPeriod(
  obligation: Obligation,
  period: string, // formato: "2025-01"
): Obligation {
  return {
    ...obligation,
    id: deterministicAutoId(obligation.id, period),
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
    parentObligationId: obligation.id,
    generatedFor: period,
    competencyMonth: period,
    createdAt: new Date().toISOString(),
    history: [
      {
        id: crypto.randomUUID(),
        action: "created",
        description: `Obrigação gerada automaticamente para ${period}`,
        timestamp: new Date().toISOString(),
        user: "Sistema",
      },
    ],
  }
}

export function generateTaxForPeriod(
  tax: Tax,
  period: string, // formato: "2025-01"
): Tax {
  return {
    ...tax,
    id: deterministicAutoId(tax.id, period),
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
    competencyMonth: period,
    createdAt: new Date().toISOString(),
    history: [
      {
        id: crypto.randomUUID(),
        action: "created",
        description: `Imposto gerado automaticamente para ${period}`,
        timestamp: new Date().toISOString(),
        user: "Sistema",
      },
    ],
  }
}

// generateInstallmentForPeriod removida: parcelamentos são UM registro
// único com contador interno (currentInstallment), avançado pelo helper
// payCurrentInstallment em features/installments/actions.ts. Não precisa
// gerar registros mensais.

export function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function getNextPeriod(currentPeriod: string): string {
  const [year, month] = currentPeriod.split("-").map(Number)
  const date = new Date(year, month - 1, 1)
  date.setMonth(date.getMonth() + 1)
  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0")
  return `${nextYear}-${nextMonth}`
}
