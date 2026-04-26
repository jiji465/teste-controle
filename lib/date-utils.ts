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

// Algoritmo de Meeus/Jones/Butcher para domingo de Páscoa (Gregoriano).
// Retorna Date local (meia-noite) do domingo de Páscoa do ano informado.
const calculateEaster = (year: number): Date => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

const easterCache = new Map<number, Date>()
const getEaster = (year: number): Date => {
  const cached = easterCache.get(year)
  if (cached) return cached
  const computed = calculateEaster(year)
  easterCache.set(year, computed)
  return computed
}

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const sameYmd = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const isHoliday = (date: Date): boolean => {
  const month = date.getMonth()
  const day = date.getDate()
  if (fixedHolidays.some((h) => h.month === month && h.day === day)) return true

  const easter = getEaster(date.getFullYear())
  // Feriados móveis nacionais derivados da Páscoa
  if (sameYmd(date, addDays(easter, -48))) return true // Segunda de Carnaval
  if (sameYmd(date, addDays(easter, -47))) return true // Terça de Carnaval
  if (sameYmd(date, addDays(easter, -2))) return true  // Sexta-feira Santa
  if (sameYmd(date, addDays(easter, 60))) return true  // Corpus Christi
  return false
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

/**
 * Constrói uma Date "segura": se o dia pedido não existir no mês (ex: 31 em
 * fevereiro), usa o último dia válido do mês em vez de fazer overflow para o
 * mês seguinte (que é o comportamento padrão do construtor de Date).
 */
export const buildSafeDate = (year: number, monthZeroBased: number, day: number): Date => {
  const lastDayOfMonth = new Date(year, monthZeroBased + 1, 0).getDate()
  return new Date(year, monthZeroBased, Math.min(day, lastDayOfMonth))
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
    dueDate = buildSafeDate(referenceDate.getFullYear(), dueMonth - 1, dueDay)
    if (dueDate < referenceDate) {
      dueDate = buildSafeDate(dueDate.getFullYear() + 1, dueMonth - 1, dueDay)
    }
  } else if (frequency === "quarterly" && dueMonth) {
    // Quarterly obligation
    dueDate = buildSafeDate(referenceDate.getFullYear(), dueMonth - 1, dueDay)
    while (dueDate < referenceDate) {
      const next = new Date(dueDate.getFullYear(), dueDate.getMonth() + 3, 1)
      dueDate = buildSafeDate(next.getFullYear(), next.getMonth(), dueDay)
    }
  } else {
    // Monthly or custom
    dueDate = buildSafeDate(referenceDate.getFullYear(), referenceDate.getMonth(), dueDay)
    if (dueDate < referenceDate) {
      const next = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1)
      dueDate = buildSafeDate(next.getFullYear(), next.getMonth(), dueDay)
    }
  }

  return adjustForWeekend(dueDate, weekendRule)
}

/**
 * Calcula a data de vencimento a partir da competência.
 * Pattern brasileiro: vencimento no mês SEGUINTE ao da competência.
 * Ex: competência "2026-01", dueDay 20 → vencimento 20/02/2026
 */
export const calculateDueDateFromCompetency = (
  competencyMonth: string | undefined,
  dueDay: number | undefined,
  weekendRule: WeekendRule = "postpone",
): Date | null => {
  if (!competencyMonth || !dueDay) return null
  const match = competencyMonth.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const monthIdx = Number(match[2]) - 1 // 0-based
  const nextMonthYear = monthIdx === 11 ? year + 1 : year
  const nextMonthIdx = monthIdx === 11 ? 0 : monthIdx + 1
  const dueDate = buildSafeDate(nextMonthYear, nextMonthIdx, dueDay)
  return adjustForWeekend(dueDate, weekendRule)
}

export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("pt-BR")
}

/**
 * Formata Date como "YYYY-MM-DD" no fuso LOCAL (não UTC).
 * Use isso em vez de `date.toISOString().split("T")[0]` quando precisa
 * representar "qual dia do calendário do usuário", pois toISOString
 * shifta o dia em horários da noite no Brasil (UTC-3).
 */
export const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

/**
 * Parse "YYYY-MM-DD" como meia-noite LOCAL (não UTC). Necessário pra não
 * shiftar o dia em fuso UTC-3 (Brasil), onde `new Date("2026-04-25")` é
 * 21h do dia 24 no horário local.
 */
const parseLocalDate = (input: string | Date): Date => {
  if (input instanceof Date) return input
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(input)
}

export const isOverdue = (dueDate: string | Date): boolean => {
  const due = parseLocalDate(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export const isUpcomingThisWeek = (dueDate: string | Date): boolean => {
  const due = parseLocalDate(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekFromNow = new Date(today)
  weekFromNow.setDate(today.getDate() + 7)
  return due >= today && due <= weekFromNow
}
