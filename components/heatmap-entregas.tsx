"use client"

/**
 * HeatmapEntregas — calendário mensal "tipo GitHub" mostrando quantos itens
 * foram CONCLUÍDOS em cada dia (obrigações, guias, parcelas e serviços).
 * Quanto mais escuro o verde, mais entregas naquele dia.
 *
 * Diferente do HeatmapVencimentos (que olha datas de vencimento, em vermelho),
 * este olha a data REAL de entrega — é o "quanto produzi por dia".
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarCheck } from "lucide-react"
import type { ObligationWithDetails, Tax, Installment, Service } from "@/lib/types"
import { completionsByDay } from "@/lib/dashboard-utils"

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"]

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  services?: Service[]
  /** "YYYY-MM" — se vazio, usa mês corrente */
  monthKey?: string
}

function colorForCount(count: number, max: number): { bg: string; text: string } {
  if (count === 0) return { bg: "bg-muted/30", text: "text-muted-foreground" }
  const ratio = count / Math.max(1, max)
  if (ratio < 0.25) return { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-800 dark:text-emerald-200" }
  if (ratio < 0.5) return { bg: "bg-emerald-200 dark:bg-emerald-900/60", text: "text-emerald-900 dark:text-emerald-100" }
  if (ratio < 0.75) return { bg: "bg-emerald-400 dark:bg-emerald-700/70", text: "text-emerald-950 dark:text-emerald-50" }
  return { bg: "bg-emerald-600 dark:bg-emerald-500/80", text: "text-white" }
}

export function HeatmapEntregas({ obligations, taxes, installments, services, monthKey }: Props) {
  const { year, month0, label, counts, max, total, peakDay, diasAtivos } = useMemo(() => {
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
    const counts = completionsByDay(obligations, taxes, installments, year, month0, services)
    const daysInMonth = new Date(year, month0 + 1, 0).getDate()
    const usable = counts.slice(0, daysInMonth)
    const max = Math.max(...usable, 1)
    const total = usable.reduce((a, b) => a + b, 0)
    const peakIdx = usable.indexOf(Math.max(...usable))
    const peakDay = Math.max(...usable) > 0 ? peakIdx + 1 : null
    const diasAtivos = usable.filter((n) => n > 0).length
    return { year, month0, label: `${MONTH_NAMES[month0]}/${year}`, counts, max, total, peakDay, diasAtivos }
  }, [obligations, taxes, installments, services, monthKey])

  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const firstWeekday = new Date(year, month0, 1).getDay()

  const cells: Array<{ day: number; count: number } | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, count: counts[d - 1] })
  while (cells.length % 7 !== 0) cells.push(null)

  const media = diasAtivos > 0 ? Math.round((total / diasAtivos) * 10) / 10 : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          Entregas por dia — {label}
        </CardTitle>
        <CardDescription className="text-xs">
          {total === 0 ? (
            "Nenhuma entrega registrada neste mês ainda."
          ) : (
            <>
              <span className="font-medium text-foreground">{total}</span> entrega{total !== 1 ? "s" : ""} no mês
              {peakDay && max > 1 && (
                <>
                  {" · "}
                  <span className="font-medium">Recorde no dia {peakDay} ({max})</span>
                </>
              )}
              {media > 0 && (
                <>
                  {" · "}
                  <span>Média {media}/dia ativo</span>
                </>
              )}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho da semana */}
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {WEEKDAY_LABELS.map((wd, i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
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
                className={`aspect-square rounded-md ${color.bg} ${color.text} flex flex-col items-center justify-center`}
                title={
                  cell.count === 0
                    ? `Dia ${cell.day}: nenhuma entrega`
                    : `Dia ${cell.day}: ${cell.count} entrega${cell.count !== 1 ? "s" : ""}`
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
            <div className="size-3 rounded bg-emerald-100 dark:bg-emerald-950/40" />
            <div className="size-3 rounded bg-emerald-200 dark:bg-emerald-900/60" />
            <div className="size-3 rounded bg-emerald-400 dark:bg-emerald-700/70" />
            <div className="size-3 rounded bg-emerald-600 dark:bg-emerald-500/80" />
            <span>Mais</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
