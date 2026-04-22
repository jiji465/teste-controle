"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Clock, Target, Users, BarChart3, AlertCircle, AlertTriangle, Flag } from "lucide-react"
import type { ProductivityMetrics } from "@/lib/types"

type AdvancedMetricsProps = {
  metrics: ProductivityMetrics
}

export function AdvancedMetrics({ metrics }: AdvancedMetricsProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      default:
        return "bg-blue-500"
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="size-4" />
      case "high":
        return <AlertTriangle className="size-4" />
      case "medium":
        return <Flag className="size-4" />
      default:
        return <Flag className="size-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Concluídas</CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCompleted}</div>
            <p className="text-xs text-muted-foreground">Obrigações finalizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageCompletionTime} dias</div>
            <p className="text-xs text-muted-foreground">Para conclusão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Pontualidade</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.onTimeRate}%</div>
            <Progress value={metrics.onTimeRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responsáveis Ativos</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.byResponsible.length}</div>
            <p className="text-xs text-muted-foreground">Membros da equipe</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Produtividade por Responsável
            </CardTitle>
            <CardDescription>Desempenho individual da equipe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.byResponsible.slice(0, 5).map((person) => {
                const onTimeRate = person.completed > 0 ? (person.onTime / person.completed) * 100 : 0
                return (
                  <div key={person.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{person.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{person.completed} concluídas</Badge>
                        <Badge variant={onTimeRate >= 80 ? "default" : "destructive"}>
                          {Math.round(onTimeRate)}% no prazo
                        </Badge>
                      </div>
                    </div>
                    <Progress value={onTimeRate} className="h-2" />
                  </div>
                )
              })}
              {metrics.byResponsible.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum responsável atribuído ainda</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              Distribuição por Prioridade
            </CardTitle>
            <CardDescription>Quantidade de obrigações por nível</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.byPriority.map((item) => {
                const total = metrics.byPriority.reduce((sum, p) => sum + p.count, 0)
                const percentage = total > 0 ? (item.count / total) * 100 : 0
                return (
                  <div key={item.priority} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(item.priority)}
                        <span className="text-sm font-medium capitalize">{item.priority}</span>
                      </div>
                      <Badge variant="outline">{item.count} obrigações</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">{Math.round(percentage)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            Tendência Mensal
          </CardTitle>
          <CardDescription>Últimos 6 meses de atividade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.byMonth.map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">{month.month}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-8 flex items-center overflow-hidden">
                    <div
                      className="bg-green-500 h-full flex items-center justify-center text-xs font-medium text-white"
                      style={{
                        width: `${month.completed > 0 ? (month.completed / (month.completed + month.overdue)) * 100 : 0}%`,
                      }}
                    >
                      {month.completed > 0 && month.completed}
                    </div>
                    <div
                      className="bg-red-500 h-full flex items-center justify-center text-xs font-medium text-white"
                      style={{
                        width: `${month.overdue > 0 ? (month.overdue / (month.completed + month.overdue)) * 100 : 0}%`,
                      }}
                    >
                      {month.overdue > 0 && month.overdue}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {month.completed} ✓
                    </Badge>
                    {month.overdue > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {month.overdue} ✗
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
