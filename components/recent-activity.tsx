"use client"

/**
 * RecentActivity — timeline vertical com 10 itens mais recentes, mostrando
 * ação, autor (`completedBy`) e tempo relativo. Considera também guias e
 * parcelas, não só obrigações.
 */

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  AlertTriangle,
  FilePlus,
  History,
  FileText,
  Receipt,
  CreditCard,
  User,
} from "lucide-react"
import type { ObligationWithDetails, Tax, Installment, Client } from "@/lib/types"
import { effectiveStatus } from "@/lib/obligation-status"
import {
  adjustForWeekend,
  buildSafeDate,
  calculateDueDateFromCompetency,
} from "@/lib/date-utils"

type ItemType = "obrigacao" | "guia" | "parcela"

type ActivityItem = {
  id: string
  itemName: string
  clientName: string
  clientId: string
  href: string
  type: ItemType
  action: "completed" | "overdue" | "created"
  actor?: string
  timestamp: Date
}

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  clients: Client[]
  /** Máximo de itens a mostrar. Default 10. */
  limit?: number
}

function relativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return date.toLocaleDateString("pt-BR")
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return "Agora"
  if (diffMin < 60) return `${diffMin} min atrás`
  if (diffH < 24) return `${diffH}h atrás`
  if (diffD === 1) return "Ontem"
  if (diffD < 7) return `${diffD} dias atrás`
  return date.toLocaleDateString("pt-BR")
}

const ACTION_META = {
  completed: {
    label: "Concluído",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  overdue: {
    label: "Atrasou",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/20",
  },
  created: {
    label: "Criado",
    icon: FilePlus,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
  },
} as const

const TYPE_ICON = {
  obrigacao: FileText,
  guia: Receipt,
  parcela: CreditCard,
} as const

const TYPE_LABEL = {
  obrigacao: "Obrigação",
  guia: "Guia",
  parcela: "Parcela",
} as const

export function RecentActivity({
  obligations,
  taxes,
  installments,
  clients,
  limit = 10,
}: Props) {
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—"

  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []

    for (const o of obligations) {
      if (o.completedAt) {
        items.push({
          id: `obl-${o.id}-c`,
          itemName: o.name,
          clientName: o.client.name,
          clientId: o.clientId,
          href: `/obrigacoes?clientId=${o.clientId}&obligationId=${o.id}`,
          type: "obrigacao",
          action: "completed",
          actor: o.completedBy,
          timestamp: new Date(o.completedAt),
        })
      } else if (effectiveStatus(o) === "overdue") {
        items.push({
          id: `obl-${o.id}-o`,
          itemName: o.name,
          clientName: o.client.name,
          clientId: o.clientId,
          href: `/obrigacoes?clientId=${o.clientId}&obligationId=${o.id}`,
          type: "obrigacao",
          action: "overdue",
          timestamp: new Date(o.calculatedDueDate),
        })
      }
    }

    for (const t of taxes) {
      const due = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      if (t.completedAt) {
        items.push({
          id: `tax-${t.id}-c`,
          itemName: t.name,
          clientName: clientName(t.clientId ?? ""),
          clientId: t.clientId ?? "",
          href: `/impostos?clientId=${t.clientId}`,
          type: "guia",
          action: "completed",
          actor: t.completedBy,
          timestamp: new Date(t.completedAt),
        })
      } else if (due && effectiveStatus({ status: t.status, calculatedDueDate: due }) === "overdue") {
        items.push({
          id: `tax-${t.id}-o`,
          itemName: t.name,
          clientName: clientName(t.clientId ?? ""),
          clientId: t.clientId ?? "",
          href: `/impostos?clientId=${t.clientId}`,
          type: "guia",
          action: "overdue",
          timestamp: due,
        })
      }
    }

    for (const i of installments) {
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const due = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
        i.weekendRule,
      )
      if (i.completedAt) {
        items.push({
          id: `inst-${i.id}-c`,
          itemName: i.name,
          clientName: clientName(i.clientId),
          clientId: i.clientId,
          href: `/parcelamentos?clientId=${i.clientId}`,
          type: "parcela",
          action: "completed",
          actor: i.completedBy,
          timestamp: new Date(i.completedAt),
        })
      } else if (effectiveStatus({ status: i.status, calculatedDueDate: due }) === "overdue") {
        items.push({
          id: `inst-${i.id}-o`,
          itemName: i.name,
          clientName: clientName(i.clientId),
          clientId: i.clientId,
          href: `/parcelamentos?clientId=${i.clientId}`,
          type: "parcela",
          action: "overdue",
          timestamp: due,
        })
      }
    }

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
  }, [obligations, taxes, installments, clients, limit])

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-muted-foreground" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma atividade recente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-muted-foreground" />
          Atividade Recente
        </CardTitle>
        <CardDescription className="text-xs">
          Últimas {activities.length} ações no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3">
          {/* Linha vertical da timeline */}
          <div
            className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60"
            aria-hidden
          />
          {activities.map((item) => {
            const meta = ACTION_META[item.action]
            const ActionIcon = meta.icon
            const TypeIcon = TYPE_ICON[item.type]
            const initials = item.actor
              ? item.actor
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              : null
            return (
              <li key={item.id} className="relative pl-10">
                {/* Bolinha da timeline */}
                <div
                  className={`absolute left-0 top-0 size-8 rounded-full flex items-center justify-center ring-2 ring-background ${meta.bg}`}
                >
                  <ActionIcon className={`size-4 ${meta.color}`} />
                </div>

                <Link
                  href={item.href}
                  className="block rounded-md hover:bg-muted/50 transition-colors px-2 py-1.5 -mx-2 -my-1.5"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.itemName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                        <TypeIcon className="size-3" />
                        <span>{TYPE_LABEL[item.type]}</span>
                        <span>·</span>
                        <span className="truncate">{item.clientName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${meta.color}`}>
                        {meta.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {relativeTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                  {initials && item.action === "completed" && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center justify-center size-4 rounded-full bg-muted text-[9px] font-semibold">
                        {initials}
                      </span>
                      <span>{item.actor}</span>
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
