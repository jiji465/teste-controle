"use client"

import { useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { DashboardStatsCards } from "@/components/dashboard-stats"
import { ProductivityStats } from "@/components/productivity-stats"
import { UpcomingObligations } from "@/components/upcoming-obligations"
import { ClientOverview } from "@/components/client-overview"
import { RecentActivity } from "@/components/recent-activity"
import { UpcomingTaxes } from "@/components/upcoming-taxes"

const RegimeDistributionChart = dynamic(
  () => import("@/components/regime-distribution-chart").then((m) => m.RegimeDistributionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] animate-pulse rounded-lg border bg-muted/30" aria-hidden />
    ),
  },
)
import { calculateDashboardStats } from "@/lib/dashboard-utils"
import { calculateDueDateFromCompetency } from "@/lib/date-utils"
import { isCriticalNow } from "@/lib/obligation-status"
import { getCurrentPeriod } from "@/lib/recurrence-engine"
import { getGreetingMeta } from "@/lib/weather"
import { WeatherGreeting } from "@/components/weather-greeting"
import { TrendingUp, CalendarIcon, AlertCircle, CreditCard, BarChart3, ListChecks, Activity } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { adjustForWeekend, buildSafeDate } from "@/lib/date-utils"
import { saveObligation } from "@/features/obligations/services"
import type { DashboardStats, ObligationWithDetails } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

// getGreeting() foi movido pra lib/weather.ts (getGreetingMeta) — agora retorna
// também gradient + accent dinâmicos por horário (manhã/tarde/entardecer/noite).

export default function DashboardPage() {
  const { clients, taxes, obligations: rawObligations, obligationsWithDetails, installments, lockedPeriods, isLoading, refreshData, togglePeriodLock } = useData()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const searchParams = useSearchParams()

  const completeObligation = async (obl: ObligationWithDetails, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    const now = new Date().toISOString()
    await saveObligation({
      ...obl,
      status: "completed",
      completedAt: now,
      completedBy: "Contador",
      history: [
        ...(obl.history || []),
        { id: crypto.randomUUID(), action: "completed", description: "Concluída pelo Dashboard", timestamp: now },
      ],
    })
    toast.success(`${obl.name} concluída`)
    await refreshData()
  }

  const completeAllOverdue = (overdueList: ObligationWithDetails[]) => {
    if (overdueList.length === 0) return
    setConfirmState({
      title: `Concluir ${overdueList.length} obrigações atrasadas`,
      description: "Marca todas como concluídas hoje. Útil para fechar pendências em lote no fim do dia.",
      confirmLabel: "Concluir todas",
      onConfirm: async () => {
        const now = new Date().toISOString()
        await Promise.all(
          overdueList.map((obl) =>
            saveObligation({
              ...obl,
              status: "completed",
              completedAt: now,
              completedBy: "Contador",
              history: [
                ...(obl.history || []),
                { id: crypto.randomUUID(), action: "completed", description: "Conclusão em lote pelo Dashboard", timestamp: now },
              ],
            }),
          ),
        )
        toast.success(`${overdueList.length} obrigações concluídas`)
        await refreshData()
      },
    })
  }

  // Período corrente do contexto, com fallback para o mês atual real
  const { period, isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()
  const currentPeriod = period === "all" || !/^\d{4}-\d{2}$/.test(period) ? getCurrentPeriod() : period
  const isPeriodLocked = useMemo(() => lockedPeriods.includes(currentPeriod), [lockedPeriods, currentPeriod])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const obligations = useMemo(() => {
    if (isLoading || !clients.length) return []
    return obligationsWithDetails.filter((o) => isInPeriod(o.calculatedDueDate))
  }, [obligationsWithDetails, clients.length, isLoading, isInPeriod])

  // Taxes filtradas pelo período selecionado (mesma lógica de obrigações)
  const filteredTaxes = useMemo(() => {
    if (isLoading) return []
    return taxes.filter((t) => {
      const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      return date ? isInPeriod(date) : true
    })
  }, [taxes, isLoading, isInPeriod])

  // Contagem total de taxes/obligations fora do filtro pra mostrar contexto quando vazio
  const totalsOutsidePeriod = useMemo(() => {
    if (!isFiltering) return { taxes: 0, obligations: 0 }
    return {
      taxes: taxes.filter((t) => t.status !== "completed").length - filteredTaxes.filter((t) => t.status !== "completed").length,
      obligations: rawObligations.filter((o) => o.status !== "completed").length - obligations.filter((o) => o.status !== "completed").length,
    }
  }, [isFiltering, taxes, filteredTaxes, rawObligations, obligations])

  useEffect(() => {
    if (!isLoading && clients.length > 0) {
      // Passa todos os tipos pra que o "Resumo Geral" reflita obrigações +
      // guias + parcelamentos. Antes só obrigações entravam, então marcar
      // uma guia como concluída não afetava nenhum card do dashboard.
      setStats(calculateDashboardStats(clients, obligations, filteredTaxes, installments, period))
    }
  }, [isLoading, clients, obligations, filteredTaxes, installments, period])

  const updateData = async () => {
    await refreshData()
  }

  // Memoizadas pra evitar refiltragem a cada render (perf).
  // IMPORTANTE: TODAS antes de qualquer early return — Rules of Hooks.
  const criticalAlerts = useMemo(
    // "Crítico" = vence hoje OU passou da data (e não está concluída).
    // Usa isCriticalNow pra normalizar dia local — evita bug de timezone
    // que faria itens vencendo amanhã virarem crítico ao final do dia.
    () => obligations.filter((o) => isCriticalNow(o)),
    [obligations],
  )

  const criticalInstallments = useMemo(
    () =>
      installments.filter((inst) => {
        if (inst.status === "completed") return false
        const firstDue = new Date(inst.firstDueDate)
        const monthsToAdd = inst.currentInstallment - 1
        const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
        const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
        if (!isInPeriod(adjustedDueDate)) return false
        return adjustedDueDate <= new Date()
      }),
    [installments, isInPeriod],
  )

  const thisWeekObligations = useMemo(
    () =>
      obligations.filter((o) => {
        const dueDate = new Date(o.calculatedDueDate)
        const today = new Date()
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        return dueDate >= today && dueDate <= nextWeek && o.status !== "completed"
      }),
    [obligations],
  )

  const thisWeekInstallments = useMemo(
    () =>
      installments.filter((inst) => {
        if (inst.status === "completed") return false
        const firstDue = new Date(inst.firstDueDate)
        const monthsToAdd = inst.currentInstallment - 1
        const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
        const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
        if (!isInPeriod(adjustedDueDate)) return false
        const today = new Date()
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        return adjustedDueDate >= today && adjustedDueDate <= nextWeek
      }),
    [installments, isInPeriod],
  )

  if (!isMounted || isLoading) {
    return (
      <div className="px-4 lg:px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>
      </div>
    )
  }

  const totalCriticalCount = criticalAlerts.length + criticalInstallments.length
  const totalThisWeekCount = thisWeekObligations.length + thisWeekInstallments.length
  const hasCritical = totalCriticalCount > 0
  const hasThisWeek = totalThisWeekCount > 0

  return (
    <>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
        <div className="space-y-5">
          {/* Hero rico — saudação dinâmica por horário + tempo + saúde do mês */}
          {(() => {
            const meta = getGreetingMeta()
            return (
              <div
                className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${meta.gradient} p-5`}
              >
                <div
                  className={`absolute -top-20 -right-20 size-48 rounded-full ${meta.accent.replace("text-", "bg-").replace("dark:text-", "dark:bg-").replace("-600", "-500/20").replace("-400", "-400/20")} blur-3xl pointer-events-none`}
                  aria-hidden
                />
                <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {new Date().toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className={`text-2xl font-bold tracking-tight ${meta.accent}`}>
                        {meta.greeting}
                      </h1>
                      {isFiltering && periodLabel && (
                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                          <CalendarIcon className="size-3" />
                          Filtrando: {periodLabel}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xl">
                      {isFiltering
                        ? `Mostrando dados de ${periodLabel}.`
                        : hasCritical
                          ? `Você tem ${totalCriticalCount} ${totalCriticalCount === 1 ? "item crítico" : "itens críticos"} pra resolver hoje.`
                          : hasThisWeek
                            ? `Tudo em dia. ${totalThisWeekCount} ${totalThisWeekCount === 1 ? "item vence" : "itens vencem"} nos próximos 7 dias.`
                            : "Nenhuma pendência crítica. Bom trabalho! 🎉"}
                    </p>
                  </div>

                  {/* Lado direito: clima + saúde do mês */}
                  <div className="flex flex-wrap items-stretch gap-3">
                    <WeatherGreeting accent={meta.accent} />

                    {/* Indicador de saúde do mês */}
                    {stats && stats.totalItems > 0 && (() => {
                      const healthRate = Math.round(
                        (stats.completedInPeriod / Math.max(1, stats.totalItems)) * 100,
                      )
                      const healthColor =
                        healthRate >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : healthRate >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      const healthBg =
                        healthRate >= 80
                          ? "bg-emerald-500/10"
                          : healthRate >= 50
                            ? "bg-amber-500/10"
                            : "bg-red-500/10"
                      return (
                        <div className={`shrink-0 rounded-xl ${healthBg} p-3.5 min-w-[150px] border border-border/50`}>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Progresso do mês
                          </p>
                          <p className={`text-2xl font-bold mt-0.5 ${healthColor}`}>{healthRate}%</p>
                          <div className="h-1 mt-1.5 bg-background/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                healthRate >= 80 ? "bg-emerald-500" : healthRate >= 50 ? "bg-amber-500" : "bg-red-500"
                              } transition-all`}
                              style={{ width: `${healthRate}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            {stats.completedInPeriod} de {stats.totalItems}
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Resumo Geral */}
          {stats && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="size-5" />
                Resumo Geral
                {isFiltering && periodLabel && (
                  <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
                )}
              </h2>
              <DashboardStatsCards stats={stats} periodLabel={periodLabel} />
            </div>
          )}

          {/* Linha 1: Alertas Críticos + Vencendo 7 dias (lado a lado quando ambos existem) */}
          {(hasCritical || hasThisWeek) && (
            <div className={`grid gap-4 ${hasCritical && hasThisWeek ? "lg:grid-cols-2" : "grid-cols-1"}`}>
              {hasCritical && (
                <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                          <AlertCircle className="size-5" />
                          Alertas Críticos
                        </CardTitle>
                        <CardDescription>Clique no ✓ para concluir, ou no item para abrir</CardDescription>
                      </div>
                      {criticalAlerts.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-background"
                          onClick={() => completeAllOverdue(criticalAlerts)}
                        >
                          <CheckCircle2 className="size-4 mr-2" />
                          Concluir todas ({criticalAlerts.length})
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {criticalAlerts.slice(0, 3).map((obl) => (
                        <div
                          key={obl.id}
                          className="flex items-center justify-between p-2 bg-background rounded-lg hover:bg-muted/60 transition-colors group"
                        >
                          <Link
                            href={`/obrigacoes?clientId=${obl.clientId}&obligationId=${obl.id}&tab=overdue`}
                            className="flex-1 min-w-0"
                          >
                            <p className="font-medium truncate">{obl.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{obl.client.name}</p>
                          </Link>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <Badge className="bg-red-600">{obl.status === "overdue" ? "Atrasada" : "Vence hoje"}</Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/40 opacity-60 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => completeObligation(obl, e)}
                              title="Marcar como concluída"
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {criticalInstallments.slice(0, 5).map((inst) => {
                        const client = clients.find((c) => c.id === inst.clientId)
                        return (
                          <Link
                            key={inst.id}
                            href={`/parcelamentos?clientId=${inst.clientId}`}
                            className="flex items-center justify-between p-2 bg-background rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                          >
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
                          </Link>
                        )
                      })}
                      {(criticalAlerts.length > 3 || criticalInstallments.length > 5) && (
                        <Link
                          href="/obrigacoes?tab=overdue"
                          className="block text-sm text-muted-foreground text-center pt-2 hover:text-foreground transition-colors"
                        >
                          Ver todos os {totalCriticalCount} alertas →
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {hasThisWeek && (
                <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <CalendarIcon className="size-5" />
                      Vencendo nos Próximos 7 Dias
                    </CardTitle>
                    <CardDescription>
                      {totalThisWeekCount} {totalThisWeekCount === 1 ? "item requer" : "itens requerem"} atenção
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {thisWeekObligations.slice(0, 4).map((obl) => (
                        <div key={obl.id} className="p-3 bg-background rounded-lg border">
                          <p className="font-medium text-sm">{obl.name}</p>
                          <p className="text-xs text-muted-foreground">{obl.client.name}</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Vence: {new Date(obl.calculatedDueDate).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      ))}
                      {thisWeekInstallments.slice(0, 6).map((inst) => {
                        const client = clients.find((c) => c.id === inst.clientId)
                        const firstDue = new Date(inst.firstDueDate)
                        const monthsToAdd = inst.currentInstallment - 1
                        const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
                        const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
                        return (
                          <div key={inst.id} className="p-3 bg-background rounded-lg border">
                            <div className="flex items-center gap-1">
                              <CreditCard className="size-3" />
                              <p className="font-medium text-sm">{inst.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {client?.name} - Parcela {inst.currentInstallment}/{inst.installmentCount}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Vence: {adjustedDueDate.toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        )
                      })}
                      {(thisWeekObligations.length > 4 || thisWeekInstallments.length > 6) && (
                        <Link
                          href="/relatorios"
                          className="sm:col-span-2 block text-xs text-center text-muted-foreground hover:text-foreground transition-colors pt-1"
                        >
                          Ver todos os {totalThisWeekCount} itens dos próximos 7 dias →
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Distribuição (3 gráficos) — logo após Resumo Geral */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="size-5" />
              Distribuição
            </h2>
            <RegimeDistributionChart
              obligations={obligations}
              clients={clients}
              taxes={filteredTaxes}
              installments={installments.filter((i) => {
                const firstDue = new Date(i.firstDueDate)
                const monthsToAdd = i.currentInstallment - 1
                const dueDate = adjustForWeekend(
                  buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
                  i.weekendRule,
                )
                return isInPeriod(dueDate)
              })}
            />
          </div>

          {/* Próximos Vencimentos: Obrigações + Guias de Imposto */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <ListChecks className="size-5" />
              Próximos Vencimentos
              {isFiltering && periodLabel && (
                <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
              )}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <UpcomingObligations
                obligations={obligations}
                periodLabel={periodLabel}
                outsidePeriodCount={totalsOutsidePeriod.obligations}
              />
              <UpcomingTaxes
                taxes={filteredTaxes}
                clients={clients}
                periodLabel={periodLabel}
                outsidePeriodCount={totalsOutsidePeriod.taxes}
              />
            </div>
          </div>

          {/* Indicadores de Produtividade */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="size-5" />
              Indicadores de Produtividade
              {isFiltering && periodLabel && (
                <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
              )}
            </h2>
            <ProductivityStats obligations={obligations} periodLabel={periodLabel} />
          </div>

          {/* Clientes & Atividade */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Activity className="size-5" />
              Clientes & Atividade
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <ClientOverview clients={clients} obligations={obligations} />
              <RecentActivity obligations={obligations} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
