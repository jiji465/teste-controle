"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Printer,
  Building2,
  Layers,
  ArrowRight,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { ObligationWithDetails, Tax, Installment, Client } from "@/lib/types"
import { formatDate } from "@/lib/date-utils"
import { effectiveStatus } from "@/lib/obligation-status"
import { getRecurrenceDescription } from "@/lib/recurrence-utils"

type ReportsPanelProps = {
  obligations: ObligationWithDetails[]
  taxes?: Tax[]
  installments?: Installment[]
  clients?: Client[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isInPeriodFilter(date: Date, periodFilter: string, ref: Date = new Date()): boolean {
  switch (periodFilter) {
    case "this_month":
      return date.getMonth() === ref.getMonth() && date.getFullYear() === ref.getFullYear()
    case "last_month": {
      const lm = new Date(ref.getFullYear(), ref.getMonth() - 1, 1)
      return date.getMonth() === lm.getMonth() && date.getFullYear() === lm.getFullYear()
    }
    case "this_quarter": {
      const quarter = Math.floor(ref.getMonth() / 3)
      const oblQuarter = Math.floor(date.getMonth() / 3)
      return oblQuarter === quarter && date.getFullYear() === ref.getFullYear()
    }
    case "this_year":
      return date.getFullYear() === ref.getFullYear()
    case "all":
    default:
      return true
  }
}

/** Calcula o "período anterior" pra comparativo */
function previousPeriodRef(periodFilter: string): Date | null {
  const now = new Date()
  switch (periodFilter) {
    case "this_month":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1)
    case "last_month":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1)
    case "this_quarter":
      return new Date(now.getFullYear(), now.getMonth() - 3, 1)
    case "this_year":
      return new Date(now.getFullYear() - 1, now.getMonth(), 1)
    default:
      return null // "all" — sem comparativo
  }
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null
  if (previous === 0) {
    return (
      <Badge variant="outline" className="text-[10px] gap-0.5 border-emerald-500/30 text-emerald-600">
        novo
      </Badge>
    )
  }
  const delta = current - previous
  const pct = Math.round((delta / previous) * 100)
  if (pct === 0) return null
  const isUp = pct > 0
  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-0.5 ${isUp ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-600"}`}
    >
      {isUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
      {Math.abs(pct)}%
    </Badge>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────

export function ReportsPanel({
  obligations,
  taxes = [],
  installments = [],
  clients = [],
}: ReportsPanelProps) {
  const [periodFilter, setPeriodFilter] = useState<string>("all")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [scopeFilter, setScopeFilter] = useState<string>("all")

  // Filtra por período + cliente + esfera
  const filteredObligations = useMemo(() => {
    return obligations.filter((obl) => {
      const oblDate = new Date(obl.calculatedDueDate)
      if (!isInPeriodFilter(oblDate, periodFilter)) return false
      if (clientFilter !== "all" && obl.clientId !== clientFilter) return false
      if (scopeFilter !== "all" && obl.scope !== scopeFilter) return false
      return true
    })
  }, [obligations, periodFilter, clientFilter, scopeFilter])

  // Comparativo: mesmas obrigações, mas no período anterior
  const previousFilteredCount = useMemo(() => {
    const prevRef = previousPeriodRef(periodFilter)
    if (!prevRef) return null
    return obligations.filter((obl) => {
      const oblDate = new Date(obl.calculatedDueDate)
      if (!isInPeriodFilter(oblDate, periodFilter, prevRef)) return false
      if (clientFilter !== "all" && obl.clientId !== clientFilter) return false
      if (scopeFilter !== "all" && obl.scope !== scopeFilter) return false
      return true
    }).length
  }, [obligations, periodFilter, clientFilter, scopeFilter])

  // Stats — usa effectiveStatus pra contar overdue corretamente
  // (pending com data passada vira overdue dinamicamente).
  const stats = useMemo(() => {
    const completed: ObligationWithDetails[] = []
    const inProgress: ObligationWithDetails[] = []
    const pending: ObligationWithDetails[] = []
    const overdue: ObligationWithDetails[] = []
    for (const o of filteredObligations) {
      const eff = effectiveStatus(o)
      if (eff === "completed") completed.push(o)
      else if (eff === "in_progress") inProgress.push(o)
      else if (eff === "overdue") overdue.push(o)
      else pending.push(o)
    }
    return { completed, inProgress, pending, overdue }
  }, [filteredObligations])

  const completionRate =
    filteredObligations.length > 0
      ? Math.round((stats.completed.length / filteredObligations.length) * 100)
      : 0

  const completedOnTime = useMemo(
    () =>
      stats.completed.filter((obl) => {
        if (!obl.completedAt) return false
        return new Date(obl.completedAt) <= new Date(obl.calculatedDueDate)
      }),
    [stats.completed],
  )
  const onTimeRate =
    stats.completed.length > 0
      ? Math.round((completedOnTime.length / stats.completed.length) * 100)
      : 0

  // ─── Evolução mensal (últimos 6 meses) ────────────────────────────────
  const monthlyEvolution = useMemo(() => {
    const now = new Date()
    const months: { label: string; key: string; concluidas: number; atrasadas: number; pendentes: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`
      const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
      months.push({
        label: `${monthNames[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`,
        key,
        concluidas: 0,
        atrasadas: 0,
        pendentes: 0,
      })
    }

    for (const o of obligations) {
      const oblDate = new Date(o.calculatedDueDate)
      const key = `${oblDate.getFullYear()}-${String(oblDate.getMonth() + 1).padStart(2, "0")}`
      const month = months.find((m) => m.key === key)
      if (!month) continue
      // Aplica filtro de cliente/esfera
      if (clientFilter !== "all" && o.clientId !== clientFilter) continue
      if (scopeFilter !== "all" && o.scope !== scopeFilter) continue
      const eff = effectiveStatus(o)
      if (eff === "completed") month.concluidas++
      else if (eff === "overdue") month.atrasadas++
      else month.pendentes++
    }
    return months
  }, [obligations, clientFilter, scopeFilter])

  // ─── Top clientes problemáticos ───────────────────────────────────────
  const topProblematicClients = useMemo(() => {
    const map = new Map<string, { client: Client | undefined; clientId: string; overdue: number; pending: number; total: number }>()
    for (const o of filteredObligations) {
      if (!map.has(o.clientId)) {
        map.set(o.clientId, {
          client: o.client,
          clientId: o.clientId,
          overdue: 0,
          pending: 0,
          total: 0,
        })
      }
      const entry = map.get(o.clientId)!
      entry.total++
      const eff = effectiveStatus(o)
      if (eff === "overdue") entry.overdue++
      else if (eff === "pending") entry.pending++
    }
    return [...map.values()]
      .filter((e) => e.overdue > 0 || e.pending > 0)
      .sort((a, b) => b.overdue * 2 + b.pending - (a.overdue * 2 + a.pending))
      .slice(0, 5)
  }, [filteredObligations])

  // ─── byClient / byTax / byRecurrence (mantido) ─────────────────────────
  const byClient = useMemo(() => {
    const map = new Map<string, { clientId: string; clientName: string; total: number; completed: number; pending: number; inProgress: number; overdue: number }>()
    for (const o of filteredObligations) {
      const id = o.clientId
      if (!map.has(id)) {
        map.set(id, {
          clientId: id,
          clientName: o.client.name,
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          overdue: 0,
        })
      }
      const entry = map.get(id)!
      entry.total++
      const eff = effectiveStatus(o)
      if (eff === "completed") entry.completed++
      else if (eff === "in_progress") entry.inProgress++
      else if (eff === "overdue") entry.overdue++
      else entry.pending++
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filteredObligations])

  const byRecurrence = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of filteredObligations) {
      const r = getRecurrenceDescription(o)
      map[r] = (map[r] || 0) + 1
    }
    return map
  }, [filteredObligations])

  const byTax = useMemo(() => {
    const map: Record<string, { total: number; completed: number; overdue: number }> = {}
    for (const o of filteredObligations) {
      const taxName = o.tax?.name || "Sem imposto vinculado"
      if (!map[taxName]) map[taxName] = { total: 0, completed: 0, overdue: 0 }
      map[taxName].total++
      const eff = effectiveStatus(o)
      if (eff === "completed") map[taxName].completed++
      if (eff === "overdue") map[taxName].overdue++
    }
    return map
  }, [filteredObligations])

  // Visão geral combinada
  const taxesCompleted = taxes.filter((t) => t.status === "completed").length
  const installmentsCompleted = installments.filter((i) => i.status === "completed").length
  const totalAll = filteredObligations.length + taxes.length + installments.length
  const totalCompletedAll = stats.completed.length + taxesCompleted + installmentsCompleted
  const overallRate = totalAll > 0 ? Math.round((totalCompletedAll / totalAll) * 100) : 0

  // Empty state
  if (filteredObligations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">Relatórios</h2>
            <p className="text-sm text-muted-foreground">Análise de produtividade e desempenho fiscal</p>
          </div>
          <PeriodSelect value={periodFilter} onChange={setPeriodFilter} />
        </div>
        <div className="border-2 border-dashed rounded-xl py-16 px-6 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhuma obrigação no período</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {periodFilter === "all"
              ? "Cadastre clientes e aplique templates para gerar obrigações e ver os relatórios."
              : "Tente outro período no filtro acima ou cadastre novas obrigações."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Análise de Desempenho</h2>
          <p className="text-muted-foreground">Métricas e indicadores de produtividade</p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="size-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[160px]">
              <Layers className="size-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as esferas</SelectItem>
              <SelectItem value="federal">Federal</SelectItem>
              <SelectItem value="estadual">Estadual</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
            </SelectContent>
          </Select>
          <PeriodSelect value={periodFilter} onChange={setPeriodFilter} />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="size-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Visão Geral Combinada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Visão Geral (Obrigações + Guias + Parcelamentos)</CardTitle>
          <CardDescription>
            {totalCompletedAll} de {totalAll} concluídos no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Taxa global</p>
              <p className="text-2xl font-bold">{overallRate}%</p>
              <Progress value={overallRate} className="mt-2 h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Obrigações no período</p>
                {previousFilteredCount !== null && (
                  <DeltaBadge current={filteredObligations.length} previous={previousFilteredCount} />
                )}
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {stats.completed.length}/{filteredObligations.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Guias de Imposto</p>
              <p className="text-2xl font-bold tabular-nums">
                {taxesCompleted}/{taxes.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parcelamentos</p>
              <p className="text-2xl font-bold tabular-nums">
                {installmentsCompleted}/{installments.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Concluídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.completed.length}</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{completionRate}% do total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="size-4 text-blue-600" />
              No Prazo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{completedOnTime.length}</div>
            <Progress value={onTimeRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{onTimeRate}% das concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="size-4 text-blue-600" />
              Em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.inProgress.length}</div>
            <p className="text-xs text-muted-foreground mt-3">
              {filteredObligations.length > 0
                ? Math.round((stats.inProgress.length / filteredObligations.length) * 100)
                : 0}
              % do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4 text-gray-600" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.pending.length}</div>
            <p className="text-xs text-muted-foreground mt-3">Aguardando início</p>
          </CardContent>
        </Card>

        <Card className={stats.overdue.length > 0 ? "ring-2 ring-red-500/30" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600" />
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-red-600">{stats.overdue.length}</div>
            <p className="text-xs text-muted-foreground mt-3">Requerem atenção imediata</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolução mensal (últimos 6 meses) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Evolução nos últimos 6 meses
          </CardTitle>
          <CardDescription>Distribuição mensal de obrigações por status</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyEvolution}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "12px",
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
              <Bar dataKey="concluidas" stackId="a" fill="#10b981" name="Concluídas" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pendentes" stackId="a" fill="#f59e0b" name="Pendentes" radius={[0, 0, 0, 0]} />
              <Bar dataKey="atrasadas" stackId="a" fill="#ef4444" name="Atrasadas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 5 clientes problemáticos */}
      {topProblematicClients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600" />
              Clientes que precisam de atenção
            </CardTitle>
            <CardDescription>Top 5 com mais atrasos e pendências (clique pra ver detalhes)</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {topProblematicClients.map((entry, idx) => (
                <li key={entry.clientId}>
                  <Link
                    href={`/obrigacoes?clientId=${entry.clientId}`}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/50 transition-colors group"
                  >
                    <div
                      className={`shrink-0 size-8 rounded-md flex items-center justify-center text-sm font-bold ${
                        idx === 0
                          ? "bg-red-500/10 text-red-600"
                          : idx === 1
                            ? "bg-orange-500/10 text-orange-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.client?.name ?? "Cliente"}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {entry.overdue > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {entry.overdue} atrasada{entry.overdue > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {entry.pending > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {entry.pending} pendente{entry.pending > 1 ? "s" : ""}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">de {entry.total} total</span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Relatórios Detalhados */}
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">Por Cliente</TabsTrigger>
          <TabsTrigger value="tax">Por Imposto</TabsTrigger>
          <TabsTrigger value="recurrence">Por Recorrência</TabsTrigger>
          <TabsTrigger value="completed">Finalizadas</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Obrigações por Cliente</CardTitle>
              <CardDescription>Clique no cliente pra ver as obrigações dele</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {byClient.map((entry) => (
                  <Link
                    key={entry.clientId}
                    href={`/obrigacoes?clientId=${entry.clientId}`}
                    className="block space-y-2 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.clientName}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{entry.total} obrigações</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">{entry.completed} concluídas</Badge>
                      <Badge className="bg-blue-600 hover:bg-blue-700">{entry.inProgress} em andamento</Badge>
                      <Badge variant="secondary">{entry.pending} pendentes</Badge>
                      {entry.overdue > 0 && <Badge variant="destructive">{entry.overdue} atrasadas</Badge>}
                    </div>
                    <Progress value={(entry.completed / entry.total) * 100} className="h-2" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Obrigações por Tipo de Imposto</CardTitle>
              <CardDescription>Distribuição por categoria fiscal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(byTax)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([tax, t]) => (
                    <div key={tax} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tax}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">{t.total} obrigações</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge className="bg-emerald-600 hover:bg-emerald-700">{t.completed} concluídas</Badge>
                        {t.overdue > 0 && <Badge variant="destructive">{t.overdue} atrasadas</Badge>}
                        <Badge variant="secondary">{t.total - t.completed - t.overdue} em aberto</Badge>
                      </div>
                      <Progress value={(t.completed / t.total) * 100} className="h-2" />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurrence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Obrigações por Tipo de Recorrência</CardTitle>
              <CardDescription>Distribuição por frequência de vencimento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(byRecurrence)
                  .sort(([, a], [, b]) => b - a)
                  .map(([recurrence, count]) => (
                    <div key={recurrence} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">{recurrence}</span>
                      <Badge variant="outline">{count} obrigações</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Obrigações Finalizadas</CardTitle>
              <CardDescription>
                Histórico de tarefas concluídas
                {stats.completed.length > 50 && ` (mostrando 50 mais recentes de ${stats.completed.length})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.completed.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma obrigação concluída ainda</p>
                ) : (
                  stats.completed
                    .slice()
                    .sort((a, b) => {
                      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
                      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
                      return db - da
                    })
                    .slice(0, 50)
                    .map((obl) => (
                      <Link
                        key={obl.id}
                        href={`/obrigacoes?clientId=${obl.clientId}&obligationId=${obl.id}`}
                        className="flex items-start justify-between p-3 border rounded-lg hover:border-primary/40 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium truncate">{obl.name}</div>
                          <div className="text-sm text-muted-foreground truncate">{obl.client.name}</div>
                          {obl.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              Concluída em: {formatDate(obl.completedAt.split("T")[0])}
                            </div>
                          )}
                        </div>
                        <Badge className="bg-emerald-600 mt-1 shrink-0">
                          <CheckCircle2 className="size-3 mr-1" />
                          Concluída
                        </Badge>
                      </Link>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Subcomponente do Period Select ──────────────────────────────────────

function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <Calendar className="size-3.5 mr-1.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os períodos</SelectItem>
        <SelectItem value="this_month">Este mês</SelectItem>
        <SelectItem value="last_month">Mês passado</SelectItem>
        <SelectItem value="this_quarter">Este trimestre</SelectItem>
        <SelectItem value="this_year">Este ano</SelectItem>
      </SelectContent>
    </Select>
  )
}
