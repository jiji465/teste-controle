"use client"

/**
 * ReportsPanel — reformulação ousada.
 *
 * Mudanças vs. versão anterior:
 *   - Filtros expandidos (date range + multi-cliente + multi-status + esfera)
 *   - SEM tabs — todas as seções renderizam verticalmente com âncoras
 *   - Compliance score por cliente (A/B/C)
 *   - Tempo médio de conclusão
 *   - Heatmap de vencimentos do mês
 *   - Comparativo ano anterior
 *   - Evolução 12 meses (era 6) com taxa de conclusão sobreposta
 *   - Reusa RegimeDistributionChart pra dar contexto
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Printer,
  Download,
  BarChart3,
  CreditCard,
  Award,
  Hourglass,
  CalendarHeart,
  Activity,
} from "lucide-react"
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts"
import { exportMultiSheetXlsx, timestampFilename } from "@/lib/export-utils"
import { TAX_REGIME_LABELS } from "@/lib/types"
import type { ObligationWithDetails, Tax, Installment, Client } from "@/lib/types"
import { formatDate, buildSafeDate, adjustForWeekend, calculateDueDateFromCompetency } from "@/lib/date-utils"
import { effectiveStatus } from "@/lib/obligation-status"
import { getRecurrenceDescription } from "@/lib/recurrence-utils"
import {
  obligationsInRange,
  taxesInRange,
  installmentsInRange,
  monthlyEvolutionBuckets,
} from "@/lib/dashboard-utils"
import { dateInRange } from "@/lib/date-range"
import { RelatoriosFilters, loadStoredFilters, type RelatoriosFilterState } from "./relatorios-filters"
import { ComplianceScoreList } from "./compliance-score-list"
import { AvgCompletionTime } from "./avg-completion-time"
import { HeatmapVencimentos } from "./heatmap-vencimentos"
import { YoYComparison } from "./yoy-comparison"

type Props = {
  obligations: ObligationWithDetails[]
  taxes?: Tax[]
  installments?: Installment[]
  clients?: Client[]
}

// Status type used by filters
type FilterStatus = "pending" | "in_progress" | "completed" | "overdue"

export function ReportsPanel({
  obligations,
  taxes = [],
  installments = [],
  clients = [],
}: Props) {
  // Inicializa do localStorage (resolve preset → range)
  const [filters, setFilters] = useState<RelatoriosFilterState>(() => loadStoredFilters())

  // Estado de "ver todos" pra listas longas — colapsa por padrão pra reduzir
  // o tamanho vertical da página (sem isso a página fica enorme).
  const [showAllByClient, setShowAllByClient] = useState(false)
  const [showAllByTax, setShowAllByTax] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  // ─── Aplica filtros ─────────────────────────────────────────────────────
  const filteredObligations = useMemo(() => {
    let result = obligationsInRange(obligations, filters.range)
    if (filters.clientIds.length > 0) {
      const set = new Set(filters.clientIds)
      result = result.filter((o) => set.has(o.clientId))
    }
    if (filters.scope !== "all") {
      result = result.filter((o) => o.scope === filters.scope)
    }
    if (filters.statuses.length > 0) {
      const set = new Set<FilterStatus>(filters.statuses)
      result = result.filter((o) => set.has(effectiveStatus(o) as FilterStatus))
    }
    return result
  }, [obligations, filters])

  const filteredTaxes = useMemo(() => {
    let result = taxesInRange(taxes, filters.range)
    if (filters.clientIds.length > 0) {
      const set = new Set(filters.clientIds)
      result = result.filter((t) => t.clientId && set.has(t.clientId))
    }
    if (filters.scope !== "all") {
      result = result.filter((t) => t.scope === filters.scope)
    }
    if (filters.statuses.length > 0) {
      const set = new Set<FilterStatus>(filters.statuses)
      result = result.filter((t) => {
        const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
        return set.has(effectiveStatus({ status: t.status, calculatedDueDate: d ?? undefined }) as FilterStatus)
      })
    }
    return result
  }, [taxes, filters])

  const filteredInstallments = useMemo(() => {
    let result = installmentsInRange(installments, filters.range)
    if (filters.clientIds.length > 0) {
      const set = new Set(filters.clientIds)
      result = result.filter((i) => set.has(i.clientId))
    }
    if (filters.statuses.length > 0) {
      const set = new Set<FilterStatus>(filters.statuses)
      result = result.filter((i) => {
        const firstDue = new Date(i.firstDueDate)
        const monthsToAdd = i.currentInstallment - 1
        const due = adjustForWeekend(
          buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay),
          i.weekendRule,
        )
        return set.has(effectiveStatus({ status: i.status, calculatedDueDate: due }) as FilterStatus)
      })
    }
    return result
  }, [installments, filters])

  // Stats consolidadas
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

  const taxesCompleted = filteredTaxes.filter((t) => t.status === "completed").length
  const installmentsCompleted = filteredInstallments.filter((i) => i.status === "completed").length
  const totalAll = filteredObligations.length + filteredTaxes.length + filteredInstallments.length
  const totalCompletedAll = stats.completed.length + taxesCompleted + installmentsCompleted
  const overallRate = totalAll > 0 ? Math.round((totalCompletedAll / totalAll) * 100) : 0

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

  // Evolução 12 meses (com taxa de conclusão) — sempre baseado em ref=hoje
  const monthlyEvolution = useMemo(
    () =>
      monthlyEvolutionBuckets(
        obligations,
        taxes,
        installments,
        12,
        new Date(),
        filters.clientIds,
      ),
    [obligations, taxes, installments, filters.clientIds],
  )

  // Mês para heatmap: usa o "to" do range se existir, senão hoje
  const heatmapMonthKey = useMemo(() => {
    const date = filters.range.to ? new Date(filters.range.to) : new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }, [filters.range.to])

  // ─── Por Cliente / Por Imposto / Por Recorrência (mantidos) ─────────────
  const byClient = useMemo(() => {
    const map = new Map<
      string,
      { clientId: string; clientName: string; total: number; completed: number; pending: number; inProgress: number; overdue: number }
    >()
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

  // Parcelamentos do período
  const installmentsInPeriod = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return filteredInstallments
      .map((inst) => {
        const firstDue = new Date(inst.firstDueDate)
        const monthsToAdd = inst.currentInstallment - 1
        const dueDate = buildSafeDate(
          firstDue.getFullYear(),
          firstDue.getMonth() + monthsToAdd,
          inst.dueDay,
        )
        const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)
        let effStatus: "completed" | "overdue" | "pending"
        if (inst.status === "completed") effStatus = "completed"
        else if (adjustedDueDate < today) effStatus = "overdue"
        else effStatus = "pending"
        return { inst, dueDate: adjustedDueDate, effStatus }
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [filteredInstallments])

  // ─── Excel export ───────────────────────────────────────────────────────
  const handleExportExcel = () => {
    type ResumoRow = { metrica: string; valor: string | number }
    const resumoRows: ResumoRow[] = [
      { metrica: "Período do filtro", valor: filters.range.from && filters.range.to
          ? `${filters.range.from} → ${filters.range.to}`
          : "Todos os períodos" },
      { metrica: "Clientes filtrados", valor: filters.clientIds.length === 0 ? "Todos" : filters.clientIds.length },
      { metrica: "Esfera filtrada", valor: filters.scope === "all" ? "Todas" : filters.scope },
      { metrica: "Status filtrados", valor: filters.statuses.length === 0 ? "Todos" : filters.statuses.join(", ") },
      { metrica: "Total de obrigações", valor: filteredObligations.length },
      { metrica: "Concluídas", valor: stats.completed.length },
      { metrica: "Em andamento", valor: stats.inProgress.length },
      { metrica: "Pendentes", valor: stats.pending.length },
      { metrica: "Atrasadas", valor: stats.overdue.length },
      { metrica: "Taxa de conclusão (%)", valor: filteredObligations.length > 0
          ? Math.round((stats.completed.length / filteredObligations.length) * 100)
          : 0 },
      { metrica: "Taxa no prazo (%)", valor: onTimeRate },
      { metrica: "Total de guias de imposto", valor: filteredTaxes.length },
      { metrica: "Guias concluídas", valor: taxesCompleted },
      { metrica: "Total de parcelamentos", valor: filteredInstallments.length },
      { metrica: "Parcelamentos concluídos", valor: installmentsCompleted },
      { metrica: "Taxa global combinada (%)", valor: overallRate },
    ]

    const formatDateBr = (d: string | Date | undefined) => {
      if (!d) return ""
      const date = typeof d === "string" ? new Date(d) : d
      return date.toLocaleDateString("pt-BR")
    }

    exportMultiSheetXlsx({
      filename: timestampFilename("relatorio_fiscal"),
      sheets: [
        {
          name: "Resumo",
          columns: [
            { header: "Métrica", width: 32, accessor: (r: ResumoRow) => r.metrica },
            { header: "Valor", width: 30, accessor: (r: ResumoRow) => r.valor },
          ],
          rows: resumoRows,
        },
        {
          name: "Por Cliente",
          columns: [
            { header: "Cliente", width: 32, accessor: (r: typeof byClient[number]) => r.clientName },
            { header: "Total", width: 8, accessor: (r) => r.total },
            { header: "Concluídas", width: 12, accessor: (r) => r.completed },
            { header: "Em andamento", width: 14, accessor: (r) => r.inProgress },
            { header: "Pendentes", width: 12, accessor: (r) => r.pending },
            { header: "Atrasadas", width: 12, accessor: (r) => r.overdue },
            {
              header: "Taxa conclusão (%)",
              width: 18,
              accessor: (r) => (r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0),
            },
          ],
          rows: byClient,
        },
        {
          name: "Por Imposto",
          columns: [
            { header: "Imposto", width: 32, accessor: ([name]: [string, { total: number; completed: number; overdue: number }]) => name },
            { header: "Total", width: 10, accessor: ([, t]) => t.total },
            { header: "Concluídas", width: 12, accessor: ([, t]) => t.completed },
            { header: "Atrasadas", width: 12, accessor: ([, t]) => t.overdue },
          ],
          rows: Object.entries(byTax).sort(([, a], [, b]) => b.total - a.total),
        },
        {
          name: "Por Recorrência",
          columns: [
            { header: "Recorrência", width: 28, accessor: ([name]: [string, number]) => name },
            { header: "Quantidade", width: 14, accessor: ([, n]) => n },
          ],
          rows: Object.entries(byRecurrence).sort(([, a], [, b]) => b - a),
        },
        {
          name: "Evolução 12 meses",
          columns: [
            { header: "Mês", width: 12, accessor: (r: typeof monthlyEvolution[number]) => r.label },
            { header: "Concluídas", width: 12, accessor: (r) => r.concluidas },
            { header: "Pendentes", width: 12, accessor: (r) => r.pendentes },
            { header: "Atrasadas", width: 12, accessor: (r) => r.atrasadas },
            { header: "Total", width: 10, accessor: (r) => r.concluidas + r.pendentes + r.atrasadas },
            { header: "Taxa conclusão (%)", width: 18, accessor: (r) => r.completionRate },
          ],
          rows: monthlyEvolution,
        },
        {
          name: "Concluídas",
          columns: [
            { header: "Obrigação", width: 32, accessor: (o: ObligationWithDetails) => o.name },
            { header: "Cliente", width: 28, accessor: (o) => o.client.name },
            { header: "CNPJ", width: 18, accessor: (o) => o.client.cnpj || "" },
            {
              header: "Regime",
              width: 18,
              accessor: (o) => (o.client.taxRegime ? TAX_REGIME_LABELS[o.client.taxRegime as keyof typeof TAX_REGIME_LABELS] : ""),
            },
            { header: "Esfera", width: 12, accessor: (o) => o.scope ?? "" },
            { header: "Vencimento", width: 14, accessor: (o) => formatDateBr(o.calculatedDueDate) },
            { header: "Concluída em", width: 14, accessor: (o) => (o.completedAt ? formatDateBr(o.completedAt) : "") },
            { header: "Competência", width: 12, accessor: (o) => o.competencyMonth ?? "" },
          ],
          rows: stats.completed
            .slice()
            .sort((a, b) => {
              const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
              const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
              return db - da
            }),
        },
        {
          name: "Atrasadas",
          columns: [
            { header: "Obrigação", width: 32, accessor: (o: ObligationWithDetails) => o.name },
            { header: "Cliente", width: 28, accessor: (o) => o.client.name },
            { header: "CNPJ", width: 18, accessor: (o) => o.client.cnpj || "" },
            { header: "Esfera", width: 12, accessor: (o) => o.scope ?? "" },
            { header: "Prioridade", width: 12, accessor: (o) => o.priority },
            { header: "Vencimento", width: 14, accessor: (o) => formatDateBr(o.calculatedDueDate) },
            { header: "Competência", width: 12, accessor: (o) => o.competencyMonth ?? "" },
          ],
          rows: stats.overdue,
        },
      ],
    })
  }

  // ─── Empty state ────────────────────────────────────────────────────────
  if (totalAll === 0) {
    return (
      <div className="space-y-4">
        <RelatoriosFilters clients={clients} value={filters} onChange={setFilters} />
        <div className="border-2 border-dashed rounded-xl py-16 px-6 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhum dado nos filtros atuais</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Ajuste os filtros acima ou cadastre obrigações/guias/parcelamentos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barra de filtros — sempre visível no topo */}
      <RelatoriosFilters clients={clients} value={filters} onChange={setFilters} />

      {/* Botões de ação */}
      <div className="flex items-center justify-end gap-2 no-print">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
          <Download className="size-4" /> Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      {/* Navegação por âncoras */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs no-print" aria-label="Navegação rápida">
        <span className="text-muted-foreground">Pular pra:</span>
        {[
          { href: "#resumo", label: "Resumo" },
          { href: "#evolucao", label: "Evolução" },
          { href: "#compliance", label: "Compliance" },
          { href: "#heatmap", label: "Picos do mês" },
          { href: "#cliente", label: "Por Cliente" },
          { href: "#imposto", label: "Por Imposto" },
          { href: "#parcelamentos", label: "Parcelamentos" },
          { href: "#concluidas", label: "Concluídas" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="px-2 py-0.5 rounded-full border border-border hover:bg-muted transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {/* ─── RESUMO ─── */}
      <section id="resumo" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" /> Resumo Geral
        </h2>

        {/* Visão Geral Combinada */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Combinado</CardTitle>
            <CardDescription className="text-xs">
              {totalCompletedAll} de {totalAll} concluídos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Taxa global</p>
                <p className="text-2xl font-bold">{overallRate}%</p>
                <Progress value={overallRate} className="mt-2 h-1.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Obrigações</p>
                <p className="text-2xl font-bold tabular-nums">
                  {stats.completed.length}/{filteredObligations.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Guias de Imposto</p>
                <p className="text-2xl font-bold tabular-nums">
                  {taxesCompleted}/{filteredTaxes.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parcelamentos</p>
                <p className="text-2xl font-bold tabular-nums">
                  {installmentsCompleted}/{filteredInstallments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards — incluindo Tempo Médio e YoY */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" /> Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats.completed.length}</p>
              <Progress
                value={filteredObligations.length > 0 ? (stats.completed.length / filteredObligations.length) * 100 : 0}
                className="mt-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-blue-600" /> No Prazo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{completedOnTime.length}</p>
              <Progress value={onTimeRate} className="mt-2" />
              <p className="text-[11px] text-muted-foreground mt-1">{onTimeRate}% das concluídas</p>
            </CardContent>
          </Card>
          <AvgCompletionTime
            obligations={filteredObligations}
            taxes={filteredTaxes}
            installments={filteredInstallments}
          />
          <YoYComparison
            obligations={obligations}
            taxes={taxes}
            installments={installments}
            range={filters.range}
          />
        </div>

        {/* Status detalhado */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="size-4 text-blue-600" /> Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats.inProgress.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hourglass className="size-4 text-amber-600" /> Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats.pending.length}</p>
            </CardContent>
          </Card>
          <Card className={stats.overdue.length > 0 ? "ring-2 ring-red-500/30" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-600" /> Atrasadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-red-600">{stats.overdue.length}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── EVOLUÇÃO 12 MESES + linha de taxa ─── */}
      <section id="evolucao" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" /> Evolução nos últimos 12 meses
            </CardTitle>
            <CardDescription className="text-xs">
              Barras: contagem por status. Linha: taxa de conclusão (%).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis yAxisId="left" allowDecimals={false} className="text-xs" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  className="text-xs"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    fontSize: "12px",
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
                <Bar yAxisId="left" dataKey="concluidas" stackId="a" fill="#10b981" name="Concluídas" />
                <Bar yAxisId="left" dataKey="pendentes" stackId="a" fill="#f59e0b" name="Pendentes" />
                <Bar yAxisId="left" dataKey="atrasadas" stackId="a" fill="#ef4444" name="Atrasadas" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Taxa conclusão %"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* ─── COMPLIANCE SCORE ─── */}
      <section id="compliance" className="scroll-mt-20">
        <ComplianceScoreList
          clients={clients}
          obligations={obligations}
          taxes={taxes}
          installments={installments}
        />
      </section>

      {/* ─── HEATMAP DE PICOS ─── */}
      <section id="heatmap" className="scroll-mt-20">
        <HeatmapVencimentos
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          monthKey={heatmapMonthKey}
        />
      </section>

      {/* ─── PARCELAMENTOS NO PERÍODO ─── */}
      <section id="parcelamentos" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="size-4 text-amber-600" />
                  Parcelamentos no período
                </CardTitle>
                <CardDescription className="text-xs">
                  Parcelas em ordem de vencimento
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {installmentsInPeriod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma parcela no período/filtro.
              </p>
            ) : (
              <div className="overflow-auto rounded-lg border max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Parcelamento</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium text-center w-20">Parcela</th>
                      <th className="px-3 py-2 font-medium w-28">Vencimento</th>
                      <th className="px-3 py-2 font-medium w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installmentsInPeriod.map(({ inst, dueDate, effStatus }) => {
                      const client = clients.find((c) => c.id === inst.clientId)
                      return (
                        <tr
                          key={inst.id}
                          className={`border-t hover:bg-muted/30 transition-colors ${
                            effStatus === "overdue" ? "bg-red-50/40 dark:bg-red-950/10" : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            <Link
                              href={`/parcelamentos?clientId=${inst.clientId}`}
                              className="font-medium hover:underline"
                            >
                              {inst.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{client?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums">
                            {inst.currentInstallment}/{inst.installmentCount}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums">{formatDate(dueDate)}</td>
                          <td className="px-3 py-2">
                            {effStatus === "completed" ? (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white">
                                <CheckCircle2 className="size-3 mr-1" /> Paga
                              </Badge>
                            ) : effStatus === "overdue" ? (
                              <Badge variant="destructive">
                                <AlertTriangle className="size-3 mr-1" /> Atrasada
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="size-3 mr-1" /> Pendente
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── POR CLIENTE ─── */}
      <section id="cliente" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obrigações por Cliente</CardTitle>
            <CardDescription className="text-xs">Clique pra ver as obrigações do cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`space-y-3 ${showAllByClient ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
              {(showAllByClient ? byClient : byClient.slice(0, 5)).map((entry) => (
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
              {byClient.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma obrigação no filtro atual.
                </p>
              )}
            </div>
            {byClient.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllByClient(!showAllByClient)}
                className="w-full mt-3 text-xs"
              >
                {showAllByClient ? "Mostrar menos" : `Ver todos os ${byClient.length} clientes`}
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── POR IMPOSTO ─── */}
      <section id="imposto" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obrigações por Tipo de Imposto</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const sortedTaxEntries = Object.entries(byTax).sort(([, a], [, b]) => b.total - a.total)
              const visibleTaxes = showAllByTax ? sortedTaxEntries : sortedTaxEntries.slice(0, 5)
              return (
                <>
                  <div className={`space-y-4 ${showAllByTax ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
                    {visibleTaxes.map(([tax, t]) => (
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
                    {sortedTaxEntries.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma obrigação no filtro atual.
                      </p>
                    )}
                  </div>
                  {sortedTaxEntries.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllByTax(!showAllByTax)}
                      className="w-full mt-3 text-xs"
                    >
                      {showAllByTax ? "Mostrar menos" : `Ver todos os ${sortedTaxEntries.length} impostos`}
                    </Button>
                  )}
                </>
              )
            })()}
          </CardContent>
        </Card>

        {/* Recorrência — compacto, em chips ao invés de cards grandes */}
        <Card className="mt-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por Recorrência</CardTitle>
            <CardDescription className="text-xs">Frequências usadas pelas obrigações no filtro</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(byRecurrence).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Sem dados no filtro atual.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byRecurrence)
                  .sort(([, a], [, b]) => b - a)
                  .map(([recurrence, count]) => (
                    <Badge
                      key={recurrence}
                      variant="outline"
                      className="text-xs gap-1.5 py-1 px-2.5"
                    >
                      {recurrence}
                      <span className="font-bold tabular-nums">{count}</span>
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── CONCLUÍDAS ─── */}
      <section id="concluidas" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-emerald-600" /> Obrigações Finalizadas
            </CardTitle>
            <CardDescription className="text-xs">
              {showAllCompleted
                ? stats.completed.length > 50
                  ? `50 mais recentes de ${stats.completed.length}`
                  : `${stats.completed.length} no filtro`
                : `${Math.min(5, stats.completed.length)} mais recentes${
                    stats.completed.length > 5 ? ` de ${stats.completed.length}` : ""
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.completed.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Nenhuma obrigação concluída ainda.
              </p>
            ) : (
              <>
                <div className={`space-y-2 ${showAllCompleted ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
                  {stats.completed
                    .slice()
                    .sort((a, b) => {
                      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
                      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
                      return db - da
                    })
                    .slice(0, showAllCompleted ? 50 : 5)
                    .map((obl) => (
                      <Link
                        key={obl.id}
                        href={`/obrigacoes?clientId=${obl.clientId}&obligationId=${obl.id}`}
                        className="flex items-start justify-between p-3 border rounded-lg hover:border-primary/40 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-medium truncate">{obl.name}</div>
                          <div className="text-sm text-muted-foreground truncate">{obl.client.name}</div>
                          {obl.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              Concluída em: {formatDate(obl.completedAt)}
                            </div>
                          )}
                        </div>
                        <Badge className="bg-emerald-600 mt-1 shrink-0">
                          <CheckCircle2 className="size-3 mr-1" /> Concluída
                        </Badge>
                      </Link>
                    ))}
                </div>
                {stats.completed.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCompleted(!showAllCompleted)}
                    className="w-full mt-3 text-xs"
                  >
                    {showAllCompleted
                      ? "Mostrar menos"
                      : `Ver últimas ${Math.min(50, stats.completed.length)}`}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
