"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, CheckCircle2, PlayCircle, AlertTriangle, FileText } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { saveObligation } from "@/lib/storage"

type QuickActionsProps = {
  obligations: ObligationWithDetails[]
  onUpdate: () => void
}

export function QuickActions({ obligations, onUpdate }: QuickActionsProps) {
  const pendingObligations = obligations.filter((o) => o.status === "pending")
  const inProgressObligations = obligations.filter((o) => o.status === "in_progress")
  const overdueObligations = obligations.filter(
    (o) => new Date(o.calculatedDueDate) < new Date() && o.status !== "completed",
  )

  const handleBulkComplete = (obligationList: ObligationWithDetails[]) => {
    if (confirm(`Tem certeza que deseja marcar ${obligationList.length} obrigação(ões) como concluída(s)?`)) {
      obligationList.forEach((obligation) => {
        const updated = {
          ...obligation,
          status: "completed" as const,
          completedAt: new Date().toISOString(),
          realizationDate: new Date().toISOString().split("T")[0],
          history: [
            ...(obligation.history || []),
            {
              id: crypto.randomUUID(),
              action: "completed" as const,
              description: "Obrigação marcada como concluída (ação em lote)",
              timestamp: new Date().toISOString(),
            },
          ],
        }
        saveObligation(updated)
      })
      onUpdate()
    }
  }

  const handleBulkStart = (obligationList: ObligationWithDetails[]) => {
    if (confirm(`Tem certeza que deseja iniciar ${obligationList.length} obrigação(ões)?`)) {
      obligationList.forEach((obligation) => {
        const updated = {
          ...obligation,
          status: "in_progress" as const,
          history: [
            ...(obligation.history || []),
            {
              id: crypto.randomUUID(),
              action: "status_changed" as const,
              description: "Status alterado para Em Andamento (ação em lote)",
              timestamp: new Date().toISOString(),
            },
          ],
        }
        saveObligation(updated)
      })
      onUpdate()
    }
  }

  const quickActions = [
    {
      title: "Concluir Pendentes",
      description: `${pendingObligations.length} obrigações pendentes`,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      action: () => handleBulkComplete(pendingObligations),
      disabled: pendingObligations.length === 0,
    },
    {
      title: "Iniciar Pendentes",
      description: `${pendingObligations.length} obrigações para iniciar`,
      icon: PlayCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      action: () => handleBulkStart(pendingObligations),
      disabled: pendingObligations.length === 0,
    },
    {
      title: "Concluir Em Andamento",
      description: `${inProgressObligations.length} obrigações em andamento`,
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      action: () => handleBulkComplete(inProgressObligations),
      disabled: inProgressObligations.length === 0,
    },
    {
      title: "Resolver Atrasadas",
      description: `${overdueObligations.length} obrigações atrasadas`,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      action: () => handleBulkComplete(overdueObligations),
      disabled: overdueObligations.length === 0,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-5" />
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <Button
                key={index}
                variant="outline"
                className={`h-auto p-4 justify-start ${action.bgColor} border-2 hover-lift`}
                onClick={action.action}
                disabled={action.disabled}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`p-2 rounded-lg bg-background/50`}>
                    <Icon className={`size-5 ${action.color}`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-sm mb-0.5">{action.title}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
