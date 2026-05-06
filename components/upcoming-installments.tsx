"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, AlertTriangle, ArrowRight } from "lucide-react"
import type { Installment, Client } from "@/lib/types"
import { adjustForWeekend, buildSafeDate, formatDate, isOverdue } from "@/lib/date-utils"

type UpcomingInstallmentsProps = {
  installments: Installment[]
  clients: Client[]
  /** Rótulo do período filtrado, ex: "Março/2026". null => sem filtro */
  periodLabel?: string | null
  /** Quantidade de parcelamentos pendentes fora do período filtrado */
  outsidePeriodCount?: number
}

type InstallmentWithDate = Installment & {
  calculatedDueDate: Date
  clientName: string
}

export function UpcomingInstallments({
  installments,
  clients,
  periodLabel,
  outsidePeriodCount = 0,
}: UpcomingInstallmentsProps) {
  const upcoming = useMemo<InstallmentWithDate[]>(() => {
    const items: InstallmentWithDate[] = []
    for (const i of installments) {
      if (i.status === "completed") continue
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const raw = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay)
      const date = adjustForWeekend(raw, i.weekendRule)
      const clientName = clients.find((c) => c.id === i.clientId)?.name ?? "—"
      items.push({ ...i, calculatedDueDate: date, clientName })
    }
    return items
      .sort((a, b) => a.calculatedDueDate.getTime() - b.calculatedDueDate.getTime())
      .slice(0, 8)
  }, [installments, clients])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Próximas Parcelas</CardTitle>
            <CardDescription>
              {periodLabel ? `Vencimentos em ${periodLabel}` : "Vencimentos mais próximos"}
            </CardDescription>
          </div>
          <CreditCard className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <CreditCard className="size-10 opacity-20 mb-2" />
            <p className="text-sm">
              {periodLabel
                ? `Nenhuma parcela em ${periodLabel}`
                : "Nenhum parcelamento pendente"}
            </p>
            {outsidePeriodCount > 0 && (
              <Link href="/parcelamentos" className="mt-3">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Ver {outsidePeriodCount} parcelamento{outsidePeriodCount !== 1 ? "s" : ""} em outros períodos
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((inst) => {
              const overdue = isOverdue(inst.calculatedDueDate)
              return (
                <Link
                  key={inst.id}
                  href={`/parcelamentos?clientId=${inst.clientId}`}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors hover:bg-muted ${
                    overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "bg-muted/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {overdue && <AlertTriangle className="size-4 text-red-600 flex-shrink-0" />}
                      <p className="font-medium text-sm truncate">{inst.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{inst.clientName}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] py-0 h-4 font-mono">
                        Parcela {inst.currentInstallment}/{inst.installmentCount}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-medium ${overdue ? "text-red-600" : ""}`}>
                      {formatDate(inst.calculatedDueDate)}
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
