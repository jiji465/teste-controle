import type { Obligation, Tax, Installment, RecurrenceType } from "./types"
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

export function generateObligationForPeriod(
  obligation: Obligation,
  period: string, // formato: "2025-01"
): Obligation {
  const [year, month] = period.split("-").map(Number)
  const dueDate = buildSafeDate(year, month - 1, obligation.dueDay)
  const adjustedDueDate = adjustForWeekend(dueDate, obligation.weekendRule)

  return {
    ...obligation,
    id: crypto.randomUUID(),
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
    parentObligationId: obligation.id,
    generatedFor: period,
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
  const [year, month] = period.split("-").map(Number)

  return {
    ...tax,
    id: crypto.randomUUID(),
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
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

export function generateInstallmentForPeriod(
  installment: Installment,
  period: string, // formato: "2025-01"
): Installment {
  const [year, month] = period.split("-").map(Number)
  const dueDate = buildSafeDate(year, month - 1, installment.dueDay)
  const adjustedDueDate = adjustForWeekend(dueDate, installment.weekendRule)

  // Incrementa a parcela atual
  const nextInstallment = installment.currentInstallment + 1

  return {
    ...installment,
    id: crypto.randomUUID(),
    currentInstallment: nextInstallment,
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
    createdAt: new Date().toISOString(),
    history: [
      {
        id: crypto.randomUUID(),
        action: "created",
        description: `Parcela ${nextInstallment}/${installment.installmentCount} gerada automaticamente para ${period}`,
        timestamp: new Date().toISOString(),
        user: "Sistema",
      },
    ],
  }
}

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
