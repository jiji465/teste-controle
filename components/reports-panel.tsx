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
  Download,
  CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { exportMultiSheetXlsx, timestampFilename, type ExportColumn } from "@/lib/export-utils"
import { TAX_REGIME_LABELS } from "@/lib/types"
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
import { formatDate, buildSafeDate, adjustForWeekend, calculateDueDateFromCompetency } from "@/lib/date-utils"
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
  // "global" = usa o PeriodSwitcher do topo da página
  // "all" / "this_month" / "last_month" / "this_quarter" / "this_year" = filtro local
  const [periodFilter, setPeriodFilter] = useState<string>("global")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [scopeFilter, setScopeFilter] = useState<string>("all")
  const { period: globalPeriod, periodLabel: globalLabel, isInPeriod: isInGlobalPeriod, isFiltering: globalIsFiltering } =
    useSelectedPeriod()

  // Função de filtro principal — quando 'global', usa o PeriodSwitcher
  const passesPeriodFilter = (date: Date): boolean => {
    if (periodFilter === "global") {
      // Se o switcher está em "all", deixa passar tudo
      if (!globalIsFiltering) return true
      return isInGlobalPeriod(date)
    }
    return isInPeriodFilter(date, periodFilter)
  }

  // Filtra por período + cliente + esfera
  const filteredObligations = useMemo(() => {
    return obligations.filter((obl) => {
      const oblDate = new Date(obl.calculatedDueDate)
      if (!passesPeriodFilter(oblDate)) return false
      if (clientFilter !== "all" && obl.clientId !== clientFilter) return false
      if (scopeFilter !== "all" && obl.scope !== scopeFilter) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obligations, periodFilter, clientFilter, scopeFilter, globalPeriod])

  // Comparativo: mesmas obrigações, mas no período anterior
  const previousFilteredCount = useMemo(() => {
    if (periodFilter === "global") {
      // Pra "global", só dá pra comparar mês-a-mês — mesmo mês do mês anterior
      if (!globalIsFiltering) return null
      const m = globalPeriod.match(/^(\d{4})-(\d{2})$/)
      if (!m) return null
      const y = Number(m[1])
      const mo = Number(m[2])
      const prevY = mo === 1 ? y - 1 : y
      const prevMo = mo === 1 ? 12 : mo - 1
      const prevKey = `${prevY}-${String(prevMo).padStart(2, "0")}`
      return obligations.filter((obl) => {
        const d = new Date(obl.calculatedDueDate)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (k !== prevKey) return false
        if (clientFilter !== "all" && obl.clientId !== clientFilter) return false
        if (scopeFilter !== "all" && obl.scope !== scopeFilter) return false
        return true
      }).length
    }
    const prevRef = previousPeriodRef(periodFilter)
    if (!prevRef) return null
    return obligations.filter((obl) => {
      const oblDate = new Date(obl.calculatedDueDate)
      if (!isInPeriodFilter(oblDate, periodFilter, prevRef)) return false
      if (clientFilter !== "all" && obl.clientId !== clientFilter) return false
      if (scopeFilter !== "all" && obl.scope !== scopeFilter) return false
      return true
    }).length
  }, [obligations, periodFilter, clientFilter, scopeFilter, globalPeriod, globalIsFiltering])

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

  // ─── Parcelamentos: parcelas vencendo no período filtrado ────────────
  // Calcula a data da PARCELA ATUAL de cada parcelamento (1 registro = N parcelas).
  // Aplica os mesmos filtros de período/cliente do resto do painel.
  // Não usa scopeFilter porque parcelamento não tem campo "scope".
  const installmentsInPeriod = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return installments
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
      .filter(({ dueDate, inst }) => {
        if (!passesPeriodFilter(dueDate)) return false
        if (clientFilter !== "all" && inst.clientId !== clientFilter) return false
        return true
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, periodFilter, clientFilter, globalPeriod, globalIsFiltering])

  const installmentPeriodStats = useMemo(() => {
    const paid = installmentsInPeriod.filter((x) => x.effStatus === "completed")
    const overdue = installmentsInPeriod.filter((x) => x.effStatus === "overdue")
    const pending = installmentsInPeriod.filter((x) => x.effStatus === "pending")
    return { paid, overdue, pending, total: installmentsInPeriod.length }
  }, [installmentsInPeriod])

  // Visão geral combinada — aplica os MESMOS filtros (período + cliente) usados
  // pra obrigações. Antes guias/parcelamentos vinham crus (totais globais),
  // o que dava cards inconsistentes (ex: filtro "Cliente X + Mar/2026"
  // mostrava obrigações filtradas e guias do universo todo lado a lado).
  const filteredTaxes = useMemo(() => {
    return taxes.filter((t) => {
      const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      // Itens sem data calculável passam (não dá pra filtrar por período).
      if (date && !passesPeriodFilter(date)) return false
      if (clientFilter !== "all" && t.clientId !== clientFilter) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxes, periodFilter, clientFilter, globalPeriod, globalIsFiltering])

  const filteredInstallmentsRaw = useMemo(() => {
    return installments.filter((i) => {
      if (clientFilter !== "all" && i.clientId !== clientFilter) return false
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay)
      const adjustedDueDate = adjustForWeekend(dueDate, i.weekendRule)
      return passesPeriodFilter(adjustedDueDate)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, periodFilter, clientFilter, globalPeriod, globalIsFiltering])

  const taxesCompleted = filteredTaxes.filter((t) => t.status === "completed").length
  const installmentsCompleted = filteredInstallmentsRaw.filter((i) => i.status === "completed").length
  const totalAll = filteredObligations.length + filteredTaxes.length + filteredInstallmentsRaw.length
  const totalCompletedAll = stats.completed.length + taxesCompleted + installmentsCompleted
  const overallRate = totalAll > 0 ? Math.round((totalCompletedAll / totalAll) * 100) : 0

  // ─── Export Excel multi-sheet ─────────────────────────────────────────
  const handleExportExcel = () => {
    const periodLabel =
      periodFilter === "global"
        ? globalIsFiltering
          ? globalLabel ?? "Todos"
          : "Todos os períodos"
        : periodFilter === "all"
          ? "Todos os períodos"
          : periodFilter === "this_month"
            ? "Este mês"
            : periodFilter === "last_month"
              ? "Mês passado"
              : periodFilter === "this_quarter"
                ? "Este trimestre"
                : "Este ano"

    const formatDateBr = (d: string | Date | undefined) => {
      if (!d) return ""
      const date = typeof d === "string" ? new Date(d) : d
      return date.toLocaleDateString("pt-BR")
    }

    type ResumoRow = { metrica: string; valor: string | number }
    const resumoRows: ResumoRow[] = [
      { metrica: "Período do filtro", valor: periodLabel },
      { metrica: "Cliente filtrado", valor: clientFilter === "all" ? "Todos" : clients.find((c) => c.id === clientFilter)?.name ?? "" },
      { metrica: "Esfera filtrada", valor: scopeFilter === "all" ? "Todas" : scopeFilter },
      { metrica: "Total de obrigações", valor: filteredObligations.length },
      { metrica: "Concluídas", valor: stats.completed.length },
      { metrica: "Em andamento", valor: stats.inProgress.length },
      { metrica: "Pendentes", valor: stats.pending.length },
      { metrica: "Atrasadas", valor: stats.overdue.length },
      { metrica: "Taxa de conclusão (%)", valor: completionRate },
      { metrica: "Concluídas no prazo", valor: completedOnTime.length },
      { metrica: "Taxa no prazo (%)", valor: onTimeRate },
      { metrica: "Total de guias de imposto", valor: filteredTaxes.length },
      { metrica: "Guias concluídas", valor: taxesCompleted },
      { metrica: "Total de parcelamentos", valor: filteredInstallmentsRaw.length },
      { metrica: "Parcelamentos concluídos", valor: installmentsCompleted },
      { metrica: "Taxa global combinada (%)", valor: overallRate },
    ]

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
            {
              header: "Taxa conclusão (%)",
              width: 18,
              accessor: ([, t]) => (t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0),
            },
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
          name: "Evolução Mensal",
          columns: [
            { header: "Mês", width: 12, accessor: (r: typeof monthlyEvolution[number]) => r.label },
            { header: "Concluídas", width: 12, accessor: (r) => r.concluidas },
            { header: "Pendentes", width: 12, accessor: (r) => r.pendentes },
            { header: "Atrasadas", width: 12, accessor: (r) => r.atrasadas },
            { header: "Total", width: 10, accessor: (r) => r.concluidas + r.pendentes + r.atrasadas },
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
            {
              header: "Vencimento",
              width: 14,
              accessor: (o) => formatDateBr(o.calculatedDueDate),
            },
            {
              header: "Concluída em",
              width: 14,
              accessor: (o) => (o.completedAt ? formatDateBr(o.completedAt) : ""),
            },
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
            {
              header: "Vencimento",
              width: 14,
              accessor: (o) => formatDateBr(o.calculatedDueDate),
            },
            { header: "Competência", width: 12, accessor: (o) => o.competencyMonth ?? "" },
          ],
          rows: stats.overdue,
        },
      ],
    })
  }

  // Empty state — só esconde tudo se NÃO houver obrigações E NEM parcelamentos
  // no filtro atual. Antes, ter só parcelamentos sumia o painel inteiro.
  if (filteredObligations.length === 0 && installmentsInPeriod.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">Relatórios</h2>
            <p className="text-sm text-muted-foreground">Análise de produtividade e desempenho fiscal</p>
          </div>
          <PeriodSelect value={periodFilter} onChange={setPeriodFilter} globalLabel={globalLabel} />
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
      {/* Barra de filtros + ações (o header da página vem de app/relatorios/page.tsx) */}
      <div className="flex items-center justify-end gap-2 no-print flex-wrap">
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
        <PeriodSelect value={periodFilter} onChange={setPeriodFilter} globalLabel={globalLabel} />
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
          <Download className="size-4" />
          Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" />
          Imprimir
        </Button>
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
                {taxesCompleted}/{filteredTaxes.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parcelamentos</p>
              <p className="text-2xl font-bold tabular-nums">
                {installmentsCompleted}/{filteredInstallmentsRaw.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parcelamentos no período — vista consolidada de todas as parcelas
          que vencem no filtro atual, com status individual de cada uma */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5 text-amber-600" />
                Parcelamentos no período
              </CardTitle>
              <CardDescription>
                Parcelas que caem no filtro selecionado, mostradas em ordem de vencimento
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
                <CreditCard className="size-3.5" />
                {installmentPeriodStats.total} no total
              </span>
              {installmentPeriodStats.paid.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                  <CheckCircle2 className="size-3.5" />
                  {installmentPeriodStats.paid.length} paga{installmentPeriodStats.paid.length !== 1 ? "s" : ""}
                </span>
              )}
              {installmentPeriodStats.pending.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Clock className="size-3.5" />
                  {installmentPeriodStats.pending.length} pendente{installmentPeriodStats.pending.length !== 1 ? "s" : ""}
                </span>
              )}
              {installmentPeriodStats.overdue.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  <AlertTriangle className="size-3.5" />
                  {installmentPeriodStats.overdue.length} atrasada{installmentPeriodStats.overdue.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {installmentsInPeriod.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg py-8 px-4 text-center text-sm text-muted-foreground">
              Nenhum parcelamento com parcela vencendo neste período/filtro.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
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
                            <Badge
                              variant="secondary"
                              className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
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
                              Concluída em: {formatDate(obl.completedAt)}
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

function PeriodSelect({
  value,
  onChange,
  globalLabel,
}: {
  value: string
  onChange: (v: string) => void
  globalLabel?: string | null
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <Calendar className="size-3.5 mr-1.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="global">
          📌 Filtro do topo {globalLabel ? `(${globalLabel})` : "(Todos)"}
        </SelectItem>
        <SelectItem value="all">Todos os períodos</SelectItem>
        <SelectItem value="this_month">Este mês</SelectItem>
        <SelectItem value="last_month">Mês passado</SelectItem>
        <SelectItem value="this_quarter">Este trimestre</SelectItem>
        <SelectItem value="this_year">Este ano</SelectItem>
      </SelectContent>
    </Select>
  )
}
