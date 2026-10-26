"use client"

/**
 * UpcomingForecast — card compacto que mostra o que vem no próximo mês.
 * Não lista itens — só dá o total por tipo pra ajudar o contador a
 * planejar a carga de trabalho.
 */

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, FileText, Receipt, CreditCard, Briefcase } from "lucide-react"
import type { ObligationWithDetails, Tax, Installment, Service } from "@/lib/types"
import { upcomingForecastCounts } from "@/lib/dashboard-utils"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  services?: Service[]
  /** Mês de referência ("YYYY-MM"). Se vazio, usa mês corrente. */
  currentMonth?: string
}

export function UpcomingForecast({ obligations, taxes, installments, services = [], currentMonth }: Props) {
  // "all" → próximos 30 dias a partir de hoje; mês → mês seguinte ao filtrado.
  // Parcelamentos contam TODAS as parcelas que vencem na janela (não só a
  // parcela atual). Lógica em lib/dashboard-utils (testada).
  const { headerLabel, descPrefix, descRef, counts, link } = useMemo(
    () => upcomingForecastCounts(obligations, taxes, installments, services, currentMonth),
    [obligations, taxes, installments, services, currentMonth],
  )

  const total = counts.obs + counts.txs + counts.parcs + counts.svcs

  return (
    <Card className="overflow-hidden border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="size-4 text-info" />
          {headerLabel}
        </CardTitle>
        <CardDescription className="text-xs">
          {descPrefix}
          <span className="font-medium text-foreground">{descRef}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold tabular-nums text-info">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">item{total !== 1 ? "s" : ""}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {counts.obs > 0 && (
            <Badge variant="outline" className="gap-1">
              <FileText className="size-3" /> {counts.obs} obrig.
            </Badge>
          )}
          {counts.txs > 0 && (
            <Badge variant="outline" className="gap-1">
              <Receipt className="size-3" /> {counts.txs} guia{counts.txs !== 1 ? "s" : ""}
            </Badge>
          )}
          {counts.parcs > 0 && (
            <Badge variant="outline" className="gap-1">
              <CreditCard className="size-3" /> {counts.parcs} parc.
            </Badge>
          )}
          {counts.svcs > 0 && (
            <Badge variant="outline" className="gap-1">
              <Briefcase className="size-3" /> {counts.svcs} serv.
            </Badge>
          )}
          {total === 0 && (
            <span className="text-[11px] text-muted-foreground">
              Nada agendado pra esse período.
            </span>
          )}
        </div>

        {total > 0 && (
          <Link
            href={`/relatorios${link}`}
            className="block mt-3 text-[11px] text-info hover:underline"
          >
            Ver detalhes em Relatórios →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
