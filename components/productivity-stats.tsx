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
import { computeProductivityStats } from "@/lib/dashboard-utils"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  /** Parcelas do período (PeriodInstallment: data/conclusão DA PARCELA). */
  installments: Array<Installment & { calculatedDueDate?: string }>
  /** Itens do período ANTERIOR (mesmo formato) pra calcular delta. */
  previousObligations?: ObligationWithDetails[]
  previousTaxes?: Tax[]
  previousInstallments?: Array<Installment & { calculatedDueDate?: string }>
  /** Rótulo do período filtrado (ex: "Março/2026"). null/undefined = sem filtro */
  periodLabel?: string | null
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
        isGood ? "border-success/40 text-success" : "border-destructive/40 text-destructive"
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
    () => computeProductivityStats(obligations, taxes, installments),
    [obligations, taxes, installments],
  )
  const previous = useMemo(() => {
    if (!previousObligations && !previousTaxes && !previousInstallments) return null
    return computeProductivityStats(
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
      color: "text-success",
      highlight: false,
      sub: "Obrigações + guias + parcelas",
    },
    {
      title: "Em andamento",
      value: current.inProgress,
      delta: previous ? deltaPct(current.inProgress, previous.inProgress) : null,
      inverted: false,
      icon: Clock,
      color: "text-info",
      highlight: false,
      sub: "Sendo processadas",
    },
    {
      title: "Atrasadas",
      value: current.overdue,
      delta: previous ? deltaPct(current.overdue, previous.overdue) : null,
      inverted: true,
      icon: AlertCircle,
      color: "text-destructive",
      highlight: current.overdue > 0,
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
      highlight: false,
      sub: previous ? "vs período anterior" : "Geral",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, idx) => {
        const Icon = c.icon
        return (
          <Card
            key={idx}
            className={`transition-colors hover:border-primary/30 ${c.highlight ? "border-destructive/40" : ""}`}
          >
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
