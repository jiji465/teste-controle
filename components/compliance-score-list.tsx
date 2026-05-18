"use client"

/**
 * ComplianceScoreList — ranking COMPLETO de clientes por compliance score.
 * Mostra nota A/B/C com gauge mini, contagem de atrasos e link.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Shield, TrendingUp, AlertTriangle, ArrowRight, Award } from "lucide-react"
import type { Client, ObligationWithDetails, Tax, Installment } from "@/lib/types"
import {
  calculateClientCompliance,
  sortWorstFirst,
  sortBestFirst,
  type ClientCompliance,
  type ComplianceGrade,
} from "@/lib/compliance-score"

type Props = {
  clients: Client[]
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
}

const GRADE_STYLE: Record<ComplianceGrade, { bg: string; text: string; border: string; label: string }> = {
  A: {
    bg: "bg-emerald-100 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40",
    label: "Excelente",
  },
  B: {
    bg: "bg-amber-100 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/40",
    label: "Atenção",
  },
  C: {
    bg: "bg-red-100 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/40",
    label: "Crítico",
  },
}

export function ComplianceScoreList({ clients, obligations, taxes, installments }: Props) {
  const [sortMode, setSortMode] = useState<"worst" | "best">("worst")
  const [showAll, setShowAll] = useState(false)

  const { sorted, stats } = useMemo(() => {
    const all = calculateClientCompliance(clients, obligations, taxes, installments)
    const withActivity = all.filter((e) => e.totalItems > 0)
    const sorted = sortMode === "worst" ? sortWorstFirst(withActivity) : sortBestFirst(withActivity)
    const stats = {
      A: withActivity.filter((c) => c.grade === "A").length,
      B: withActivity.filter((c) => c.grade === "B").length,
      C: withActivity.filter((c) => c.grade === "C").length,
      total: withActivity.length,
    }
    return { sorted, stats }
  }, [clients, obligations, taxes, installments, sortMode])

  const visible = showAll ? sorted : sorted.slice(0, 10)

  if (stats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="size-4 text-primary" /> Compliance por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum cliente com atividade no período.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-primary" /> Compliance por Cliente
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Nota baseada em % no prazo + atrasos atuais
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={sortMode === "worst" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSortMode("worst")}
            >
              <AlertTriangle className="size-3 mr-1" /> Piores
            </Button>
            <Button
              size="sm"
              variant={sortMode === "best" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSortMode("best")}
            >
              <TrendingUp className="size-3 mr-1" /> Melhores
            </Button>
          </div>
        </div>

        {/* Resumo das notas */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className={`${GRADE_STYLE.A.text} ${GRADE_STYLE.A.border}`}>
            {stats.A} cliente{stats.A !== 1 ? "s" : ""} nota A
          </Badge>
          <Badge variant="outline" className={`${GRADE_STYLE.B.text} ${GRADE_STYLE.B.border}`}>
            {stats.B} nota B
          </Badge>
          <Badge variant="outline" className={`${GRADE_STYLE.C.text} ${GRADE_STYLE.C.border}`}>
            {stats.C} nota C
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {visible.map((entry) => {
            const style = GRADE_STYLE[entry.grade]
            return (
              <li key={entry.client.id}>
                <Link
                  href={`/obrigacoes?clientId=${entry.client.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary/40 hover:bg-muted/50 transition-colors group"
                >
                  <div
                    className={`shrink-0 size-10 rounded-md flex flex-col items-center justify-center ${style.bg} ${style.text} ${style.border} border`}
                  >
                    <span className="text-base font-bold leading-none">{entry.grade}</span>
                    <span className="text-[8px] uppercase tracking-wider mt-0.5">{style.label}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{entry.client.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress
                        value={entry.onTimeRate}
                        className="h-1.5 flex-1 max-w-[200px]"
                      />
                      <span className="text-xs tabular-nums font-medium">{entry.onTimeRate}%</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      <span>{entry.totalItems} item{entry.totalItems !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>{entry.completed} concluídos</span>
                      {entry.currentlyOverdue > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-red-600">
                            {entry.currentlyOverdue} atrasado{entry.currentlyOverdue !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>

        {sorted.length > 10 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-3 text-xs"
          >
            {showAll ? "Mostrar menos" : `Ver todos os ${sorted.length} clientes`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
