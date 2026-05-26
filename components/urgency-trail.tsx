"use client"

/**
 * UrgencyTrail — substitui as 5 seções antigas do Dashboard:
 *   - "Alertas Críticos" inline
 *   - "Vencendo Próximos 7 Dias" inline
 *   - <UpcomingObligations />
 *   - <UpcomingTaxes />
 *   - <UpcomingInstallments />
 *
 * Mostra os itens pendentes agrupados em 4 "tiers" de urgência. Cada tier
 * é um botão clicável que expande/colapsa a lista do tier. Cabe em mobile
 * (tags horizontais) e mostra contagem por tipo na hora.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  Clock,
  CalendarDays,
  Hourglass,
  CheckCircle2,
  ChevronDown,
  FileText,
  Receipt,
  CreditCard,
  Briefcase,
} from "lucide-react"
import type { ObligationWithDetails, Tax, Client, Installment, Service } from "@/lib/types"
import {
  adjustForWeekend,
  buildSafeDate,
  calculateDueDateFromCompetency,
  formatDate,
} from "@/lib/date-utils"
import { urgencyTier, type UrgencyTier } from "@/lib/compliance-score"

type Props = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  services?: Service[]
  clients: Client[]
  onCompleteObligation?: (o: ObligationWithDetails) => void | Promise<void>
}

type UrgencyItem = {
  id: string
  name: string
  clientName: string
  clientId: string
  dueDate: Date
  tier: UrgencyTier
  type: "obrigacao" | "guia" | "parcela" | "servico"
  href: string
  /** Só preenchido pra obrigações — usado pra ação rápida "Concluir" */
  obligation?: ObligationWithDetails
  /** Pra parcelas, mostra "5/24" */
  parcelaInfo?: string
}

type TierConfig = {
  key: "overdue" | "today" | "soon" | "week" | "month"
  label: string
  description: string
  icon: typeof AlertTriangle
  color: string // tailwind text color class
  bg: string // tailwind bg class
  border: string
  ring: string
}

const TIERS: TierConfig[] = [
  {
    key: "overdue",
    label: "Atrasado",
    description: "Já passou da data",
    icon: AlertTriangle,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
    ring: "ring-red-500/40",
  },
  {
    key: "today",
    label: "Hoje",
    description: "Vence hoje",
    icon: AlertTriangle,
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-900",
    ring: "ring-orange-500/40",
  },
  {
    key: "soon",
    label: "1-3 dias",
    description: "Próximos 3 dias",
    icon: Clock,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900",
    ring: "ring-amber-500/40",
  },
  {
    key: "week",
    label: "4-7 dias",
    description: "Próxima semana",
    icon: Hourglass,
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-900",
    ring: "ring-blue-500/40",
  },
  {
    key: "month",
    label: "8-30 dias",
    description: "No mês",
    icon: CalendarDays,
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-900/50",
    border: "border-slate-200 dark:border-slate-700",
    ring: "ring-slate-400/30",
  },
]

const TYPE_META = {
  obrigacao: { label: "Obrigação", icon: FileText, color: "text-purple-600 dark:text-purple-400" },
  guia: { label: "Guia", icon: Receipt, color: "text-blue-600 dark:text-blue-400" },
  parcela: { label: "Parcela", icon: CreditCard, color: "text-amber-600 dark:text-amber-400" },
  servico: { label: "Serviço", icon: Briefcase, color: "text-emerald-600 dark:text-emerald-400" },
}

export function UrgencyTrail({
  obligations,
  taxes,
  installments,
  services = [],
  clients,
  onCompleteObligation,
}: Props) {
  const [openTier, setOpenTier] = useState<TierConfig["key"] | null>(null)

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—"

  // Constrói uma lista única de itens com tier calculado
  const items = useMemo<UrgencyItem[]>(() => {
    const result: UrgencyItem[] = []

    for (const o of obligations) {
      if (o.status === "completed") continue
      const due = new Date(o.calculatedDueDate)
      const tier = urgencyTier(due, o.status)
      if (!tier || tier === "later") continue
      result.push({
        id: o.id,
        name: o.name,
        clientName: o.client.name,
        clientId: o.clientId,
        dueDate: due,
        tier,
        type: "obrigacao",
        href: `/obrigacoes?clientId=${o.clientId}&obligationId=${o.id}`,
        obligation: o,
      })
    }

    for (const t of taxes) {
      if (t.status === "completed") continue
      const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      if (!date) continue
      const tier = urgencyTier(date, t.status)
      if (!tier || tier === "later") continue
      result.push({
        id: t.id,
        name: t.name,
        clientName: clientName(t.clientId ?? ""),
        clientId: t.clientId ?? "",
        dueDate: date,
        tier,
        type: "guia",
        href: `/impostos?clientId=${t.clientId}`,
      })
    }

    for (const i of installments) {
      if (i.status === "completed") continue
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const date = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
        i.weekendRule,
      )
      const tier = urgencyTier(date, i.status)
      if (!tier || tier === "later") continue
      result.push({
        id: i.id,
        name: i.name,
        clientName: clientName(i.clientId),
        clientId: i.clientId,
        dueDate: date,
        tier,
        type: "parcela",
        href: `/parcelamentos?clientId=${i.clientId}`,
        parcelaInfo: `${i.currentInstallment}/${i.installmentCount}`,
      })
    }

    // Serviços: usam dueDate único
    for (const sv of services) {
      if (sv.status === "completed") continue
      const date = new Date(sv.dueDate)
      if (Number.isNaN(date.getTime())) continue
      const tier = urgencyTier(date, sv.status)
      if (!tier || tier === "later") continue
      result.push({
        id: sv.id,
        name: sv.name,
        clientName: clientName(sv.clientId),
        clientId: sv.clientId,
        dueDate: date,
        tier,
        type: "servico",
        href: `/servicos?clientId=${sv.clientId}`,
      })
    }

    // Ordena por data de vencimento
    return result.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [obligations, taxes, installments, services, clients])

  const byTier = useMemo(() => {
    const map: Record<TierConfig["key"], UrgencyItem[]> = {
      overdue: [],
      today: [],
      soon: [],
      week: [],
      month: [],
    }
    for (const it of items) {
      if (it.tier === "later") continue
      map[it.tier].push(it)
    }
    return map
  }, [items])

  const total = items.length
  if (total === 0) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/10">
        <CardContent className="py-6 flex items-center justify-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Tudo em dia 🎉
            </p>
            <p className="text-xs text-muted-foreground">
              Nenhum item urgente nos próximos 30 dias.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Hourglass className="size-4 text-primary" />
          Trilha de Urgência
          <Badge variant="secondary" className="ml-auto">{total} pendente{total !== 1 ? "s" : ""}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Linha de tiers — clicáveis pra abrir lista */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {TIERS.map((tier) => {
            const count = byTier[tier.key].length
            const isOpen = openTier === tier.key
            const TierIcon = tier.icon
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => setOpenTier(isOpen ? null : tier.key)}
                disabled={count === 0}
                className={`relative rounded-lg border ${tier.border} ${tier.bg} px-3 py-2.5 text-left transition-all ${
                  count === 0
                    ? "opacity-40 cursor-not-allowed"
                    : `hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${isOpen ? `ring-2 ${tier.ring}` : ""}`
                }`}
                aria-expanded={isOpen}
                aria-label={`${tier.label}: ${count} item(s)`}
              >
                <div className="flex items-center gap-2">
                  <TierIcon className={`size-4 ${tier.color}`} />
                  <span className={`text-[11px] uppercase tracking-wide font-medium ${tier.color}`}>
                    {tier.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${tier.color}`}>{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tier.description}</p>
                {count > 0 && (
                  <ChevronDown
                    className={`absolute top-2 right-2 size-3.5 ${tier.color} opacity-50 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Painel expandido — lista os itens do tier selecionado */}
        {openTier && byTier[openTier].length > 0 && (
          <ExpandedTierPanel
            items={byTier[openTier]}
            tier={TIERS.find((t) => t.key === openTier)!}
            onCompleteObligation={onCompleteObligation}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ExpandedTierPanel({
  items,
  tier,
  onCompleteObligation,
}: {
  items: UrgencyItem[]
  tier: TierConfig
  onCompleteObligation?: (o: ObligationWithDetails) => void | Promise<void>
}) {
  // Agrupa por tipo pra mostrar contagem
  const counts = useMemo(() => {
    const c = { obrigacao: 0, guia: 0, parcela: 0, servico: 0 }
    for (const it of items) c[it.type]++
    return c
  }, [items])

  return (
    <div className={`rounded-lg border ${tier.border} ${tier.bg} p-3 space-y-2`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`font-semibold ${tier.color}`}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
        {counts.obrigacao > 0 && (
          <Badge variant="outline" className="gap-1">
            <FileText className="size-3" /> {counts.obrigacao} obrig.
          </Badge>
        )}
        {counts.guia > 0 && (
          <Badge variant="outline" className="gap-1">
            <Receipt className="size-3" /> {counts.guia} guia{counts.guia !== 1 ? "s" : ""}
          </Badge>
        )}
        {counts.parcela > 0 && (
          <Badge variant="outline" className="gap-1">
            <CreditCard className="size-3" /> {counts.parcela} parc.
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
        {items.map((it) => {
          const TypeIcon = TYPE_META[it.type].icon
          return (
            <div
              key={`${it.type}-${it.id}`}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-background/60 hover:bg-background transition-colors"
            >
              <Link href={it.href} className="flex-1 min-w-0 flex items-center gap-2">
                <TypeIcon className={`size-3.5 shrink-0 ${TYPE_META[it.type].color}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{it.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {it.clientName}
                    {it.parcelaInfo && ` · Parcela ${it.parcelaInfo}`}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] tabular-nums font-mono text-muted-foreground">
                  {formatDate(it.dueDate)}
                </span>
                {it.obligation && onCompleteObligation && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/40"
                    onClick={(e) => {
                      e.preventDefault()
                      onCompleteObligation(it.obligation!)
                    }}
                    title="Marcar obrigação como concluída"
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
