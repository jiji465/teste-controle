import type { WeekendRule } from "./types"

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6
}

// Fixed Brazilian Holidays (Month is 0-indexed)
const fixedHolidays = [
  { month: 0, day: 1 },   // Confraternização Universal
  { month: 3, day: 21 },  // Tiradentes
  { month: 4, day: 1 },   // Dia do Trabalho
  { month: 8, day: 7 },   // Independência do Brasil
  { month: 9, day: 12 },  // Nossa Senhora Aparecida
  { month: 10, day: 2 },  // Finados
  { month: 10, day: 15 }, // Proclamação da República
  { month: 10, day: 20 }, // Consciência Negra (nacional)
  { month: 11, day: 25 }, // Natal
]

// Simple holiday check (could be expanded with an API or dynamic calculation for Easter/Carnival)
export const isHoliday = (date: Date): boolean => {
  const month = date.getMonth()
  const day = date.getDate()
  return fixedHolidays.some((h) => h.month === month && h.day === day)
}

export const isWeekendOrHoliday = (date: Date): boolean => {
  return isWeekend(date) || isHoliday(date)
}

export const adjustForWeekend = (date: Date, rule: WeekendRule): Date => {
  if (!isWeekendOrHoliday(date)) return date

  const adjusted = new Date(date)

  if (rule === "anticipate") {
    // Move to previous business day
    while (isWeekendOrHoliday(adjusted)) {
      adjusted.setDate(adjusted.getDate() - 1)
    }
  } else if (rule === "postpone") {
    // Move to next business day
    while (isWeekendOrHoliday(adjusted)) {
      adjusted.setDate(adjusted.getDate() + 1)
    }
  }
  // 'keep' doesn't change the date

  return adjusted
}

export const calculateDueDate = (
  dueDay: number,
  dueMonth: number | undefined,
  frequency: string,
  weekendRule: WeekendRule,
  referenceDate: Date = new Date(),
): Date => {
  let dueDate: Date

  if (frequency === "annual" && dueMonth) {
    // Annual obligation with specific month
    dueDate = new Date(referenceDate.getFullYear(), dueMonth - 1, dueDay)
    if (dueDate < referenceDate) {
      dueDate.setFullYear(dueDate.getFullYear() + 1)
    }
  } else if (frequency === "quarterly" && dueMonth) {
    // Quarterly obligation
    dueDate = new Date(referenceDate.getFullYear(), dueMonth - 1, dueDay)
    while (dueDate < referenceDate) {
      dueDate.setMonth(dueDate.getMonth() + 3)
    }
  } else {
    // Monthly or custom
    dueDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), dueDay)
    if (dueDate < referenceDate) {
      dueDate.setMonth(dueDate.getMonth() + 1)
    }
  }

  return adjustForWeekend(dueDate, weekendRule)
}

export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("pt-BR")
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export const isOverdue = (dueDate: string): boolean => {
  return new Date(dueDate) < new Date()
}

export const isUpcomingThisWeek = (dueDate: string): boolean => {
  const due = new Date(dueDate)
  const today = new Date()
  const weekFromNow = new Date()
  weekFromNow.setDate(today.getDate() + 7)
  return due >= today && due <= weekFromNow
}
