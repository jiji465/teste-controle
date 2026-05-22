"use client"

import { useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { DashboardStatsCards } from "@/components/dashboard-stats"
import { ProductivityStats } from "@/components/productivity-stats"
import { RecentActivity } from "@/components/recent-activity"
import { UrgencyTrail } from "@/components/urgency-trail"
import { UpcomingForecast } from "@/components/upcoming-forecast"
import { DualClientRanking } from "@/components/dual-client-ranking"

const RegimeDistributionChart = dynamic(
  () => import("@/components/regime-distribution-chart").then((m) => m.RegimeDistributionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] animate-pulse rounded-lg border bg-muted/30" aria-hidden />
    ),
  },
)
import { calculateDashboardStats, installmentInPeriod } from "@/lib/dashboard-utils"
import { calculateDueDateFromCompetency } from "@/lib/date-utils"
import { getCurrentPeriod } from "@/lib/recurrence-engine"
import { getGreetingMeta } from "@/lib/weather"
import { WeatherGreeting } from "@/components/weather-greeting"
import { TrendingUp, CalendarIcon, BarChart3, ListChecks, Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { adjustForWeekend, buildSafeDate } from "@/lib/date-utils"
import { saveObligation } from "@/features/obligations/services"
import { checkAndGenerateRecurrences } from "@/lib/auto-recurrence"
import type { DashboardStats, ObligationWithDetails } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { toast } from "sonner"

// getGreeting() foi movido pra lib/weather.ts (getGreetingMeta) — agora retorna
// também gradient + accent dinâmicos por horário (manhã/tarde/entardecer/noite).

export default function DashboardPage() {
  const { clients, taxes, obligations: rawObligations, obligationsWithDetails, installments, lockedPeriods, isLoading, refreshData, togglePeriodLock } = useData()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isMounted, setIsMounted] = useState(false)
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
    // Gera próxima instância imediatamente em vez de esperar 24h
    checkAndGenerateRecurrences(true).catch((e) =>
      console.warn("[dashboard] auto-regen pós-conclusão falhou:", e),
    )
    toast.success(`${obl.name} concluída`)
    await refreshData()
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

  // Parcelamentos que TOCAM o período selecionado — inclui se QUALQUER
  // parcela cair no filtro, não só a atual. Antes a Dashboard mostrava
  // "0 parc." mesmo com 7 parcelamentos ativos porque a parcela atual
  // estava num mês passado.
  const filteredInstallments = useMemo(() => {
    if (isLoading) return []
    return installments.filter((i) => {
      const firstDue = new Date(i.firstDueDate)
      for (let n = 1; n <= i.installmentCount; n++) {
        const dueDate = adjustForWeekend(
          buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (n - 1), i.dueDay),
          i.weekendRule,
        )
        if (isInPeriod(dueDate)) return true
      }
      return false
    })
  }, [installments, isLoading, isInPeriod])

  // Versão "sintética" dos parcelamentos com status DA PARCELA do período
  // (não do parcelamento todo). Usada nos contadores que precisam dizer
  // "X parcelas concluídas em Maio" em vez de "X parcelamentos inteiros
  // concluídos". O parcelamento como um todo só vira completed quando
  // todas as parcelas terminam — mas pra fins de "controle do que entreguei
  // no mês", cada parcela conta separadamente.
  const installmentsForStats = useMemo(() => {
    if (isLoading) return []
    return filteredInstallments
      .map((i) => installmentInPeriod(i, period))
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [filteredInstallments, period, isLoading])

  // ─── Período ANTERIOR (mês imediatamente antes do filtrado) ─────────────
  // Alimenta o delta "vs mês anterior" do ProductivityStats. Quando o
  // PeriodSwitcher está em "all" (sem filtro), não há "anterior" — passamos
  // undefined e o componente esconde o delta.
  const previousPeriodKey = useMemo<string | null>(() => {
    if (period === "all" || !/^\d{4}-\d{2}$/.test(period)) return null
    const [y, m] = period.split("-").map(Number)
    // Date(y, m-2, 1) = mês anterior (m é 1-based; setMonth é 0-based, então -2)
    const prev = new Date(y, m - 2, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
  }, [period])

  const inPreviousPeriod = (d: string | Date | null | undefined): boolean => {
    if (!previousPeriodKey || !d) return false
    const date = typeof d === "string" ? new Date(d) : d
    if (Number.isNaN(date.getTime())) return false
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    return key === previousPeriodKey
  }

  const previousObligations = useMemo(() => {
    if (!previousPeriodKey) return undefined
    return obligationsWithDetails.filter((o) => inPreviousPeriod(o.calculatedDueDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obligationsWithDetails, previousPeriodKey])

  const previousTaxes = useMemo(() => {
    if (!previousPeriodKey) return undefined
    return taxes.filter((t) => {
      const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      return date ? inPreviousPeriod(date) : false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxes, previousPeriodKey])

  const previousInstallments = useMemo(() => {
    if (!previousPeriodKey) return undefined
    return installments.filter((i) => {
      const firstDue = new Date(i.firstDueDate)
      for (let n = 1; n <= i.installmentCount; n++) {
        const dueDate = adjustForWeekend(
          buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (n - 1), i.dueDay),
          i.weekendRule,
        )
        if (inPreviousPeriod(dueDate)) return true
      }
      return false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, previousPeriodKey])

  // Versão sintética dos parcelamentos do mês anterior (mesma lógica que
  // installmentsForStats, mas pro período anterior).
  const previousInstallmentsForStats = useMemo(() => {
    if (!previousPeriodKey || !previousInstallments) return undefined
    return previousInstallments
      .map((i) => installmentInPeriod(i, previousPeriodKey))
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [previousInstallments, previousPeriodKey])

  // Contagem total de taxes/obligations/installments fora do filtro pra mostrar contexto quando vazio
  const totalsOutsidePeriod = useMemo(() => {
    if (!isFiltering) return { taxes: 0, obligations: 0, installments: 0 }
    return {
      taxes: taxes.filter((t) => t.status !== "completed").length - filteredTaxes.filter((t) => t.status !== "completed").length,
      obligations: rawObligations.filter((o) => o.status !== "completed").length - obligations.filter((o) => o.status !== "completed").length,
      installments:
        installments.filter((i) => i.status !== "completed").length -
        filteredInstallments.filter((i) => i.status !== "completed").length,
    }
  }, [isFiltering, taxes, filteredTaxes, rawObligations, obligations, installments, filteredInstallments])

  useEffect(() => {
    if (!isLoading && clients.length > 0) {
      // Passa todos os tipos pra que o "Resumo Geral" reflita obrigações +
      // guias + parcelamentos. Antes só obrigações entravam, então marcar
      // uma guia como concluída não afetava nenhum card do dashboard.
      setStats(calculateDashboardStats(clients, obligations, filteredTaxes, filteredInstallments, period))
    }
  }, [isLoading, clients, obligations, filteredTaxes, filteredInstallments, period])

  const updateData = async () => {
    await refreshData()
  }

  // Contagem usada só no hero (mensagem "X itens críticos pra resolver hoje").
  // UrgencyTrail abaixo cuida do detalhamento.
  const urgentCount = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let n = 0
    for (const o of obligations) {
      if (o.status === "completed") continue
      const due = new Date(o.calculatedDueDate)
      due.setHours(0, 0, 0, 0)
      if (due <= today) n++
    }
    for (const i of filteredInstallments) {
      if (i.status === "completed") continue
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const due = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
        i.weekendRule,
      )
      due.setHours(0, 0, 0, 0)
      if (due <= today) n++
    }
    return n
  }, [obligations, filteredInstallments])

  if (!isMounted || isLoading) {
    return (
      <div className="px-4 lg:px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>
      </div>
    )
  }

  return (
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
                        : urgentCount > 0
                          ? `Você tem ${urgentCount} ${urgentCount === 1 ? "item crítico" : "itens críticos"} pra resolver hoje.`
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

          {/* Distribuição (4 gráficos) — logo após Resumo Geral */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="size-5" />
              Distribuição
            </h2>
            <RegimeDistributionChart
              obligations={obligations}
              clients={clients}
              taxes={filteredTaxes}
              installments={installmentsForStats}
            />
          </div>

          {/* Trilha de Urgência + Forecast Próximo Mês (lado a lado) */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <ListChecks className="size-5" />
              Pendências
              {isFiltering && periodLabel && (
                <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
              )}
            </h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <UrgencyTrail
                obligations={obligations}
                taxes={filteredTaxes}
                installments={filteredInstallments}
                clients={clients}
                onCompleteObligation={completeObligation}
              />
              <UpcomingForecast
                obligations={obligationsWithDetails}
                taxes={taxes}
                installments={installments}
                currentMonth={period}
              />
            </div>
          </div>

          {/* Indicadores de Produtividade — com comparativo vs mês anterior */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="size-5" />
              Indicadores de Produtividade
              {isFiltering && periodLabel && (
                <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
              )}
            </h2>
            <ProductivityStats
              obligations={obligations}
              taxes={filteredTaxes}
              installments={installmentsForStats}
              previousObligations={previousObligations}
              previousTaxes={previousTaxes}
              previousInstallments={previousInstallmentsForStats}
              periodLabel={periodLabel}
            />
          </div>

          {/* Ranking de Clientes — duo: bons vs problemáticos */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Activity className="size-5" />
              Clientes
            </h2>
            <DualClientRanking
              clients={clients}
              obligations={obligationsWithDetails}
              taxes={taxes}
              installments={installments}
            />
          </div>

          {/* Atividade Recente — timeline com obrigações + guias + parcelas */}
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Activity className="size-5" />
              Atividade Recente
            </h2>
            <RecentActivity
              obligations={obligationsWithDetails}
              taxes={taxes}
              installments={installments}
              clients={clients}
            />
          </div>
      </div>
    </div>
  )
}
