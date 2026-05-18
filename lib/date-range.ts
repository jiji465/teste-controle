/**
 * Helpers de date range pra filtros mais flexíveis (substitui o select
 * fechado "este mês / mês passado / trimestre / ano" por algo livre).
 */
import { buildSafeDate, toLocalDateString } from "./date-utils"

export type DateRange = {
  /** ISO "YYYY-MM-DD" — null = sem limite inferior */
  from: string | null
  /** ISO "YYYY-MM-DD" — null = sem limite superior */
  to: string | null
}

export type DateRangePreset =
  | "today"
  | "last7"
  | "last30"
  | "last60"
  | "last90"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisYear"
  | "lastYear"
  | "all"
  | "custom"

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Hoje",
  last7: "Últimos 7 dias",
  last30: "Últimos 30 dias",
  last60: "Últimos 60 dias",
  last90: "Últimos 90 dias",
  thisMonth: "Este mês",
  lastMonth: "Mês passado",
  thisQuarter: "Este trimestre",
  thisYear: "Este ano",
  lastYear: "Ano passado",
  all: "Todos os períodos",
  custom: "Período personalizado",
}

/** Resolve um preset numa janela concreta {from, to}. */
export function rangeFromPreset(preset: DateRangePreset, ref: Date = new Date()): DateRange {
  if (preset === "all" || preset === "custom") return { from: null, to: null }

  const today = startOfDay(ref)

  if (preset === "today") {
    const iso = toLocalDateString(today)
    return { from: iso, to: iso }
  }

  if (preset === "last7" || preset === "last30" || preset === "last60" || preset === "last90") {
    const days = preset === "last7" ? 7 : preset === "last30" ? 30 : preset === "last60" ? 60 : 90
    const from = new Date(today)
    from.setDate(today.getDate() - days + 1) // inclui hoje
    return { from: toLocalDateString(from), to: toLocalDateString(today) }
  }

  if (preset === "thisMonth") {
    const from = buildSafeDate(today.getFullYear(), today.getMonth(), 1)
    const to = buildSafeDate(today.getFullYear(), today.getMonth() + 1, 0) // último dia
    return { from: toLocalDateString(from), to: toLocalDateString(to) }
  }

  if (preset === "lastMonth") {
    const from = buildSafeDate(today.getFullYear(), today.getMonth() - 1, 1)
    const to = buildSafeDate(today.getFullYear(), today.getMonth(), 0)
    return { from: toLocalDateString(from), to: toLocalDateString(to) }
  }

  if (preset === "thisQuarter") {
    const q = Math.floor(today.getMonth() / 3)
    const from = buildSafeDate(today.getFullYear(), q * 3, 1)
    const to = buildSafeDate(today.getFullYear(), q * 3 + 3, 0)
    return { from: toLocalDateString(from), to: toLocalDateString(to) }
  }

  if (preset === "thisYear") {
    const from = buildSafeDate(today.getFullYear(), 0, 1)
    const to = buildSafeDate(today.getFullYear(), 11, 31)
    return { from: toLocalDateString(from), to: toLocalDateString(to) }
  }

  if (preset === "lastYear") {
    const from = buildSafeDate(today.getFullYear() - 1, 0, 1)
    const to = buildSafeDate(today.getFullYear() - 1, 11, 31)
    return { from: toLocalDateString(from), to: toLocalDateString(to) }
  }

  return { from: null, to: null }
}

/** Verifica se uma data cai dentro do range (inclusive). */
export function dateInRange(date: Date | string | null | undefined, range: DateRange): boolean {
  if (!date) return true
  if (!range.from && !range.to) return true
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return true
  const iso = toLocalDateString(d)
  if (range.from && iso < range.from) return false
  if (range.to && iso > range.to) return false
  return true
}

/** Mesmo range "espelhado" no período anterior — útil pra comparativos
 *  (ex: "comparado aos últimos 30 dias do período imediatamente anterior"). */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) return null
  const from = new Date(range.from)
  const to = new Date(range.to)
  const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const prevTo = new Date(from)
  prevTo.setDate(from.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevTo.getDate() - days + 1)
  return { from: toLocalDateString(prevFrom), to: toLocalDateString(prevTo) }
}

/** Range YoY (mesmo período do ano anterior). Ex: from=2026-03-01,to=2026-03-31
 *  → 2025-03-01 a 2025-03-31. */
export function yoyRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) return null
  const shift = (iso: string) => {
    const d = new Date(iso)
    d.setFullYear(d.getFullYear() - 1)
    return toLocalDateString(d)
  }
  return { from: shift(range.from), to: shift(range.to) }
}

/** Label legível pra um DateRange. */
export function formatRange(range: DateRange): string {
  if (!range.from && !range.to) return "Todos os períodos"
  if (range.from === range.to && range.from) {
    return new Date(range.from).toLocaleDateString("pt-BR")
  }
  const f = range.from ? new Date(range.from).toLocaleDateString("pt-BR") : "início"
  const t = range.to ? new Date(range.to).toLocaleDateString("pt-BR") : "hoje"
  return `${f} → ${t}`
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}
