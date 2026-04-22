"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, User, FileText, DollarSign, Building2, Receipt } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { formatDate, formatCurrency } from "@/lib/date-utils"

type ObligationDetailsProps = {
  obligation: ObligationWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ObligationDetails({ obligation, open, onOpenChange }: ObligationDetailsProps) {
  const getStatusColor = () => {
    switch (obligation.status) {
      case "completed":
        return "bg-green-600"
      case "in_progress":
        return "bg-blue-600"
      case "overdue":
        return "bg-red-600"
      default:
        return "bg-gray-600"
    }
  }

  const getStatusLabel = () => {
    switch (obligation.status) {
      case "completed":
        return "Concluída"
      case "in_progress":
        return "Em Andamento"
      case "overdue":
        return "Atrasada"
      default:
        return "Pendente"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{obligation.name}</DialogTitle>
              {obligation.description && (
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {obligation.description}
                </DialogDescription>
              )}
            </div>
            <Badge className={getStatusColor()}>{getStatusLabel()}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações principais */}
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Cliente</p>
                <p className="text-sm text-muted-foreground">{obligation.client.name}</p>
              </div>
            </div>

            {obligation.tax && (
              <div className="flex items-center gap-3">
                <Receipt className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Imposto</p>
                  <p className="text-sm text-muted-foreground">{obligation.tax.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Vencimento</p>
                <p className="text-sm text-muted-foreground font-mono">{formatDate(obligation.calculatedDueDate)}</p>
              </div>
            </div>

            {obligation.amount && (
              <div className="flex items-center gap-3">
                <DollarSign className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Valor</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(obligation.amount)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Clock className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Criada em</p>
                <p className="text-sm text-muted-foreground">{formatDate(obligation.createdAt)}</p>
              </div>
            </div>

            {obligation.completedAt && (
              <div className="flex items-center gap-3">
                <User className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Concluída em</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(obligation.completedAt)}
                    {obligation.completedBy && ` por ${obligation.completedBy}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {obligation.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Observações</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{obligation.notes}</p>
              </div>
            </>
          )}

          {/* Histórico de ações */}
          {obligation.history && obligation.history.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Histórico de Ações</p>
                <div className="space-y-3">
                  {obligation.history.map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-sm">
                      <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-muted-foreground">{entry.description}</p>
                        <p className="text-xs text-muted-foreground/70">{formatDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
