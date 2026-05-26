"use client"

/**
 * DualClientRanking — substitui o ClientOverview antigo.
 *
 * Mostra DOIS rankings lado a lado:
 *   - Esquerda (verde): Top 5 clientes com melhor compliance (nota A)
 *   - Direita (vermelho): Top 5 clientes com pior compliance (nota C / B com atrasos)
 *
 * Usa calculateClientCompliance pra computar score A/B/C por cliente.
 */

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, AlertTriangle, ArrowRight, Shield } from "lucide-react"
import type { Client, ObligationWithDetails, Tax, Installment, Service } from "@/lib/types"
import {
  calculateClientCompliance,
  sortBestFirst,
  sortWorstFirst,
  type ClientCompliance,
  type ComplianceGrade,
} from "@/lib/compliance-score"

type Props = {
  clients: Client[]
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  services?: Service[]
}

const GRADE_STYLE: Record<ComplianceGrade, { bg: string; text: string; border: string }> = {
  A: {
    bg: "bg-emerald-100 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40",
  },
  B: {
    bg: "bg-amber-100 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/40",
  },
  C: {
    bg: "bg-red-100 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/40",
  },
}

function ClientRow({ entry, side }: { entry: ClientCompliance; side: "best" | "worst" }) {
  const grade = GRADE_STYLE[entry.grade]
  return (
    <Link
      href={`/obrigacoes?clientId=${entry.client.id}`}
      className="flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary/40 hover:bg-muted/50 transition-colors group"
    >
      <div
        className={`shrink-0 size-9 rounded-md flex items-center justify-center text-sm font-bold ${grade.bg} ${grade.text} ${grade.border} border`}
      >
        {entry.grade}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{entry.client.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span>{entry.onTimeRate}% no prazo</span>
          {entry.currentlyOverdue > 0 && (
            <span className="text-red-600">· {entry.currentlyOverdue} atrasado{entry.currentlyOverdue !== 1 ? "s" : ""}</span>
          )}
          <span>· {entry.totalItems} item{entry.totalItems !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
    </Link>
  )
}

export function DualClientRanking({ clients, obligations, taxes, installments, services }: Props) {
  const { best, worst } = useMemo(() => {
    const all = calculateClientCompliance(clients, obligations, taxes, installments, services)
    const withActivity = all.filter((e) => e.totalItems > 0)
    return {
      best: sortBestFirst(withActivity).filter((e) => e.grade === "A").slice(0, 5),
      worst: sortWorstFirst(withActivity).filter((e) => e.grade === "C" || e.currentlyOverdue > 0).slice(0, 5),
    }
  }, [clients, obligations, taxes, installments, services])

  const hasBest = best.length > 0
  const hasWorst = worst.length > 0

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Esquerda — Top Compliance */}
      <Card className="ring-1 ring-emerald-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-emerald-600" />
            Top Compliance
          </CardTitle>
          <CardDescription className="text-xs">
            Clientes com 95%+ no prazo e sem atrasos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasBest ? (
            <div className="space-y-2">
              {best.map((entry) => (
                <ClientRow key={entry.client.id} entry={entry} side="best" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <Shield className="size-8 opacity-30 mb-2" />
              <p className="text-xs">Ainda nenhum cliente atingiu nota A</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direita — Precisam Atenção */}
      <Card className={`ring-1 ${hasWorst ? "ring-red-500/20" : "ring-emerald-500/10"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`size-4 ${hasWorst ? "text-red-600" : "text-emerald-600"}`} />
            Precisam Atenção
          </CardTitle>
          <CardDescription className="text-xs">
            Clientes com atrasos ou taxa baixa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasWorst ? (
            <div className="space-y-2">
              {worst.map((entry) => (
                <ClientRow key={entry.client.id} entry={entry} side="worst" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <Trophy className="size-8 text-emerald-600 opacity-50 mb-2" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Tudo em dia 🎉
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nenhum cliente com pendências críticas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
