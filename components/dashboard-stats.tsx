"use client"

import { Card } from "@/components/ui/card"
import { Users, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import type { DashboardStats } from "@/lib/types"

type DashboardStatsProps = {
  stats: DashboardStats
  /** Rótulo do período filtrado (ex: "Março/2026"). null/undefined = sem filtro. */
  periodLabel?: string | null
}

type StatConfig = {
  title: string
  value: number
  subtitle: string
  icon: typeof Users
  iconBg: string
  iconColor: string
  ringColor: string
  highlight?: boolean
}

export function DashboardStatsCards({ stats, periodLabel }: DashboardStatsProps) {
  // Detalha por tipo só se houver mais de um tipo com dados — evita poluir
  // o card quando o usuário só usa obrigações.
  const t = stats.byType
  const breakdown = (key: "completed" | "pending" | "overdue"): string => {
    const parts: string[] = []
    if (t.obligations[key]) parts.push(`${t.obligations[key]} obrig.`)
    if (t.taxes[key]) parts.push(`${t.taxes[key]} guias`)
    if (t.installments[key]) parts.push(`${t.installments[key]} parc.`)
    return parts.join(" · ")
  }

  const periodSuffix = periodLabel ? `em ${periodLabel}` : "no período atual"

  const statsConfig: StatConfig[] = [
    {
      title: "Clientes",
      value: stats.totalClients,
      subtitle: `${stats.activeClients} ativos`,
      icon: Users,
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      ringColor: "ring-blue-500/10",
    },
    {
      title: "Total de itens",
      value: stats.totalItems,
      subtitle:
        breakdown("pending") || breakdown("completed")
          ? `${t.obligations.total} obrig. · ${t.taxes.total} guias · ${t.installments.total} parc.`
          : "Obrigações + guias + parcelamentos",
      icon: FileText,
      iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
      iconColor: "text-purple-600 dark:text-purple-400",
      ringColor: "ring-purple-500/10",
    },
    {
      title: "Concluídos",
      value: stats.completedInPeriod,
      subtitle: breakdown("completed") || `Finalizados ${periodSuffix}`,
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      ringColor: "ring-emerald-500/10",
    },
    {
      title: "Atrasados",
      value: stats.overdueItems,
      subtitle:
        stats.overdueItems > 0
          ? breakdown("overdue") || "Atenção"
          : "Tudo em dia",
      icon: AlertCircle,
      iconBg: "bg-red-500/10 dark:bg-red-500/20",
      iconColor: "text-red-600 dark:text-red-400",
      ringColor: "ring-red-500/10",
      highlight: stats.overdueItems > 0,
    },
    {
      title: "Esta semana",
      value: stats.upcomingThisWeek,
      subtitle: "Vencem nos próximos 7 dias",
      icon: Clock,
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      ringColor: "ring-amber-500/10",
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {statsConfig.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card
            key={index}
            className={`relative overflow-hidden p-4 ring-1 ${stat.ringColor} hover:shadow-md transition-shadow ${
              stat.highlight ? "ring-2 ring-red-500/30" : ""
            }`}
          >
            {/* Gradient sutil de fundo */}
            <div
              className={`absolute -right-3 -top-3 size-20 rounded-full ${stat.iconBg} opacity-50 blur-2xl pointer-events-none`}
              aria-hidden
            />

            <div className="relative flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold tracking-tight mt-1 leading-none">
                  {stat.value}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5 truncate" title={stat.subtitle}>
                  {stat.subtitle}
                </p>
              </div>
              <div className={`shrink-0 size-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
                <Icon className={`size-4 ${stat.iconColor}`} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
