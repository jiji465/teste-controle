"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Receipt, AlertTriangle, ArrowRight } from "lucide-react"
import type { Tax, Client } from "@/lib/types"
import { formatDate, isOverdue, calculateDueDateFromCompetency } from "@/lib/date-utils"

type UpcomingTaxesProps = {
  taxes: Tax[]
  clients: Client[]
  /** Rótulo do período filtrado, ex: "Março/2026". null => sem filtro */
  periodLabel?: string | null
  /** Quantidade de guias pendentes fora do período filtrado (pra dica no estado vazio) */
  outsidePeriodCount?: number
}

type TaxWithDate = Tax & { calculatedDueDate: Date; clientName: string }

const SCOPE_LABELS: Record<string, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
}

function formatCompetency(competency?: string): string | null {
  if (!competency) return null
  const m = competency.match(/^(\d{4})-(\d{2})$/)
  if (!m) return competency
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  return `${months[Number(m[2]) - 1]}/${m[1].slice(2)}`
}

export function UpcomingTaxes({ taxes, clients, periodLabel, outsidePeriodCount = 0 }: UpcomingTaxesProps) {
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
            <CardDescription>
              {periodLabel ? `Vencimentos em ${periodLabel}` : "Vencimentos mais próximos"}
            </CardDescription>
          </div>
          <Receipt className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Receipt className="size-10 opacity-20 mb-2" />
            <p className="text-sm">
              {periodLabel ? `Nenhuma guia em ${periodLabel}` : "Nenhuma guia pendente"}
            </p>
            {outsidePeriodCount > 0 && (
              <Link href="/impostos" className="mt-3">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Ver {outsidePeriodCount} guia{outsidePeriodCount !== 1 ? "s" : ""} em outros períodos
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((tax) => {
              const overdue = isOverdue(tax.calculatedDueDate)
              const competencyShort = formatCompetency(tax.competencyMonth)
              return (
                <Link
                  key={tax.id}
                  href={`/impostos?clientId=${tax.clientId}`}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors hover:bg-muted ${
                    overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "bg-muted/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {overdue && <AlertTriangle className="size-4 text-red-600 flex-shrink-0" />}
                      <p className="font-medium text-sm truncate">{tax.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{tax.clientName}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {tax.scope && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {SCOPE_LABELS[tax.scope] ?? tax.scope}
                        </Badge>
                      )}
                      {competencyShort && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4 font-mono">
                          ref. {competencyShort}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-medium ${overdue ? "text-red-600" : ""}`}>
                      {formatDate(tax.calculatedDueDate)}
                    </p>
                    {overdue && <p className="text-[11px] text-red-600">Atrasada</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
