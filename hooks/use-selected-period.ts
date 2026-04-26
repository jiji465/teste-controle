"use client"

import { useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

/** Retorna o mês corrente como "YYYY-MM" (ex: "2026-04"). */
function currentMonthPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Lê o período (mês-ano) selecionado no PeriodSwitcher do topo.
 *
 * Comportamento:
 *  - URL sem `?period=` → assume o **mês atual** (filtro implícito)
 *  - URL com `?period=YYYY-MM` → usa esse período
 *  - `?period=all` → mostra todos os meses (sem filtro)
 *  - Item com data válida → passa se a data cai no mês selecionado
 *  - Item SEM data → passa sempre (não filtra)
 */
export function useSelectedPeriod() {
  const searchParams = useSearchParams()
  const periodFromUrl = searchParams.get("period") // "YYYY-MM", "all" ou null

  // Cálculo direto sem useState — searchParams já é reativo no Next.js client
  const period = periodFromUrl ?? currentMonthPeriod()
  const showAll = period === "all"

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

  return { period, periodLabel, isInPeriod, isFiltering: !showAll, showAll }
}
