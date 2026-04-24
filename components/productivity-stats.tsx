"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"

type ProductivityStatsProps = {
  obligations: ObligationWithDetails[]
}

export function ProductivityStats({ obligations }: ProductivityStatsProps) {
  const { completedThisMonth, inProgress, overdue, onTimeRate } = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const completedThisMonth: ObligationWithDetails[] = []
    const inProgress: ObligationWithDetails[] = []
    const overdue: ObligationWithDetails[] = []
    const completedLast30: ObligationWithDetails[] = []
    const totalLast30: ObligationWithDetails[] = []

    // Single pass O(n) em vez de 5 filters separados
    for (const obl of obligations) {
      const due = new Date(obl.calculatedDueDate)
      const completed = obl.completedAt ? new Date(obl.completedAt) : null

      if (completed && completed >= startOfMonth && completed <= endOfMonth) {
        completedThisMonth.push(obl)
      }
      if (obl.status === "in_progress") inProgress.push(obl)
      if (obl.status !== "completed" && due < now) overdue.push(obl)
      if (due >= last30 && due <= now) totalLast30.push(obl)
      if (completed && completed >= last30 && completed <= due) completedLast30.push(obl)
    }

    const rate =
      totalLast30.length > 0 ? Math.round((completedLast30.length / totalLast30.length) * 100) : 0

    return { completedThisMonth, inProgress, overdue, onTimeRate: rate }
  }, [obligations])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Concluídas este Mês</CardTitle>
          <CheckCircle2 className="size-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedThisMonth.length}</div>
          <p className="text-xs text-muted-foreground">Obrigações finalizadas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
          <Clock className="size-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inProgress.length}</div>
          <p className="text-xs text-muted-foreground">Sendo processadas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
          <AlertCircle className="size-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overdue.length}</div>
          <p className="text-xs text-muted-foreground">Requerem atenção</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa no Prazo</CardTitle>
          <TrendingUp className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{onTimeRate}%</div>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
        </CardContent>
      </Card>
      <Card className="md:col-span-2 lg:col-span-4 mt-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Produtividade por Analista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(
              obligations.reduce((acc, obl) => {
                const analyst = obl.assignedTo || "Sem Atribuição"
                if (!acc[analyst]) acc[analyst] = { total: 0, completed: 0 }
                acc[analyst].total++
                if (obl.status === 'completed') acc[analyst].completed++
                return acc
              }, {} as Record<string, { total: number, completed: number }>)
            ).map(([analyst, stats]) => (
              <div key={analyst} className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{analyst}</span>
                  <span className="text-xs text-muted-foreground">{stats.completed} de {stats.total} concluídas</span>
                </div>
                <div className="flex items-center gap-4 w-48">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${Math.round((stats.completed / stats.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">
                    {Math.round((stats.completed / stats.total) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
