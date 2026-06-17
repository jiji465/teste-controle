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
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
  },
  B: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
  },
  C: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
}

function ClientRow({ entry, side }: { entry: ClientCompliance; side: "best" | "worst" }) {
  const grade = GRADE_STYLE[entry.grade]
  return (
    <Link
      href={`/obrigacoes?clientId=${entry.client.id}`}
      className="flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary/30 hover:bg-accent transition-colors group"
    >
      <div
        className={`shrink-0 size-9 rounded-md flex items-center justify-center text-sm font-bold ${grade.bg} ${grade.text} ${grade.border} border`}
      >
        {entry.grade}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{entry.client.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          <span>{entry.onTimeRate}% no prazo</span>
          {entry.currentlyOverdue > 0 && (
            <span className="text-destructive">· {entry.currentlyOverdue} atrasado{entry.currentlyOverdue !== 1 ? "s" : ""}</span>
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
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-success" />
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
              <Shield className="size-8 opacity-40 mb-2" />
              <p className="text-xs">Ainda nenhum cliente atingiu nota A</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direita — Precisam Atenção */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`size-4 ${hasWorst ? "text-destructive" : "text-success"}`} />
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
              <Trophy className="size-8 text-success opacity-60 mb-2" />
              <p className="text-xs font-medium text-success">
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
