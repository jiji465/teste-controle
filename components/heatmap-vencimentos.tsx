"use client"

/**
 * HeatmapVencimentos — calendário compacto do mês selecionado mostrando
 * a quantidade de vencimentos em cada dia. Cores em gradiente do branco
 * ao vermelho conforme densidade.
 *
 * Ajuda o contador a planejar carga de trabalho — vê os "picos" do mês.
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarHeart } from "lucide-react"
import type { ObligationWithDetails, Tax, Installment } from "@/lib/types"
import { heatmapByDay } from "@/lib/dashboard-utils"

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"]

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  /** "YYYY-MM" — se vazio, usa mês corrente */
  monthKey?: string
}

function colorForCount(count: number, max: number): { bg: string; text: string } {
  if (count === 0) return { bg: "bg-muted/30", text: "text-muted-foreground" }
  const ratio = count / Math.max(1, max)
  if (ratio < 0.25) return { bg: "bg-blue-100 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300" }
  if (ratio < 0.5) return { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-200" }
  if (ratio < 0.75) return { bg: "bg-orange-200 dark:bg-orange-950/50", text: "text-orange-800 dark:text-orange-200" }
  return { bg: "bg-red-300 dark:bg-red-950/70", text: "text-red-900 dark:text-red-100" }
}

export function HeatmapVencimentos({ obligations, taxes, installments, monthKey }: Props) {
  const { year, month0, label, counts, max, total, peakDay } = useMemo(() => {
    let year: number
    let month0: number
    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
      const [y, m] = monthKey.split("-").map(Number)
      year = y
      month0 = m - 1
    } else {
      const now = new Date()
      year = now.getFullYear()
      month0 = now.getMonth()
    }
    const counts = heatmapByDay(obligations, taxes, installments, year, month0)
    const daysInMonth = new Date(year, month0 + 1, 0).getDate()
    const usable = counts.slice(0, daysInMonth)
    const max = Math.max(...usable, 1)
    const total = usable.reduce((a, b) => a + b, 0)
    const peakIdx = usable.indexOf(max)
    const peakDay = max > 0 ? peakIdx + 1 : null
    return {
      year,
      month0,
      label: `${MONTH_NAMES[month0]}/${year}`,
      counts,
      max,
      total,
      peakDay,
    }
  }, [obligations, taxes, installments, monthKey])

  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const firstWeekday = new Date(year, month0, 1).getDay() // 0=domingo

  // Monta uma grade 7 colunas (D..S) com placeholders nos espaços antes do dia 1
  const cells: Array<{ day: number | null; count: number } | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, count: counts[d - 1] })
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarHeart className="size-4 text-primary" />
          Picos de Vencimento — {label}
        </CardTitle>
        <CardDescription className="text-xs">
          {total} vencimento{total !== 1 ? "s" : ""} no mês
          {peakDay && max > 1 && (
            <>
              {" · "}
              <span className="font-medium">Pico no dia {peakDay} ({max} itens)</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho da semana */}
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {WEEKDAY_LABELS.map((wd, i) => (
            <div
              key={i}
              className="text-center text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Grade do mês */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} aria-hidden />
            const color = colorForCount(cell.count, max)
            return (
              <div
                key={i}
                className={`aspect-square rounded-md ${color.bg} ${color.text} flex flex-col items-center justify-center text-[10px] font-medium`}
                title={
                  cell.count === 0
                    ? `Dia ${cell.day}: sem vencimentos`
                    : `Dia ${cell.day}: ${cell.count} vencimento${cell.count !== 1 ? "s" : ""}`
                }
              >
                <span className="text-[11px] tabular-nums leading-tight">{cell.day}</span>
                {cell.count > 0 && (
                  <span className="text-[9px] font-bold tabular-nums leading-none">{cell.count}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Legenda */}
        {max > 0 && (
          <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground">
            <span>Menos</span>
            <div className="size-3 rounded bg-blue-100 dark:bg-blue-950/30" />
            <div className="size-3 rounded bg-amber-100 dark:bg-amber-950/40" />
            <div className="size-3 rounded bg-orange-200 dark:bg-orange-950/50" />
            <div className="size-3 rounded bg-red-300 dark:bg-red-950/70" />
            <span>Mais</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
