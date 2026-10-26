"use client"

import { useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { DashboardStatsCards } from "@/components/dashboard-stats"
import { ProductivityStats } from "@/components/productivity-stats"
import { RecentActivity } from "@/components/recent-activity"
import { UrgencyTrail } from "@/components/urgency-trail"
import { UpcomingForecast } from "@/components/upcoming-forecast"
import { DualClientRanking } from "@/components/dual-client-ranking"
import { HeatmapEntregas } from "@/components/heatmap-entregas"

const RegimeDistributionChart = dynamic(
  () => import("@/components/regime-distribution-chart").then((m) => m.RegimeDistributionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] animate-pulse rounded-lg border bg-muted/30" aria-hidden />
    ),
  },
)
import { calculateDashboardStats, heroCriticalCount, selectPeriodItems } from "@/lib/dashboard-utils"
import { getCurrentPeriod } from "@/lib/recurrence-engine"
import { getGreetingMeta } from "@/lib/weather"
import { WeatherGreeting } from "@/components/weather-greeting"
import { TrendingUp, CalendarIcon, BarChart3, ListChecks, Activity, CalendarCheck, Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnimatedHero } from "@/components/ui/animated-hero"
import { QuickAccessTabs } from "@/components/quick-access-tabs"
import { QuickShortcuts } from "@/components/quick-shortcuts"
import { SectionHeader } from "@/components/section-header"
import { saveObligation } from "@/features/obligations/services"
import { checkAndGenerateRecurrences } from "@/lib/auto-recurrence"
import type { DashboardStats, ObligationWithDetails } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useAuth } from "@/contexts/auth-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { toast } from "sonner"

// getGreeting() foi movido pra lib/weather.ts (getGreetingMeta) — agora retorna
// também gradient + accent dinâmicos por horário (manhã/tarde/entardecer/noite).

export default function DashboardPage() {
  const { clients, taxes, obligationsWithDetails, installments, services, lockedPeriods, isLoading, refreshData, togglePeriodLock } = useData()
  const { isViewer, userName } = useAuth() // visualizador: esconde atalhos de ação (Indicadores só leitura)
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
      completedBy: userName,
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
  const { period, periodLabel, isFiltering, isCurrentMonth } = useSelectedPeriod()
  const currentPeriod = period === "all" || !/^\d{4}-\d{2}$/.test(period) ? getCurrentPeriod() : period
  const isPeriodLocked = useMemo(() => lockedPeriods.includes(currentPeriod), [lockedPeriods, currentPeriod])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // ─── Seleção do período (fonte única: lib/dashboard-utils) ───────────────
  // Parcelamentos entram PARCELA A PARCELA (status/data da parcela do mês).
  // No MÊS ATUAL, itens não concluídos que venceram em meses anteriores
  // continuam contando como Atrasados/Pendências e no progresso (mesma regra
  // do sino de alertas) — antes o Dashboard dizia "Tudo em dia" enquanto o
  // sino mostrava atrasos.
  const carryOverdue = isCurrentMonth
  const selection = useMemo(() => {
    if (isLoading || !clients.length) {
      return { obligations: [], taxes: [], installments: [], installmentParcels: [], services: [], carriedOverdue: 0 }
    }
    return selectPeriodItems(
      { obligations: obligationsWithDetails, taxes, installments, services },
      period,
      { carryOverdue },
    )
  }, [obligationsWithDetails, taxes, installments, services, clients.length, isLoading, period, carryOverdue])

  const obligations = selection.obligations
  const filteredTaxes = selection.taxes
  const filteredServices = selection.services
  // Uma entrada por PARCELA do período (status/data/conclusão da parcela)
  const installmentsForStats = selection.installmentParcels
  const carriedNote =
    selection.carriedOverdue > 0
      ? `inclui ${selection.carriedOverdue} atrasado${selection.carriedOverdue === 1 ? "" : "s"} de meses anteriores`
      : null

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

  const previousSelection = useMemo(() => {
    if (!previousPeriodKey || isLoading || !clients.length) return null
    return selectPeriodItems(
      { obligations: obligationsWithDetails, taxes, installments, services },
      previousPeriodKey,
    )
  }, [obligationsWithDetails, taxes, installments, services, clients.length, isLoading, previousPeriodKey])

  useEffect(() => {
    if (!isLoading && clients.length > 0) {
      // Os 4 tipos entram no "Resumo Geral" (obrigações + guias + parcelas +
      // serviços), com os atrasados anteriores quando é o mês atual.
      setStats(
        calculateDashboardStats(
          clients,
          obligationsWithDetails,
          taxes,
          installments,
          period,
          services,
          { carryOverdue },
        ),
      )
    }
  }, [isLoading, clients, obligationsWithDetails, taxes, installments, services, period, carryOverdue])

  // Hero: "X itens críticos pra resolver hoje" = atrasados OU vencendo hoje
  // dos 4 tipos (antes ignorava guias e serviços).
  const urgentCount = useMemo(() => heroCriticalCount(selection), [selection])

  if (!isMounted || isLoading) {
    return (
      <div className="px-4 lg:px-6 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
        <div className="stagger space-y-5">
          {/* Hero unificado — saudação + frase animada (framer-motion) + clima +
              saúde do mês, tudo num único card com a paleta da marca
              (primary → chart-2). Antes eram dois banners soltos com paletas
              diferentes (verde-azulado vs. roxo do horário). */}
          {(() => {
            const meta = getGreetingMeta()
            const dateLabel = new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
            const critical =
              urgentCount > 0
                ? `Você tem ${urgentCount} ${urgentCount === 1 ? "item crítico" : "itens críticos"} pra resolver hoje.`
                : "Nenhuma pendência crítica. Bom trabalho! 🎉"
            const message = isFiltering ? `Mostrando dados de ${periodLabel}. ${critical}` : critical
            // Palavras do typewriter COERENTES com a situação real (não uma
            // lista fixa): se há atrasos, fala de atraso; se há vencimentos na
            // semana, fala disso; só diz "em dia" quando realmente está.
            const overdue = stats?.overdueItems ?? 0
            const upcoming = stats?.upcomingThisWeek ?? 0
            const heroWords =
              overdue > 0
                ? [`com ${overdue} em atraso`, "pedindo atenção", "com pendências"]
                : upcoming > 0
                  ? ["quase em dia", "sob controle", `com ${upcoming} vencendo na semana`]
                  : ["em dia", "organizado", "sob controle", "sem atrasos"]
            return (
              <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.08] via-card to-chart-2/[0.08] p-6 lg:p-8">
                <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-primary/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-10 size-56 rounded-full bg-chart-2/10 blur-3xl" />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <AnimatedHero
                    size="inline"
                    align="left"
                    typewriter
                    className="min-w-0 flex-1"
                    staticText={`${meta.greeting}! Seu controle fiscal está`}
                    rotatingWords={heroWords}
                    description={message}
                    badge={
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1.5 border-primary/30 bg-background/60 text-primary">
                          <Sparkles className="size-3" />
                          Painel de Controle Fiscal
                        </Badge>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {dateLabel}
                        </span>
                        {isFiltering && periodLabel && (
                          <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                            <CalendarIcon className="size-3" />
                            Filtrando: {periodLabel}
                          </Badge>
                        )}
                      </div>
                    }
                    actions={
                      <>
                        <Link href="/obrigacoes?tab=overdue">
                          <Button className="gap-2">
                            {urgentCount > 0
                              ? `Resolver ${urgentCount} ${urgentCount === 1 ? "pendência" : "pendências"}`
                              : "Ver pendências"}
                            <ArrowRight className="size-4" />
                          </Button>
                        </Link>
                        <Link href="/clientes">
                          <Button variant="outline">Empresas</Button>
                        </Link>
                      </>
                    }
                  />

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

          {/* Ações rápidas — criar (atalhos) + navegar (acesso rápido).
              Escondidas do visualizador (leva a criar/áreas restritas). */}
          {!isViewer && (
            <>
              <QuickShortcuts />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Acesso rápido
                </span>
                <QuickAccessTabs />
              </div>
            </>
          )}

          {/* Resumo Geral */}
          {stats && (
            <div>
              <SectionHeader
                icon={BarChart3}
                title="Resumo Geral"
                suffix={
                  isFiltering && periodLabel
                    ? `· ${periodLabel}${carriedNote ? ` · ${carriedNote}` : ""}`
                    : undefined
                }
              />
              <DashboardStatsCards stats={stats} periodLabel={periodLabel} />
            </div>
          )}

          {/* Distribuição (4 gráficos) — logo após Resumo Geral */}
          <div>
            <SectionHeader icon={BarChart3} title="Distribuição" />
            <RegimeDistributionChart
              obligations={obligations}
              clients={clients}
              taxes={filteredTaxes}
              installments={installmentsForStats}
              services={filteredServices}
            />
          </div>

          {/* Trilha de Urgência + Forecast Próximo Mês (lado a lado) */}
          <div>
            <SectionHeader
              icon={ListChecks}
              title="Pendências"
              suffix={
                isFiltering && periodLabel
                  ? `· ${periodLabel}${carriedNote ? ` · ${carriedNote}` : ""}`
                  : undefined
              }
            />
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <UrgencyTrail
                obligations={obligations}
                taxes={filteredTaxes}
                installments={installmentsForStats}
                services={filteredServices}
                clients={clients}
                onCompleteObligation={completeObligation}
              />
              <UpcomingForecast
                obligations={obligationsWithDetails}
                taxes={taxes}
                installments={installments}
                services={services}
                currentMonth={period}
              />
            </div>
          </div>

          {/* Indicadores de Produtividade — com comparativo vs mês anterior */}
          <div>
            <SectionHeader
              icon={TrendingUp}
              title="Indicadores de Produtividade"
              suffix={isFiltering && periodLabel ? `· ${periodLabel}` : undefined}
            />
            <ProductivityStats
              obligations={obligations}
              taxes={filteredTaxes}
              installments={installmentsForStats}
              previousObligations={previousSelection?.obligations}
              previousTaxes={previousSelection?.taxes}
              previousInstallments={previousSelection?.installmentParcels}
              periodLabel={periodLabel}
            />
          </div>

          {/* Entregas por dia — calendário de produtividade (conclusões reais) */}
          <div>
            <SectionHeader icon={CalendarCheck} title="Entregas por dia" />
            <HeatmapEntregas
              obligations={obligationsWithDetails}
              taxes={taxes}
              installments={installments}
              services={services}
              monthKey={isFiltering && period !== "all" ? period : undefined}
            />
          </div>

          {/* Ranking de Clientes — duo: bons vs problemáticos */}
          <div>
            <SectionHeader icon={Activity} title="Clientes" />
            <DualClientRanking
              clients={clients}
              obligations={obligationsWithDetails}
              taxes={taxes}
              installments={installments}
              services={services}
            />
          </div>

          {/* Atividade Recente — timeline com obrigações + guias + parcelas */}
          <div>
            <SectionHeader icon={Activity} title="Atividade Recente" />
            <RecentActivity
              obligations={obligationsWithDetails}
              taxes={taxes}
              installments={installments}
              services={services}
              clients={clients}
            />
          </div>
      </div>
    </div>
  )
}
