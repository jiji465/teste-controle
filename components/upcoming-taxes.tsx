"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Receipt, AlertTriangle } from "lucide-react"
import type { Tax, Client } from "@/lib/types"
import { formatDate, isOverdue, calculateDueDateFromCompetency } from "@/lib/date-utils"

type UpcomingTaxesProps = {
  taxes: Tax[]
  clients: Client[]
}

type TaxWithDate = Tax & { calculatedDueDate: Date; clientName: string }

export function UpcomingTaxes({ taxes, clients }: UpcomingTaxesProps) {
  const upcoming = useMemo<TaxWithDate[]>(() => {
    const items: TaxWithDate[] = []
    for (const t of taxes) {
      if (t.status === "completed") continue
      const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule)
      if (!date) continue
      const clientName = clients.find((c) => c.id === t.clientId)?.name ?? "—"
      items.push({ ...t, calculatedDueDate: date, clientName })
    }
    return items
      .sort((a, b) => a.calculatedDueDate.getTime() - b.calculatedDueDate.getTime())
      .slice(0, 8)
  }, [taxes, clients])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Próximas Guias de Imposto</CardTitle>
            <CardDescription>Vencimentos mais próximos</CardDescription>
          </div>
          <Receipt className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhuma guia pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((tax) => {
              const dateStr = tax.calculatedDueDate.toISOString().split("T")[0]
              const overdue = isOverdue(dateStr)
              return (
                <div
                  key={tax.id}
                  className={`flex items-start justify-between p-3 rounded-lg border ${
                    overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "bg-muted/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {overdue && <AlertTriangle className="size-4 text-red-600 flex-shrink-0" />}
                      <p className="font-medium text-sm truncate">{tax.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{tax.clientName}</p>
                    {tax.scope && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {tax.scope === "federal" ? "Federal" : tax.scope === "estadual" ? "Estadual" : "Municipal"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className={`text-sm font-medium ${overdue ? "text-red-600" : ""}`}>
                      {formatDate(tax.calculatedDueDate)}
                    </p>
                    {overdue && <p className="text-xs text-red-600">Atrasada</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
