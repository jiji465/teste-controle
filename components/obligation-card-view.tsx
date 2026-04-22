"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  CheckCircle2,
  PlayCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { formatDate, isOverdue } from "@/lib/date-utils"
import { getRecurrenceDescription } from "@/lib/recurrence-utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type ObligationCardViewProps = {
  obligations: ObligationWithDetails[]
  onComplete: (obligation: ObligationWithDetails) => void
  onInProgress: (obligation: ObligationWithDetails) => void
  onEdit: (obligation: ObligationWithDetails) => void
  onDelete: (id: string) => void
  onView: (obligation: ObligationWithDetails) => void
}

export function ObligationCardView({
  obligations,
  onComplete,
  onInProgress,
  onEdit,
  onDelete,
  onView,
}: ObligationCardViewProps) {
  const getStatusColor = (obligation: ObligationWithDetails) => {
    if (obligation.status === "completed") return "border-green-500 bg-green-50 dark:bg-green-950/20"
    if (obligation.status === "in_progress") return "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
    if (isOverdue(obligation.calculatedDueDate)) return "border-red-500 bg-red-50 dark:bg-red-950/20"
    return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
  }

  const getStatusIcon = (obligation: ObligationWithDetails) => {
    if (obligation.status === "completed") return <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
    if (obligation.status === "in_progress") return <PlayCircle className="size-5 text-blue-600 dark:text-blue-400" />
    if (isOverdue(obligation.calculatedDueDate))
      return <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
    return <Clock className="size-5 text-yellow-600 dark:text-yellow-400" />
  }

  const getStatusText = (obligation: ObligationWithDetails) => {
    if (obligation.status === "completed") return "Concluída"
    if (obligation.status === "in_progress") return "Em Andamento"
    if (isOverdue(obligation.calculatedDueDate)) return "Atrasada"
    return "Pendente"
  }

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)

    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Vence hoje"
    if (diffDays === 1) return "Vence amanhã"
    if (diffDays === -1) return "Venceu ontem"
    if (diffDays < 0) return `Venceu há ${Math.abs(diffDays)} dias`
    if (diffDays <= 7) return `Vence em ${diffDays} dias`

    return `Vence em ${formatDate(dateString)}`
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {obligations.map((obligation) => (
        <Card key={obligation.id} className={`border-l-4 ${getStatusColor(obligation)}`}>
          <CardHeader>
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold">{obligation.title}</h3>
                <p className="text-sm text-muted-foreground">{obligation.description}</p>
              </div>
              <Badge>{getStatusText(obligation)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Calendar className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{getRelativeDate(obligation.calculatedDueDate)}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Building2 className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{obligation.clientName}</p>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{getRecurrenceDescription(obligation.recurrence)}</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => onView(obligation)}>
              <Eye className="mr-2 h-4 w-4" />
              Visualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44">
                <DropdownMenuItem onClick={() => onEdit(obligation)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(obligation.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
                {obligation.status !== "completed" && (
                  <DropdownMenuItem onClick={() => onComplete(obligation)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar como concluída
                  </DropdownMenuItem>
                )}
                {obligation.status !== "in_progress" && (
                  <DropdownMenuItem onClick={() => onInProgress(obligation)}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Marcar como em andamento
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
