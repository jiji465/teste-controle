"use client"

/**
 * AvgCompletionTime — KPI card mostrando o tempo médio (em dias) entre
 * criação e conclusão de itens. Breakdown por tipo.
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, FileText, Receipt, CreditCard } from "lucide-react"
import type { ObligationWithDetails, Tax, Installment } from "@/lib/types"
import { averageCompletionDays } from "@/lib/dashboard-utils"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
}

export function AvgCompletionTime({ obligations, taxes, installments }: Props) {
  const { overall, byObligation, byTax, byInstallment } = useMemo(() => {
    const allItems = [
      ...obligations.map((o) => ({ status: o.status, completedAt: o.completedAt, createdAt: o.createdAt })),
      ...taxes.map((t) => ({ status: t.status, completedAt: t.completedAt, createdAt: t.createdAt })),
      ...installments.map((i) => ({ status: i.status, completedAt: i.completedAt, createdAt: i.createdAt })),
    ]
    return {
      overall: averageCompletionDays(allItems),
      byObligation: averageCompletionDays(obligations.map((o) => ({ status: o.status, completedAt: o.completedAt, createdAt: o.createdAt }))),
      byTax: averageCompletionDays(taxes.map((t) => ({ status: t.status, completedAt: t.completedAt, createdAt: t.createdAt }))),
      byInstallment: averageCompletionDays(installments.map((i) => ({ status: i.status, completedAt: i.completedAt, createdAt: i.createdAt }))),
    }
  }, [obligations, taxes, installments])

  const format = (days: number | null): string => {
    if (days === null) return "—"
    if (days < 1) return "< 1 dia"
    if (days === 1) return "1 dia"
    return `${days} dias`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          Tempo Médio de Conclusão
        </CardTitle>
        <CardDescription className="text-xs">
          Da criação ao "Concluído", em dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">
          {format(overall)}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3 text-purple-600" />
            <div>
              <p className="text-muted-foreground text-[10px]">Obrig.</p>
              <p className="font-medium tabular-nums">{format(byObligation)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Receipt className="size-3 text-blue-600" />
            <div>
              <p className="text-muted-foreground text-[10px]">Guias</p>
              <p className="font-medium tabular-nums">{format(byTax)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CreditCard className="size-3 text-amber-600" />
            <div>
              <p className="text-muted-foreground text-[10px]">Parcs.</p>
              <p className="font-medium tabular-nums">{format(byInstallment)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
