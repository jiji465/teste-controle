"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"

type ProductivityStatsProps = {
  obligations: ObligationWithDetails[]
  /** Rótulo do período filtrado (ex: "Março/2026"). null/undefined => sem filtro */
  periodLabel?: string | null
}

export function ProductivityStats({ obligations, periodLabel }: ProductivityStatsProps) {
  const { completedCount, inProgress, overdue, onTimeRate } = useMemo(() => {
    const now = new Date()

    let completed = 0
    let inProgress = 0
    let overdue = 0
    let completedOnTime = 0
    let totalEvaluable = 0 // obrigações que já venceram OU foram concluídas no período

    for (const obl of obligations) {
      const due = new Date(obl.calculatedDueDate)
      const completedAt = obl.completedAt ? new Date(obl.completedAt) : null

      if (obl.status === "completed") completed++
      if (obl.status === "in_progress") inProgress++
      if (obl.status !== "completed" && due < now) overdue++

      // Taxa no prazo: concluídas até a data de vencimento, sobre todas avaliáveis
      if (completedAt || due < now) {
        totalEvaluable++
        if (completedAt && completedAt <= due) completedOnTime++
      }
    }

    const rate = totalEvaluable > 0 ? Math.round((completedOnTime / totalEvaluable) * 100) : 0
    return { completedCount: completed, inProgress, overdue, onTimeRate: rate }
  }, [obligations])

  const completedLabel = periodLabel ? `Concluídas em ${periodLabel}` : "Concluídas"
  const rateLabel = periodLabel ? "No período" : "Geral"

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <Card className="ring-1 ring-emerald-500/10 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{completedLabel}</CardTitle>
          <CheckCircle2 className="size-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{completedCount}</div>
          <p className="text-xs text-muted-foreground">Obrigações finalizadas</p>
        </CardContent>
      </Card>

      <Card className="ring-1 ring-blue-500/10 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
          <Clock className="size-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{inProgress}</div>
          <p className="text-xs text-muted-foreground">Sendo processadas</p>
        </CardContent>
      </Card>

      <Card
        className={`ring-1 ${overdue > 0 ? "ring-red-500/30 bg-red-50/40 dark:bg-red-950/10" : "ring-red-500/10"} hover:shadow-md transition-shadow`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
          <AlertCircle className="size-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{overdue}</div>
          <p className="text-xs text-muted-foreground">
            {overdue > 0 ? "Requerem atenção" : "Tudo em dia"}
          </p>
        </CardContent>
      </Card>

      <Card className="ring-1 ring-primary/10 hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa no Prazo</CardTitle>
          <TrendingUp className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{onTimeRate}%</div>
          <p className="text-xs text-muted-foreground">{rateLabel}</p>
        </CardContent>
      </Card>
    </div>
  )
}
