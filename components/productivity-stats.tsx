"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"

type ProductivityStatsProps = {
  obligations: ObligationWithDetails[]
}

export function ProductivityStats({ obligations }: ProductivityStatsProps) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // Obrigações concluídas este mês
  const completedThisMonth = obligations.filter((obl) => {
    if (!obl.completedAt) return false
    const completedDate = new Date(obl.completedAt)
    return completedDate >= startOfMonth && completedDate <= endOfMonth
  })

  // Obrigações em andamento
  const inProgress = obligations.filter((obl) => obl.status === "in_progress")

  // Obrigações atrasadas
  const overdue = obligations.filter((obl) => {
    if (obl.status === "completed") return false
    const dueDate = new Date(obl.calculatedDueDate)
    return dueDate < now
  })

  // Taxa de conclusão no prazo (últimos 30 dias)
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const completedLast30Days = obligations.filter((obl) => {
    if (!obl.completedAt) return false
    const completedDate = new Date(obl.completedAt)
    const dueDate = new Date(obl.calculatedDueDate)
    return completedDate >= last30Days && completedDate <= dueDate
  })

  const totalLast30Days = obligations.filter((obl) => {
    const dueDate = new Date(obl.calculatedDueDate)
    return dueDate >= last30Days && dueDate <= now
  })

  const onTimeRate =
    totalLast30Days.length > 0 ? Math.round((completedLast30Days.length / totalLast30Days.length) * 100) : 0

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
    </div>
  )
}
