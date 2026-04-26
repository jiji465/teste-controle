"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

  const [period, setPeriod] = useState<string | null>(() => periodFromUrl ?? currentMonthPeriod())

  // Sincroniza estado com URL imediatamente sempre que a URL muda
  useEffect(() => {
    setPeriod(periodFromUrl ?? currentMonthPeriod())
  }, [periodFromUrl])

  const showAll = period === "all"

  const periodLabel = useMemo(() => {
    if (!period || showAll) return null
    const [y, m] = period.split("-").map(Number)
    if (!y || !m) return null
    return `${MONTH_NAMES[m - 1]}/${y}`
  }, [period, showAll])

  const isInPeriod = useCallback(
    (date: string | Date | null | undefined): boolean => {
      if (showAll) return true
      if (!period) return true
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
