"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, PlayCircle, AlertTriangle, FilePlus, History } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { effectiveStatus } from "@/lib/obligation-status"

type RecentActivityProps = {
  obligations: ObligationWithDetails[]
}

type ActivityItem = {
  id: string
  obligationName: string
  clientName: string
  action: "completed" | "in_progress" | "overdue" | "created"
  timestamp: Date
}

function relativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
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

const ACTION_META: Record<
  ActivityItem["action"],
  { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  in_progress: {
    label: "Iniciada",
    icon: PlayCircle,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  overdue: {
    label: "Atrasou",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
  },
  created: {
    label: "Cadastrada",
    icon: FilePlus,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
}

export function RecentActivity({ obligations }: RecentActivityProps) {
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []
    const now = new Date()

    for (const o of obligations) {
      if (o.completedAt) {
        items.push({
          id: `${o.id}-completed`,
          obligationName: o.name,
          clientName: o.client.name,
          action: "completed",
          timestamp: new Date(o.completedAt),
        })
      } else if (effectiveStatus(o) === "overdue") {
        items.push({
          id: `${o.id}-overdue`,
          obligationName: o.name,
          clientName: o.client.name,
          action: "overdue",
          timestamp: new Date(o.calculatedDueDate),
        })
      }
    }

    // Pega os 5 mais recentes
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 6)
  }, [obligations])

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-5 text-muted-foreground" />
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-5 text-muted-foreground" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {activities.map((item) => {
            const meta = ACTION_META[item.action]
            const Icon = meta.icon
            return (
              <li key={item.id} className="flex items-start gap-3">
                <div className={`shrink-0 size-8 rounded-lg flex items-center justify-center ${meta.bg}`}>
                  <Icon className={`size-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{item.obligationName}</p>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.clientName} · {relativeTime(item.timestamp)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
