"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Building2, FileText, DollarSign, Calendar } from "lucide-react"
import type { Client, Tax, ObligationWithDetails } from "@/lib/types"
import { formatDate } from "@/lib/date-utils"

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  taxes: Tax[]
  obligations: ObligationWithDetails[]
  onSelectObligation?: (obligation: ObligationWithDetails) => void
  onSelectClient?: (client: Client) => void
}

export function GlobalSearch({
  open,
  onOpenChange,
  clients,
  taxes,
  obligations,
  onSelectObligation,
  onSelectClient,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{
    clients: Client[]
    obligations: ObligationWithDetails[]
    taxes: Tax[]
  }>({
    clients: [],
    obligations: [],
    taxes: [],
  })

  useEffect(() => {
    if (!query.trim()) {
      setResults({ clients: [], obligations: [], taxes: [] })
      return
    }

    const searchTerm = query.toLowerCase()

    const matchedClients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.cnpj.includes(searchTerm) ||
        c.email.toLowerCase().includes(searchTerm),
    )

    const matchedObligations = obligations.filter(
      (o) =>
        o.name.toLowerCase().includes(searchTerm) ||
        o.client.name.toLowerCase().includes(searchTerm) ||
        o.description?.toLowerCase().includes(searchTerm) ||
        o.protocol?.toLowerCase().includes(searchTerm),
    )

    const matchedTaxes = taxes.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm) ||
        t.description.toLowerCase().includes(searchTerm) ||
        t.federalTaxCode?.toLowerCase().includes(searchTerm),
    )

    setResults({
      clients: matchedClients.slice(0, 5),
      obligations: matchedObligations.slice(0, 10),
      taxes: matchedTaxes.slice(0, 5),
    })
  }, [query, clients, obligations, taxes])

  const totalResults = results.clients.length + results.obligations.length + results.taxes.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Busca Global</DialogTitle>
          <DialogDescription>
            Realize uma busca global para encontrar clientes, obrigações e impostos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes, obrigações, impostos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {query && (
            <div className="text-sm text-muted-foreground">
              {totalResults === 0 ? "Nenhum resultado encontrado" : `${totalResults} resultado(s) encontrado(s)`}
            </div>
          )}

          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {results.clients.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Building2 className="size-4" />
                    Clientes ({results.clients.length})
                  </div>
                  <div className="space-y-1">
                    {results.clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          onSelectClient?.(client)
                          onOpenChange(false)
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 border transition-colors"
                      >
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{client.cnpj}</div>
                        <div className="text-xs text-muted-foreground">{client.email}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.obligations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="size-4" />
                    Obrigações ({results.obligations.length})
                  </div>
                  <div className="space-y-1">
                    {results.obligations.map((obligation) => (
                      <button
                        key={obligation.id}
                        onClick={() => {
                          onSelectObligation?.(obligation)
                          onOpenChange(false)
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 border transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{obligation.name}</div>
                            <div className="text-sm text-muted-foreground">{obligation.client.name}</div>
                            {obligation.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                {obligation.description}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Badge
                              variant={
                                obligation.status === "completed"
                                  ? "default"
                                  : obligation.status === "overdue"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {obligation.status === "completed"
                                ? "Concluída"
                                : obligation.status === "in_progress"
                                  ? "Em Andamento"
                                  : obligation.status === "overdue"
                                    ? "Atrasada"
                                    : "Pendente"}
                            </Badge>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDate(obligation.calculatedDueDate)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.taxes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <DollarSign className="size-4" />
                    Impostos ({results.taxes.length})
                  </div>
                  <div className="space-y-1">
                    {results.taxes.map((tax) => (
                      <div key={tax.id} className="p-3 rounded-lg border bg-muted/20">
                        <div className="font-medium">{tax.name}</div>
                        <div className="text-sm text-muted-foreground">{tax.description}</div>
                        {tax.federalTaxCode && (
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            Código: {tax.federalTaxCode}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
