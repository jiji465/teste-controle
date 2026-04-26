"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

/** Retorna o mês corrente como "YYYY-MM" (ex: "2026-04"). */
function currentMonthPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

type PeriodContextValue = {
  /** Período atual: "YYYY-MM" ou "all" */
  period: string
  /** Atualiza para novo período */
  setPeriod: (p: string) => void
  /** Volta para o mês atual */
  resetToCurrent: () => void
  /** Mostra todos (sem filtro) */
  showAllPeriods: () => void
  /** Label legível, ex: "Abril/2026". Null quando "all" */
  periodLabel: string | null
  /** Se true, está filtrando por um mês específico */
  isFiltering: boolean
  /** Se true, "all" — não filtra nada */
  showAll: boolean
  /** Se true, é o mês atual real (não passado/futuro) */
  isCurrentMonth: boolean
  /** Verifica se uma data cai no período selecionado */
  isInPeriod: (date: string | Date | null | undefined) => boolean
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  // Estado React puro: sempre começa no mês atual quando o app carrega.
  // Sem URL, sem localStorage — reseta a cada (re)load.
  const [period, setPeriodState] = useState<string>(currentMonthPeriod())

  const setPeriod = useCallback((p: string) => {
    setPeriodState(p)
  }, [])

  const resetToCurrent = useCallback(() => {
    setPeriodState(currentMonthPeriod())
  }, [])

  const showAllPeriods = useCallback(() => {
    setPeriodState("all")
  }, [])

  const showAll = period === "all"
  const today = currentMonthPeriod()
  const isCurrentMonth = period === today

  const periodLabel = useMemo(() => {
    if (showAll) return null
    const m = period.match(/^(\d{4})-(\d{2})$/)
    if (!m) return null
    const y = Number(m[1])
    const mn = Number(m[2])
    if (!y || !mn) return null
    return `${MONTH_NAMES[mn - 1]}/${y}`
  }, [period, showAll])

  const isInPeriod = useCallback(
    (date: string | Date | null | undefined): boolean => {
      if (showAll) return true
      if (!date) return true
      const d = typeof date === "string" ? new Date(date) : date
      if (Number.isNaN(d.getTime())) return true
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return yearMonth === period
    },
    [period, showAll],
  )

  const value: PeriodContextValue = {
    period,
    setPeriod,
    resetToCurrent,
    showAllPeriods,
    periodLabel,
    isFiltering: !showAll,
    showAll,
    isCurrentMonth,
    isInPeriod,
  }

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function useSelectedPeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error("useSelectedPeriod must be used within PeriodProvider")
  return ctx
}
