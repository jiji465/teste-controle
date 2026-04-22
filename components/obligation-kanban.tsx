"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  Clock,
  Tag,
  User,
} from "lucide-react"
import type { ObligationWithDetails, Client, Tax } from "@/lib/types"
import { saveObligation, deleteObligation } from "@/lib/storage"
import { formatDate, isOverdue } from "@/lib/date-utils"

type ObligationKanbanProps = {
  obligations: ObligationWithDetails[]
  clients: Client[]
  taxes: Tax[]
  onUpdate: () => void
  onEdit: (obligation: ObligationWithDetails) => void
  onView: (obligation: ObligationWithDetails) => void
}

export function ObligationKanban({ obligations, clients, taxes, onUpdate, onEdit, onView }: ObligationKanbanProps) {
  const pendingObligations = obligations.filter((o) => o.status === "pending")
  const inProgressObligations = obligations.filter((o) => o.status === "in_progress")
  const completedObligations = obligations.filter((o) => o.status === "completed")

  const handleStatusChange = (
    obligation: ObligationWithDetails,
    newStatus: "pending" | "in_progress" | "completed",
  ) => {
    const history = obligation.history || []
    const updated = {
      ...obligation,
      status: newStatus,
      ...(newStatus === "completed" && {
        completedAt: new Date().toISOString(),
        realizationDate: new Date().toISOString().split("T")[0],
        completedBy: "Contador",
      }),
      history: [
        ...history,
        {
          id: crypto.randomUUID(),
          action: newStatus === "completed" ? ("completed" as const) : ("status_changed" as const),
          description: `Status alterado para ${
            newStatus === "pending" ? "Pendente" : newStatus === "in_progress" ? "Em Andamento" : "Concluída"
          }`,
          timestamp: new Date().toISOString(),
        },
      ],
    }
    saveObligation(updated)
    onUpdate()
  }

  const handleDelete = (id: string) => {
    if (confirm("⚠️ Tem certeza que deseja excluir esta obrigação?\n\nEsta ação não pode ser desfeita.")) {
      deleteObligation(id)
      onUpdate()
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)

    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Hoje"
    if (diffDays === 1) return "Amanhã"
    if (diffDays < 0) return `${Math.abs(diffDays)}d atrás`
    if (diffDays <= 7) return `${diffDays}d`

    return formatDate(dateString)
  }

  const ObligationCard = ({ obligation }: { obligation: ObligationWithDetails }) => {
    const overdue = isOverdue(obligation.calculatedDueDate) && obligation.status !== "completed"

    return (
      <Card
        className={`group hover:shadow-md transition-shadow ${overdue ? "border-red-300 dark:border-red-800" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight line-clamp-2">{obligation.name}</h4>
              {obligation.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{obligation.description}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView(obligation)}>
                  <Eye className="size-4 mr-2" />
                  Ver detalhes
                </DropdownMenuItem>
                {obligation.status === "pending" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(obligation, "in_progress")}>
                    <PlayCircle className="size-4 mr-2" />
                    Iniciar
                  </DropdownMenuItem>
                )}
                {obligation.status === "in_progress" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(obligation, "completed")}>
                    <CheckCircle2 className="size-4 mr-2" />
                    Concluir
                  </DropdownMenuItem>
                )}
                {obligation.status === "completed" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(obligation, "pending")}>
                    <Clock className="size-4 mr-2" />
                    Reabrir
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit(obligation)}>
                  <Pencil className="size-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(obligation.id)} className="text-destructive">
                  <Trash2 className="size-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="size-3" />
            <span className="truncate">{obligation.client.name}</span>
          </div>

          {obligation.tax && (
            <div className="flex items-center gap-2 text-xs">
              <Tag className="size-3" />
              <span className="truncate">{obligation.tax.name}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            <span className="truncate">{getRelativeDate(obligation.calculatedDueDate)}</span>
          </div>

          {obligation.priority && (
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className="size-3" />
              <span className={`font-semibold ${getPriorityColor(obligation.priority)}`}>
                {obligation.priority.charAt(0).toUpperCase() + obligation.priority.slice(1)}
              </span>
            </div>
          )}

          {obligation.responsible && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="size-3" />
              <span className="truncate">{obligation.responsible}</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <h3 className="font-semibold text-lg mb-2">Pendentes</h3>
        {pendingObligations.map((obligation) => (
          <ObligationCard key={obligation.id} obligation={obligation} />
        ))}
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-2">Em Andamento</h3>
        {inProgressObligations.map((obligation) => (
          <ObligationCard key={obligation.id} obligation={obligation} />
        ))}
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-2">Concluídas</h3>
        {completedObligations.map((obligation) => (
          <ObligationCard key={obligation.id} obligation={obligation} />
        ))}
      </div>
    </div>
  )
}
