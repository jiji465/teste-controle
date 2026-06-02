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
import { exportRelatorioExcel } from "@/lib/report-excel"
import { exportRelatorioPdf } from "@/lib/report-pdf"
import { periodoLabel, geradoEm } from "@/lib/report-config"
import type { ReportData, ReportPendenciaRow } from "@/lib/report-types"
import { calculateClientCompliance } from "@/lib/compliance-score"
import { TAX_REGIME_LABELS } from "@/lib/types"
import { toast } from "sonner"
import type { ObligationWithDetails, Tax, Installment, Service, Client } from "@/lib/types"
import { formatDate, buildSafeDate, adjustForWeekend, calculateDueDateFromCompetency } from "@/lib/date-utils"
import { effectiveStatus } from "@/lib/obligation-status"
import { getRecurrenceDescription } from "@/lib/recurrence-utils"
import {
  obligationsInRange,
  taxesInRange,
  installmentsInRange,
  installmentParcelasInRange,
  monthlyEvolutionBuckets,
} from "@/lib/dashboard-utils"
import { dateInRange } from "@/lib/date-range"
import { RelatoriosFilters, loadStoredFilters, type RelatoriosFilterState } from "./relatorios-filters"
import { ComplianceScoreList } from "./compliance-score-list"
import { AvgCompletionTime } from "./avg-completion-time"
import { HeatmapVencimentos } from "./heatmap-vencimentos"
import { HeatmapEntregas } from "./heatmap-entregas"
import { YoYComparison } from "./yoy-comparison"

type Props = {
  obligations: ObligationWithDetails[]
  taxes?: Tax[]
  installments?: Installment[]
  services?: Service[]
  clients?: Client[]
}

// Status type used by filters
type FilterStatus = "pending" | "in_progress" | "completed" | "overdue"

export function ReportsPanel({
  obligations,
  taxes = [],
  installments = [],
  services = [],
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

  const filteredServices = useMemo(() => {
    let result = services.filter((s) => {
      if (filters.range.from || filters.range.to) {
        return dateInRange(s.dueDate, filters.range)
      }
      return true
    })
    if (filters.clientIds.length > 0) {
      const set = new Set(filters.clientIds)
      result = result.filter((s) => set.has(s.clientId))
    }
    if (filters.statuses.length > 0) {
      const set = new Set<FilterStatus>(filters.statuses)
      result = result.filter((s) =>
        set.has(effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate }) as FilterStatus),
      )
    }
    return result
  }, [services, filters])

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

  // Parcelas individuais que caem no range (1 parcelamento pode contribuir
  // com N parcelas se range é multi-mês). Antes contávamos parcelamento
  // INTEIRO como "concluído" — bug: parcelamento com 24 parcelas só virava
  // concluído quando todas 24 fossem pagas. Modelo do usuário: cada parcela
  // do mês é uma unidade de "entregue".
  const parcelasInRange = useMemo(() => {
    const out: Array<{
      inst: Installment
      parcelaNumber: number
      dueDate: Date
      status: "completed" | "overdue" | "pending"
      doneAt?: string
    }> = []
    for (const inst of filteredInstallments) {
      for (const p of installmentParcelasInRange(inst, filters.range)) {
        out.push({ inst, ...p })
      }
    }
    return out
  }, [filteredInstallments, filters.range])

  const parcelasCompleted = parcelasInRange.filter((p) => p.status === "completed").length
  const totalParcelas = parcelasInRange.length

  const servicesCompleted = filteredServices.filter((s) => s.status === "completed").length
  const totalAll =
    filteredObligations.length + filteredTaxes.length + totalParcelas + filteredServices.length
  const totalCompletedAll =
    stats.completed.length + taxesCompleted + parcelasCompleted + servicesCompleted
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
        services,
      ),
    [obligations, taxes, installments, services, filters.clientIds],
  )

  // Mês para heatmap: usa o "to" do range se existir, senão hoje
  const heatmapMonthKey = useMemo(() => {
    const date = filters.range.to ? new Date(filters.range.to) : new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }, [filters.range.to])

  // ─── Por Cliente — agora soma obrigações + guias + parcelamentos ────────
  // Antes só contava obrigações; um cliente que só tinha guias aparecia com
  // total 0 (sumia da lista). Agora cada cliente mostra total geral com
  // breakdown por tipo (obr/guia/parc) pra ficar claro de onde vem.
  const byClient = useMemo(() => {
    type Entry = {
      clientId: string
      clientName: string
      total: number
      completed: number
      pending: number
      inProgress: number
      overdue: number
      // Breakdown por tipo (só nos contadores que importam pra UI)
      obrigCount: number
      guiaCount: number
      parcCount: number
      svcCount: number
    }
    const map = new Map<string, Entry>()
    const getOrCreate = (id: string, name: string): Entry => {
      let e = map.get(id)
      if (!e) {
        e = {
          clientId: id,
          clientName: name,
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          overdue: 0,
          obrigCount: 0,
          guiaCount: 0,
          parcCount: 0,
          svcCount: 0,
        }
        map.set(id, e)
      }
      return e
    }
    // Obrigações
    for (const o of filteredObligations) {
      const e = getOrCreate(o.clientId, o.client.name)
      e.total++
      e.obrigCount++
      const eff = effectiveStatus(o)
      if (eff === "completed") e.completed++
      else if (eff === "in_progress") e.inProgress++
      else if (eff === "overdue") e.overdue++
      else e.pending++
    }
    // Guias
    for (const t of filteredTaxes) {
      if (!t.clientId) continue
      const name = clients.find((c) => c.id === t.clientId)?.name || "Cliente"
      const e = getOrCreate(t.clientId, name)
      e.total++
      e.guiaCount++
      const due = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      const eff = effectiveStatus({ status: t.status, calculatedDueDate: due ?? undefined })
      if (eff === "completed") e.completed++
      else if (eff === "in_progress") e.inProgress++
      else if (eff === "overdue") e.overdue++
      else e.pending++
    }
    // Parcelamentos — conta cada PARCELA do período como uma unidade.
    // Mesma lógica do contador "Parcelas no período" da Visão Geral. Status
    // é PER-PARCELA (concluída se sentAt/paidAt, atrasada/pendente conforme
    // data). Não usa o status do parcelamento inteiro — esse só vira
    // "completed" quando TODAS as parcelas terminam.
    for (const p of parcelasInRange) {
      const name = clients.find((c) => c.id === p.inst.clientId)?.name || "Cliente"
      const e = getOrCreate(p.inst.clientId, name)
      e.total++
      e.parcCount++
      if (p.status === "completed") e.completed++
      else if (p.status === "overdue") e.overdue++
      else e.pending++
    }
    // Serviços
    for (const sv of filteredServices) {
      const name = clients.find((c) => c.id === sv.clientId)?.name || "Cliente"
      const e = getOrCreate(sv.clientId, name)
      e.total++
      e.svcCount++
      const eff = effectiveStatus({ status: sv.status, calculatedDueDate: sv.dueDate })
      if (eff === "completed") e.completed++
      else if (eff === "in_progress") e.inProgress++
      else if (eff === "overdue") e.overdue++
      else e.pending++
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filteredObligations, filteredTaxes, parcelasInRange, filteredServices, clients])

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

  // Lista unificada de itens CONCLUÍDOS (obrigações + guias + parcelamentos),
  // pra alimentar a aba "Finalizadas". Antes mostrava só obrigações; agora
  // o contador vê tudo que finalizou no período.
  type CompletedItem = {
    id: string
    name: string
    clientName: string
    completedAt: string | undefined
    href: string
    typeLabel: "Obrigação" | "Guia" | "Parcela" | "Serviço"
  }
  const unifiedCompleted = useMemo<CompletedItem[]>(() => {
    const out: CompletedItem[] = []
    for (const o of filteredObligations) {
      if (effectiveStatus(o) === "completed") {
        out.push({
          id: o.id,
          name: o.name,
          clientName: o.client.name,
          completedAt: o.completedAt,
          href: `/obrigacoes?clientId=${o.clientId}&obligationId=${o.id}`,
          typeLabel: "Obrigação",
        })
      }
    }
    for (const t of filteredTaxes) {
      if (t.status === "completed") {
        const clientName = clients.find((c) => c.id === t.clientId)?.name ?? "—"
        out.push({
          id: t.id,
          name: t.name,
          clientName,
          completedAt: t.completedAt,
          href: `/impostos?clientId=${t.clientId}`,
          typeLabel: "Guia",
        })
      }
    }
    // Parcelas individuais concluídas no período — não o parcelamento todo.
    // Cada parcela é 1 linha com "PERT-INSS — parcela 6/24" + data de conclusão.
    for (const p of parcelasInRange) {
      if (p.status !== "completed") continue
      const clientName = clients.find((c) => c.id === p.inst.clientId)?.name ?? "—"
      out.push({
        id: `${p.inst.id}-parc${p.parcelaNumber}`,
        name: `${p.inst.name} — parcela ${p.parcelaNumber}/${p.inst.installmentCount}`,
        clientName,
        completedAt: p.doneAt,
        href: `/parcelamentos?clientId=${p.inst.clientId}`,
        typeLabel: "Parcela",
      })
    }
    // Serviços concluídos
    for (const sv of filteredServices) {
      if (sv.status !== "completed") continue
      const clientName = clients.find((c) => c.id === sv.clientId)?.name ?? "—"
      out.push({
        id: sv.id,
        name: sv.name,
        clientName,
        completedAt: sv.completedAt,
        href: `/servicos?clientId=${sv.clientId}`,
        typeLabel: "Serviço",
      })
    }
    return out.sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return db - da
    })
  }, [filteredObligations, filteredTaxes, parcelasInRange, filteredServices, clients])

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

  // ─── Matéria-prima única dos relatórios (Excel + PDF leem o mesmo objeto) ──
  const reportData = useMemo<ReportData>(() => {
    const fmt = (d: string | Date | undefined): string => {
      if (!d) return ""
      const date = typeof d === "string" ? new Date(d) : d
      if (Number.isNaN(date.getTime())) return ""
      return date.toLocaleDateString("pt-BR")
    }
    const ms = (d: string | Date | undefined): number => {
      if (!d) return 0
      const date = typeof d === "string" ? new Date(d) : d
      return Number.isNaN(date.getTime()) ? 0 : date.getTime()
    }
    const prioLabel = (p: string) =>
      p === "urgent" ? "Urgente" : p === "high" ? "Alta" : p === "low" ? "Baixa" : "Média"

    // KPIs por tipo
    const obrig = {
      total: filteredObligations.length,
      concluidas: stats.completed.length,
      emAndamento: stats.inProgress.length,
      pendentes: stats.pending.length,
      atrasadas: stats.overdue.length,
    }
    const guiaStatus = filteredTaxes.map((t) => {
      const due = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      return effectiveStatus({ status: t.status, calculatedDueDate: due ?? undefined })
    })
    const guias = {
      total: filteredTaxes.length,
      concluidas: guiaStatus.filter((s) => s === "completed").length,
      emAndamento: guiaStatus.filter((s) => s === "in_progress").length,
      pendentes: guiaStatus.filter((s) => s === "pending").length,
      atrasadas: guiaStatus.filter((s) => s === "overdue").length,
    }
    const parcelas = {
      total: parcelasInRange.length,
      concluidas: parcelasInRange.filter((p) => p.status === "completed").length,
      emAndamento: 0,
      pendentes: parcelasInRange.filter((p) => p.status === "pending").length,
      atrasadas: parcelasInRange.filter((p) => p.status === "overdue").length,
    }
    const svcStatus = filteredServices.map((s) =>
      effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate }),
    )
    const servicos = {
      total: filteredServices.length,
      concluidas: svcStatus.filter((s) => s === "completed").length,
      emAndamento: svcStatus.filter((s) => s === "in_progress").length,
      pendentes: svcStatus.filter((s) => s === "pending").length,
      atrasadas: svcStatus.filter((s) => s === "overdue").length,
    }

    // Compliance por cliente (nota A/B/C) — indexa por nome do cliente
    const compliance = calculateClientCompliance(
      clients,
      filteredObligations,
      filteredTaxes,
      filteredInstallments,
      filteredServices,
    )
    const notaPorCliente = new Map(compliance.map((c) => [c.client.id, c.grade]))
    const clientIdByName = new Map(clients.map((c) => [c.name, c.id]))

    const porCliente = byClient.map((c) => ({
      cliente: c.clientName,
      total: c.total,
      concluidas: c.completed,
      emAndamento: c.inProgress,
      pendentes: c.pending,
      atrasadas: c.overdue,
      taxa: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
      nota: notaPorCliente.get(clientIdByName.get(c.clientName) ?? "") ?? "",
    }))

    const porTipo = Object.entries(byTax)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([nome, t]) => ({ nome, total: t.total, concluidas: t.completed, atrasadas: t.overdue }))

    const porRecorrencia = Object.entries(byRecurrence)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, quantidade]) => ({ nome, quantidade }))

    const evolucao = monthlyEvolution.map((m) => ({
      mes: m.label,
      concluidas: m.concluidas,
      pendentes: m.pendentes,
      atrasadas: m.atrasadas,
      total: m.concluidas + m.pendentes + m.atrasadas,
      taxa: m.completionRate,
    }))

    // ── Pendências (atrasadas + a vencer) dos 4 tipos ──
    const atrasadas: ReportPendenciaRow[] = []
    const aVencer: ReportPendenciaRow[] = []
    const push = (
      arr: ReportPendenciaRow[],
      tipo: ReportPendenciaRow["tipo"],
      nome: string,
      cliente: string,
      due: Date | string | undefined,
      prioridade: string,
      competencia: string,
    ) => {
      arr.push({ tipo, nome, cliente, vencimento: fmt(due), vencimentoMs: ms(due), prioridade, competencia })
    }
    const clientName = (id: string | undefined) => clients.find((c) => c.id === id)?.name ?? "—"

    for (const o of filteredObligations) {
      const eff = effectiveStatus(o)
      if (eff === "overdue") push(atrasadas, "Obrigação", o.name, o.client.name, o.calculatedDueDate, prioLabel(o.priority), o.competencyMonth ?? "")
      else if (eff !== "completed") push(aVencer, "Obrigação", o.name, o.client.name, o.calculatedDueDate, prioLabel(o.priority), o.competencyMonth ?? "")
    }
    for (const t of filteredTaxes) {
      const due = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      const eff = effectiveStatus({ status: t.status, calculatedDueDate: due ?? undefined })
      if (eff === "overdue") push(atrasadas, "Guia", t.name, clientName(t.clientId), due ?? undefined, prioLabel(t.priority), t.competencyMonth ?? "")
      else if (eff !== "completed") push(aVencer, "Guia", t.name, clientName(t.clientId), due ?? undefined, prioLabel(t.priority), t.competencyMonth ?? "")
    }
    for (const p of parcelasInRange) {
      const nome = `${p.inst.name} — parcela ${p.parcelaNumber}/${p.inst.installmentCount}`
      if (p.status === "overdue") push(atrasadas, "Parcela", nome, clientName(p.inst.clientId), p.dueDate, prioLabel(p.inst.priority), "")
      else if (p.status === "pending") push(aVencer, "Parcela", nome, clientName(p.inst.clientId), p.dueDate, prioLabel(p.inst.priority), "")
    }
    for (const s of filteredServices) {
      const eff = effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate })
      if (eff === "overdue") push(atrasadas, "Serviço", s.name, clientName(s.clientId), s.dueDate, prioLabel(s.priority), "")
      else if (eff !== "completed") push(aVencer, "Serviço", s.name, clientName(s.clientId), s.dueDate, prioLabel(s.priority), "")
    }
    atrasadas.sort((a, b) => a.vencimentoMs - b.vencimentoMs)
    aVencer.sort((a, b) => a.vencimentoMs - b.vencimentoMs)

    const concluidas = unifiedCompleted.map((u) => ({
      tipo: u.typeLabel,
      nome: u.name,
      cliente: u.clientName,
      concluidaEm: fmt(u.completedAt),
    }))

    return {
      periodoLabel: periodoLabel(filters.range.from, filters.range.to),
      geradoEm: geradoEm(),
      kpis: {
        totalGeral: totalAll,
        concluidasGeral: totalCompletedAll,
        taxaConclusao: overallRate,
        taxaNoPrazo: onTimeRate,
        obrigacoes: obrig,
        guias,
        parcelas,
        servicos,
      },
      porCliente,
      porTipo,
      porRecorrencia,
      evolucao,
      atrasadas,
      aVencer,
      concluidas,
    }
  }, [
    filteredObligations, filteredTaxes, filteredInstallments, filteredServices,
    parcelasInRange, byClient, byTax, byRecurrence, monthlyEvolution, unifiedCompleted,
    stats, totalAll, totalCompletedAll, overallRate, onTimeRate, clients, filters.range,
  ])

  const handleExportExcel = async () => {
    try {
      await exportRelatorioExcel(reportData)
      toast.success("Excel gerado")
    } catch (e) {
      console.error("[relatorios] erro ao gerar Excel:", e)
      toast.error("Erro ao gerar Excel")
    }
  }

  const handleExportPdf = () => {
    try {
      exportRelatorioPdf(reportData)
      toast.success("PDF gerado")
    } catch (e) {
      console.error("[relatorios] erro ao gerar PDF:", e)
      toast.error("Erro ao gerar PDF")
    }
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
        <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2">
          <Download className="size-4" /> Exportar PDF
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
          { href: "#entregas", label: "Entregas/dia" },
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <p className="text-xs text-muted-foreground">Parcelas no período</p>
                <p className="text-2xl font-bold tabular-nums">
                  {parcelasCompleted}/{totalParcelas}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serviços</p>
                <p className="text-2xl font-bold tabular-nums">
                  {servicesCompleted}/{filteredServices.length}
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
      {/* Passa dados já filtrados pelo date range — antes o score ignorava
          o filtro e mostrava nota global, confundindo "Janeiro/2026" com
          o histórico inteiro do cliente. */}
      <section id="compliance" className="scroll-mt-20">
        <ComplianceScoreList
          clients={clients}
          obligations={filteredObligations}
          taxes={filteredTaxes}
          installments={filteredInstallments}
          services={filteredServices}
        />
      </section>

      {/* ─── HEATMAP DE PICOS ─── */}
      <section id="heatmap" className="scroll-mt-20">
        <HeatmapVencimentos
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          services={services}
          monthKey={heatmapMonthKey}
          isAllPeriods={!filters.range.from && !filters.range.to}
        />
      </section>

      {/* ─── ENTREGAS POR DIA (produtividade) ─── */}
      <section id="entregas" className="scroll-mt-20">
        <HeatmapEntregas
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          services={services}
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
            <CardTitle className="text-base">Itens por Cliente</CardTitle>
            <CardDescription className="text-xs">
              Obrigações + guias + parcelamentos + serviços. Clique pra ver os itens do cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`space-y-3 ${showAllByClient ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
              {(showAllByClient ? byClient : byClient.slice(0, 5)).map((entry) => {
                // Breakdown por tipo, mostrando só os que têm > 0
                const typeParts: string[] = []
                if (entry.obrigCount) typeParts.push(`${entry.obrigCount} obrig.`)
                if (entry.guiaCount) typeParts.push(`${entry.guiaCount} guias`)
                if (entry.parcCount) typeParts.push(`${entry.parcCount} parc.`)
                if (entry.svcCount) typeParts.push(`${entry.svcCount} serv.`)
                return (
                  <Link
                    key={entry.clientId}
                    href={`/obrigacoes?clientId=${entry.clientId}`}
                    className="block space-y-2 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.clientName}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {entry.total} {entry.total === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    {typeParts.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {typeParts.join(" · ")}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">{entry.completed} concluídos</Badge>
                      <Badge className="bg-blue-600 hover:bg-blue-700">{entry.inProgress} em andamento</Badge>
                      <Badge variant="secondary">{entry.pending} pendentes</Badge>
                      {entry.overdue > 0 && <Badge variant="destructive">{entry.overdue} atrasados</Badge>}
                    </div>
                    <Progress value={(entry.completed / entry.total) * 100} className="h-2" />
                  </Link>
                )
              })}
              {byClient.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item no filtro atual.
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
              <Activity className="size-4 text-emerald-600" /> Itens Finalizados
            </CardTitle>
            <CardDescription className="text-xs">
              Obrigações + guias + parcelamentos concluídos no filtro · {" "}
              {showAllCompleted
                ? unifiedCompleted.length > 50
                  ? `50 mais recentes de ${unifiedCompleted.length}`
                  : `${unifiedCompleted.length} no filtro`
                : `${Math.min(5, unifiedCompleted.length)} mais recentes${
                    unifiedCompleted.length > 5 ? ` de ${unifiedCompleted.length}` : ""
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unifiedCompleted.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Nenhum item concluído no filtro atual.
              </p>
            ) : (
              <>
                <div className={`space-y-2 ${showAllCompleted ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
                  {unifiedCompleted
                    .slice(0, showAllCompleted ? 50 : 5)
                    .map((item) => (
                      <Link
                        key={`${item.typeLabel}-${item.id}`}
                        href={item.href}
                        className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:border-primary/40 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                              {item.typeLabel}
                            </Badge>
                            <span className="font-medium truncate">{item.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{item.clientName}</div>
                          {item.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              Concluído em: {formatDate(item.completedAt)}
                            </div>
                          )}
                        </div>
                        <Badge className="bg-emerald-600 mt-1 shrink-0">
                          <CheckCircle2 className="size-3 mr-1" /> Concluído
                        </Badge>
                      </Link>
                    ))}
                </div>
                {unifiedCompleted.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCompleted(!showAllCompleted)}
                    className="w-full mt-3 text-xs"
                  >
                    {showAllCompleted
                      ? "Mostrar menos"
                      : `Ver últimos ${Math.min(50, unifiedCompleted.length)}`}
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
