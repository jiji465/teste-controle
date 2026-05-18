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
import { TrendingUp, FileText, Receipt, CreditCard } from "lucide-react"
import type { ObligationWithDetails, Tax, Installment } from "@/lib/types"
import {
  adjustForWeekend,
  buildSafeDate,
  calculateDueDateFromCompetency,
} from "@/lib/date-utils"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  /** Mês de referência ("YYYY-MM"). Se vazio, usa mês corrente. */
  currentMonth?: string
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function parsePeriod(period: string | undefined): { year: number; month0: number } {
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number)
    return { year: y, month0: m - 1 }
  }
  const now = new Date()
  return { year: now.getFullYear(), month0: now.getMonth() }
}

export function UpcomingForecast({ obligations, taxes, installments, currentMonth }: Props) {
  const { nextLabel, counts, link } = useMemo(() => {
    const { year, month0 } = parsePeriod(currentMonth)
    // Próximo mês relativo ao "mês selecionado" (não ao mês de calendário real)
    const nextDate = new Date(year, month0 + 1, 1)
    const nextYear = nextDate.getFullYear()
    const nextMonth0 = nextDate.getMonth()
    const period = `${nextYear}-${String(nextMonth0 + 1).padStart(2, "0")}`

    const matches = (d: Date) => d.getFullYear() === nextYear && d.getMonth() === nextMonth0

    let obs = 0
    let txs = 0
    let parcs = 0

    for (const o of obligations) {
      const d = new Date(o.calculatedDueDate)
      if (matches(d)) obs++
    }
    for (const t of taxes) {
      const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      if (d && matches(d)) txs++
    }
    for (const i of installments) {
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const d = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
        i.weekendRule,
      )
      if (matches(d)) parcs++
    }

    return {
      nextLabel: `${MONTH_NAMES[nextMonth0]}/${nextYear}`,
      counts: { obs, txs, parcs },
      link: `?period=${period}`,
    }
  }, [obligations, taxes, installments, currentMonth])

  const total = counts.obs + counts.txs + counts.parcs

  return (
    <Card className="overflow-hidden ring-1 ring-blue-500/10 hover:ring-blue-500/30 transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="size-4 text-blue-600" />
          Próximo mês
        </CardTitle>
        <CardDescription className="text-xs">
          O que vence em <span className="font-medium text-foreground">{nextLabel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
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
          {total === 0 && (
            <span className="text-[11px] text-muted-foreground">
              Nada agendado pra esse período.
            </span>
          )}
        </div>

        {total > 0 && (
          <Link
            href={`/relatorios${link}`}
            className="block mt-3 text-[11px] text-blue-600 hover:underline"
          >
            Ver detalhes em Relatórios →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
