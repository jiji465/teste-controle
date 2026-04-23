"use client"

import { useEffect, useState, useMemo } from "react"
import { Navigation } from "@/components/navigation"
import { DashboardStatsCards } from "@/components/dashboard-stats"
import { ProductivityStats } from "@/components/productivity-stats"
import { UpcomingObligations } from "@/components/upcoming-obligations"
import { ClientOverview } from "@/components/client-overview"
import { TaxCalendar } from "@/components/tax-calendar"
import { OperationHub } from "@/components/operation-hub"
import { RegimeDistributionChart } from "@/components/regime-distribution-chart"
import { getObligationsWithDetails, calculateDashboardStats } from "@/lib/dashboard-utils"
import { getCurrentPeriod } from "@/lib/recurrence-engine"
import { TrendingUp, CalendarIcon, AlertCircle, CreditCard, Activity, Lock, Unlock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { adjustForWeekend } from "@/lib/date-utils"
import type { DashboardStats } from "@/lib/types"
import { useData } from "@/contexts/data-context"

export default function DashboardPage() {
  const { clients, taxes, obligations: rawObligations, installments, lockedPeriods, isLoading, refreshData, togglePeriodLock } = useData()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const currentPeriod = useMemo(() => getCurrentPeriod(), [])
  const isPeriodLocked = useMemo(() => lockedPeriods.includes(currentPeriod), [lockedPeriods, currentPeriod])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const obligations = useMemo(() => {
    if (isLoading || !clients.length) return []
    return getObligationsWithDetails(rawObligations, clients, taxes)
  }, [rawObligations, clients, taxes, isLoading])

  useEffect(() => {
    if (!isLoading && clients.length > 0) {
      setStats(calculateDashboardStats(clients, obligations))
    }
  }, [isLoading, clients, obligations])

  const updateData = async () => {
    await refreshData()
  }

  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center flex-1">
          <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>
        </main>
      </div>
    )
  }

  const criticalAlerts = obligations.filter(
    (o) => o.status === "overdue" || (o.status === "pending" && new Date(o.calculatedDueDate) <= new Date()),
  )

  const criticalInstallments = installments.filter((inst) => {
    if (inst.status === "completed") return false
    const firstDue = new Date(inst.firstDueDate)
    const monthsToAdd = inst.currentInstallment - 1
    const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
    const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
    return adjustedDueDate <= new Date()
  })

  const thisWeekObligations = obligations.filter((o) => {
    const dueDate = new Date(o.calculatedDueDate)
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    return dueDate >= today && dueDate <= nextWeek && o.status !== "completed"
  })

  const thisWeekInstallments = installments.filter((inst) => {
    if (inst.status === "completed") return false
    const firstDue = new Date(inst.firstDueDate)
    const monthsToAdd = inst.currentInstallment - 1
    const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
    const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    return adjustedDueDate >= today && adjustedDueDate <= nextWeek
  })

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-balance">Dashboard Fiscal</h1>
            <p className="text-lg text-muted-foreground">Controle completo de obrigações acessórias e impostos</p>
          </div>

          {(criticalAlerts.length > 0 || criticalInstallments.length > 0) && (
            <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="size-5" />
                  Alertas Críticos
                </CardTitle>
                <CardDescription>Itens que requerem atenção imediata</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criticalAlerts.slice(0, 3).map((obl) => (
                    <div key={obl.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                      <div>
                        <p className="font-medium">{obl.name}</p>
                        <p className="text-sm text-muted-foreground">{obl.client.name}</p>
                      </div>
                      <Badge className="bg-red-600">{obl.status === "overdue" ? "Atrasada" : "Vence hoje"}</Badge>
                    </div>
                  ))}
                  {criticalInstallments.slice(0, 2).map((inst) => {
                    const client = clients.find((c) => c.id === inst.clientId)
                    return (
                      <div key={inst.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                        <div className="flex items-center gap-2">
                          <CreditCard className="size-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{inst.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {client?.name} - Parcela {inst.currentInstallment}/{inst.installmentCount}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-red-600">Vencida</Badge>
                      </div>
                    )
                  })}
                  {criticalAlerts.length + criticalInstallments.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      +{criticalAlerts.length + criticalInstallments.length - 5} alertas adicionais
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="animate-in">
            {stats && <DashboardStatsCards stats={stats} />}
          </div>

          <RegimeDistributionChart obligations={obligations} clients={clients} />

          {(thisWeekObligations.length > 0 || thisWeekInstallments.length > 0) && (
            <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <CalendarIcon className="size-5" />
                  Vencendo nos Próximos 7 Dias
                </CardTitle>
                <CardDescription>
                  {thisWeekObligations.length + thisWeekInstallments.length} itens requerem atenção
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {thisWeekObligations.slice(0, 4).map((obl) => (
                    <div key={obl.id} className="p-3 bg-background rounded-lg border">
                      <p className="font-medium text-sm">{obl.name}</p>
                      <p className="text-xs text-muted-foreground">{obl.client.name}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Vence: {new Date(obl.calculatedDueDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  ))}
                  {thisWeekInstallments.slice(0, 2).map((inst) => {
                    const client = clients.find((c) => c.id === inst.clientId)
                    const firstDue = new Date(inst.firstDueDate)
                    const monthsToAdd = inst.currentInstallment - 1
                    const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
                    const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
                    return (
                      <div key={inst.id} className="p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-1">
                          <CreditCard className="size-3" />
                          <p className="font-medium text-sm">{inst.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {client?.name} - {inst.currentInstallment}/{inst.installmentCount}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Vence: {adjustedDueDate.toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="size-6 text-primary" />
              Central de Operações
              {isPeriodLocked && <Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-2"><Lock className="size-3 mr-1" /> Bloqueado</Badge>}
            </h2>
            <OperationHub obligations={obligations} onUpdate={updateData} currentPeriod={currentPeriod} />
          </div>

          <TaxCalendar taxes={taxes} />

          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="size-6" />
              Indicadores de Produtividade
            </h2>
            <ProductivityStats obligations={obligations} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <UpcomingObligations obligations={obligations} />
            <ClientOverview clients={clients} obligations={obligations} />
          </div>
        </div>
      </main>
    </div>
  )
}
