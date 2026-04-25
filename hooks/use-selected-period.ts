"use client"

import { useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Lê o período (mês-ano) selecionado no PeriodSwitcher do topo (`?period=YYYY-MM`)
 * e expõe utilitários para filtrar itens por vencimento.
 *
 * Comportamento:
 *  - Sem `period` na URL → tudo passa (sem filtro).
 *  - Item com data válida → passa se a data cai no mês/ano selecionado.
 *  - Item SEM data → passa sempre (não filtra).
 */
export function useSelectedPeriod() {
  const searchParams = useSearchParams()
  const period = searchParams.get("period") // formato "YYYY-MM" ou null

  const periodLabel = useMemo(() => {
    if (!period) return null
    const [y, m] = period.split("-").map(Number)
    if (!y || !m) return null
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ]
    return `${monthNames[m - 1]}/${y}`
  }, [period])

  const isInPeriod = useCallback(
    (date: string | Date | null | undefined): boolean => {
      if (!period) return true
      if (!date) return true
      const d = typeof date === "string" ? new Date(date) : date
      if (Number.isNaN(d.getTime())) return true
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return yearMonth === period
    },
    [period],
  )

  return { period, periodLabel, isInPeriod, isFiltering: !!period }
}
