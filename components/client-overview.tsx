"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import type { Client, ObligationWithDetails } from "@/lib/types"

type ClientOverviewProps = {
  clients: Client[]
  obligations: ObligationWithDetails[]
}

export function ClientOverview({ clients, obligations }: ClientOverviewProps) {
  const clientsWithStats = clients
    .filter((c) => c.status === "active")
    .map((client) => {
      const clientObligations = obligations.filter((o) => o.clientId === client.id)
      const pending = clientObligations.filter((o) => o.status === "pending").length
      const overdue = clientObligations.filter(
        (o) => o.status === "pending" && new Date(o.calculatedDueDate) < new Date(),
      ).length

      return {
        ...client,
        totalObligations: clientObligations.length,
        pending,
        overdue,
      }
    })
    .sort((a, b) => b.overdue - a.overdue || b.pending - a.pending)
    .slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Visão por Cliente</CardTitle>
            <CardDescription>Status das obrigações por cliente</CardDescription>
          </div>
          <Building2 className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {clientsWithStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum cliente ativo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientsWithStats.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{client.cnpj}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {client.overdue > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {client.overdue} atrasada{client.overdue > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {client.pending > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {client.pending} pendente{client.pending > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {client.pending === 0 && client.overdue === 0 && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      Em dia
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
