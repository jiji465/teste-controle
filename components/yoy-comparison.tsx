"use client"

/**
 * YoYComparison — comparativo do mesmo período no ano anterior.
 *
 * Mostra: total concluído neste período vs mesmo período ano passado,
 * com seta de delta % e mini-bar visual.
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { ObligationWithDetails, Tax, Installment } from "@/lib/types"
import { effectiveStatus } from "@/lib/obligation-status"
import { yoyRange, dateInRange, type DateRange } from "@/lib/date-range"
import { adjustForWeekend, buildSafeDate, calculateDueDateFromCompetency } from "@/lib/date-utils"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  range: DateRange
}

function countCompletedInRange(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  range: DateRange,
): number {
  let n = 0
  for (const o of obligations) {
    if (effectiveStatus(o) !== "completed") continue
    if (dateInRange(o.calculatedDueDate, range)) n++
  }
  for (const t of taxes) {
    const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
    if (!d) continue
    if (effectiveStatus({ status: t.status, calculatedDueDate: d }) !== "completed") continue
    if (dateInRange(d, range)) n++
  }
  for (const i of installments) {
    const firstDue = new Date(i.firstDueDate)
    const monthsToAdd = i.currentInstallment - 1
    const d = adjustForWeekend(
      buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
      i.weekendRule,
    )
    if (effectiveStatus({ status: i.status, calculatedDueDate: d }) !== "completed") continue
    if (dateInRange(d, range)) n++
  }
  return n
}

export function YoYComparison({ obligations, taxes, installments, range }: Props) {
  // Se range é nulo (ex: filtro "Todos os períodos"), assume ano atual
  // completo vs ano anterior completo. Antes mostrava card vazio — métrica
  // inútil exatamente quando o usuário quer ver o panorama anual.
  const effectiveRange = useMemo<DateRange>(() => {
    if (range.from && range.to) return range
    const today = new Date()
    const year = today.getFullYear()
    return {
      from: new Date(year, 0, 1).toISOString().slice(0, 10),
      to: new Date(year, 11, 31).toISOString().slice(0, 10),
    }
  }, [range])

  const isFullYearMode = !range.from || !range.to

  const { current, previous, delta, deltaPct } = useMemo(() => {
    const current = countCompletedInRange(obligations, taxes, installments, effectiveRange)
    const prevRange = yoyRange(effectiveRange)
    const previous = prevRange
      ? countCompletedInRange(obligations, taxes, installments, prevRange)
      : 0
    const delta = current - previous
    const deltaPct = previous === 0 ? null : Math.round((delta / previous) * 100)
    return { current, previous, delta, deltaPct }
  }, [obligations, taxes, installments, effectiveRange])

  const isUp = delta > 0
  const isDown = delta < 0
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus
  const trendColor = isUp ? "text-emerald-600" : isDown ? "text-red-600" : "text-muted-foreground"
  const maxValue = Math.max(current, previous, 1)
  const currentPct = (current / maxValue) * 100
  const previousPct = (previous / maxValue) * 100

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Comparativo Anual</CardTitle>
        <CardDescription className="text-xs">
          {isFullYearMode
            ? `${new Date().getFullYear()} inteiro vs ${new Date().getFullYear() - 1}`
            : "Mesmo período no ano anterior"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold tabular-nums">{current}</p>
          {deltaPct !== null && (
            <Badge variant="outline" className={`gap-1 ${trendColor} border-current/30`}>
              <Icon className="size-3" />
              {Math.abs(deltaPct)}%
            </Badge>
          )}
          {deltaPct === null && previous === 0 && current > 0 && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">novo</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Concluídos neste período</p>

        {/* Mini barras comparativas */}
        <div className="space-y-1.5 mt-4">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">Atual</span>
              <span className="font-medium tabular-nums">{current}</span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${currentPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">Ano anterior</span>
              <span className="font-medium tabular-nums">{previous}</span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-muted-foreground/40 rounded-full transition-all"
                style={{ width: `${previousPct}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
