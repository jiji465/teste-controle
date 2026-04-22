"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertTriangle } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { formatDate, isOverdue } from "@/lib/date-utils"

type UpcomingObligationsProps = {
  obligations: ObligationWithDetails[]
}

export function UpcomingObligations({ obligations }: UpcomingObligationsProps) {
  const sortedObligations = [...obligations]
    .filter((o) => o.status === "pending")
    .sort((a, b) => new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime())
    .slice(0, 8)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Próximas Obrigações</CardTitle>
            <CardDescription>Vencimentos mais próximos</CardDescription>
          </div>
          <Calendar className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {sortedObligations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma obrigação pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedObligations.map((obligation) => {
              const overdue = isOverdue(obligation.calculatedDueDate)
              return (
                <div
                  key={obligation.id}
                  className={`flex items-start justify-between p-3 rounded-lg border ${
                    overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "bg-muted/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {overdue && <AlertTriangle className="size-4 text-red-600 flex-shrink-0" />}
                      <p className="font-medium text-sm truncate">{obligation.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{obligation.client.name}</p>
                    {obligation.tax && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {obligation.tax.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className={`text-sm font-medium ${overdue ? "text-red-600" : ""}`}>
                      {formatDate(obligation.calculatedDueDate)}
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
