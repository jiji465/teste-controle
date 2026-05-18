"use client"

/**
 * ProductivityStats — 4 cards de saúde operacional, considerando os 3 tipos
 * de tarefa (obrigação + guia + parcela) e mostrando comparativo vs período
 * anterior (delta %).
 */

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react"
import type { ObligationWithDetails, Tax, Installment } from "@/lib/types"
import { effectiveStatus } from "@/lib/obligation-status"
import {
  adjustForWeekend,
  buildSafeDate,
  calculateDueDateFromCompetency,
  isOverdue,
} from "@/lib/date-utils"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  /** Itens do período ANTERIOR (mesmo formato) pra calcular delta. */
  previousObligations?: ObligationWithDetails[]
  previousTaxes?: Tax[]
  previousInstallments?: Installment[]
  /** Rótulo do período filtrado (ex: "Março/2026"). null/undefined = sem filtro */
  periodLabel?: string | null
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

type Stats = {
  completed: number
  inProgress: number
  overdue: number
  onTimeRate: number
}

function computeStats(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
): Stats {
  let completed = 0
  let inProgress = 0
  let overdue = 0
  let completedOnTime = 0
  let evaluable = 0

  const tally = (status: string, completedAt: string | undefined, dueDate: Date) => {
    if (status === "completed") completed++
    if (status === "in_progress") inProgress++
    if (status !== "completed" && isOverdue(dueDate)) overdue++
    if (completedAt || isOverdue(dueDate)) {
      evaluable++
      if (completedAt) {
        const cd = startOfDay(new Date(completedAt))
        const dd = startOfDay(dueDate)
        if (cd <= dd) completedOnTime++
      }
    }
  }

  for (const o of obligations) {
    tally(o.status, o.completedAt, new Date(o.calculatedDueDate))
  }
  for (const t of taxes) {
    const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
    if (!d) continue
    tally(t.status, t.completedAt, d)
  }
  for (const i of installments) {
    const firstDue = new Date(i.firstDueDate)
    const monthsToAdd = i.currentInstallment - 1
    const d = adjustForWeekend(
      buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
      i.weekendRule,
    )
    tally(i.status, i.completedAt, d)
  }

  return {
    completed,
    inProgress,
    overdue,
    onTimeRate: evaluable > 0 ? Math.round((completedOnTime / evaluable) * 100) : 0,
  }
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return null // "novo" — sem base de comparação
  return Math.round(((current - previous) / previous) * 100)
}

function DeltaBadge({
  delta,
  inverted = false,
}: {
  delta: number | null
  /** Se true, redução é boa (ex: atrasadas caindo). */
  inverted?: boolean
}) {
  if (delta === null || delta === 0) return null
  const isUp = delta > 0
  const isGood = inverted ? !isUp : isUp
  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-0.5 px-1.5 py-0 h-4 ${
        isGood
          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/40 text-red-700 dark:text-red-300"
      }`}
    >
      {isUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
      {Math.abs(delta)}%
    </Badge>
  )
}

export function ProductivityStats({
  obligations,
  taxes,
  installments,
  previousObligations,
  previousTaxes,
  previousInstallments,
  periodLabel,
}: Props) {
  const current = useMemo(
    () => computeStats(obligations, taxes, installments),
    [obligations, taxes, installments],
  )
  const previous = useMemo(() => {
    if (!previousObligations && !previousTaxes && !previousInstallments) return null
    return computeStats(
      previousObligations ?? [],
      previousTaxes ?? [],
      previousInstallments ?? [],
    )
  }, [previousObligations, previousTaxes, previousInstallments])

  const cards = [
    {
      title: periodLabel ? `Concluídas em ${periodLabel}` : "Concluídas",
      value: current.completed,
      delta: previous ? deltaPct(current.completed, previous.completed) : null,
      inverted: false,
      icon: CheckCircle2,
      color: "text-emerald-600",
      ring: "ring-emerald-500/10",
      sub: "Obrigações + guias + parcelas",
    },
    {
      title: "Em andamento",
      value: current.inProgress,
      delta: previous ? deltaPct(current.inProgress, previous.inProgress) : null,
      inverted: false,
      icon: Clock,
      color: "text-blue-600",
      ring: "ring-blue-500/10",
      sub: "Sendo processadas",
    },
    {
      title: "Atrasadas",
      value: current.overdue,
      delta: previous ? deltaPct(current.overdue, previous.overdue) : null,
      inverted: true,
      icon: AlertCircle,
      color: "text-red-600",
      ring: current.overdue > 0 ? "ring-red-500/30" : "ring-red-500/10",
      sub: current.overdue > 0 ? "Requerem atenção" : "Tudo em dia",
    },
    {
      title: "Taxa no Prazo",
      value: current.onTimeRate,
      suffix: "%",
      delta: previous ? deltaPct(current.onTimeRate, previous.onTimeRate) : null,
      inverted: false,
      icon: TrendingUp,
      color: "text-primary",
      ring: "ring-primary/10",
      sub: previous ? "vs período anterior" : "Geral",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, idx) => {
        const Icon = c.icon
        return (
          <Card key={idx} className={`ring-1 ${c.ring} hover:shadow-md transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              <Icon className={`size-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold tabular-nums">
                  {c.value}
                  {c.suffix ?? ""}
                </div>
                <DeltaBadge delta={c.delta ?? null} inverted={c.inverted} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
