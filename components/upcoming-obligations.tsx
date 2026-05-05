"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, AlertTriangle, ArrowRight } from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { formatDate, isOverdue } from "@/lib/date-utils"

type UpcomingObligationsProps = {
  obligations: ObligationWithDetails[]
  /** Rótulo do período filtrado, ex: "Março/2026". null => sem filtro */
  periodLabel?: string | null
  /** Quantidade de obrigações pendentes fora do período filtrado */
  outsidePeriodCount?: number
}

function formatCompetency(competency?: string): string | null {
  if (!competency) return null
  const m = competency.match(/^(\d{4})-(\d{2})$/)
  if (!m) return competency
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  return `${months[Number(m[2]) - 1]}/${m[1].slice(2)}`
}

export function UpcomingObligations({ obligations, periodLabel, outsidePeriodCount = 0 }: UpcomingObligationsProps) {
  // Mostra tudo que ainda não foi concluído — inclui pending, in_progress e
  // overdue (literal). A flag visual de "Atrasada" é calculada por isOverdue
  // a partir da data, então não filtramos por status === "pending" só.
  const sortedObligations = [...obligations]
    .filter((o) => o.status !== "completed")
    .sort((a, b) => new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime())
    .slice(0, 8)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Próximas Obrigações</CardTitle>
            <CardDescription>
              {periodLabel ? `Vencimentos em ${periodLabel}` : "Vencimentos mais próximos"}
            </CardDescription>
          </div>
          <Calendar className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {sortedObligations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Calendar className="size-10 opacity-20 mb-2" />
            <p className="text-sm">
              {periodLabel ? `Nenhuma obrigação em ${periodLabel}` : "Nenhuma obrigação pendente"}
            </p>
            {outsidePeriodCount > 0 && (
              <Link href="/obrigacoes" className="mt-3">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Ver {outsidePeriodCount} pendência{outsidePeriodCount !== 1 ? "s" : ""} em outros períodos
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedObligations.map((obligation) => {
              const overdue = isOverdue(obligation.calculatedDueDate)
              const competencyShort = formatCompetency(obligation.competencyMonth)
              return (
                <Link
                  key={obligation.id}
                  href={`/obrigacoes?clientId=${obligation.clientId}&obligationId=${obligation.id}`}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors hover:bg-muted ${
                    overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "bg-muted/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {overdue && <AlertTriangle className="size-4 text-red-600 flex-shrink-0" />}
                      <p className="font-medium text-sm truncate">{obligation.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{obligation.client.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {obligation.tax && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {obligation.tax.name}
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
                      {formatDate(obligation.calculatedDueDate)}
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
