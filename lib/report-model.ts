/**
 * Modelo de dados da aba Relatórios — lógica que antes vivia inline em
 * components/reports-panel.tsx, extraída como funções puras pra poder ser
 * testada (lib/__tests__/numeros.test.ts) e reaproveitada pelo Excel/PDF.
 *
 * Convenções:
 *  - Parcelamentos contam PARCELA A PARCELA (cada parcela do range, com o
 *    status dela). Filtro de status também é aplicado por parcela.
 *  - "No prazo" compara por DIA (completedOnTimeCheck): concluído no dia do
 *    vencimento, a qualquer hora, está no prazo.
 *  - Os cards de status e a taxa no prazo exibidos somam os 4 tipos
 *    (obrigações + guias + parcelas + serviços), igual ao "Total Combinado"
 *    e à planilha "Resumo".
 */
import type { Client, Installment, ObligationWithDetails, Service, Tax, TaxScope } from "./types"
import type { ReportConcluidaRow, ReportData, ReportPendenciaRow, ReportTipoStats } from "./report-types"
import { calculateDueDateFromCompetency, parseLocalDate, toLocalDateString } from "./date-utils"
import { effectiveStatus } from "./obligation-status"
import { dateInRange, type DateRange } from "./date-range"
import { calculateClientCompliance, completedOnTimeCheck, type ClientCompliance } from "./compliance-score"
import { getRecurrenceDescription } from "./recurrence-utils"
import { periodoLabel, geradoEm } from "./report-config"
import {
  installmentParcelasInRange,
  installmentsInRange,
  monthlyEvolutionBuckets,
  monthKeyOf,
  obligationsInRange,
  taxesInRange,
  type MonthlyBucket,
} from "./dashboard-utils"

export type ReportFilterStatus = "pending" | "in_progress" | "completed" | "overdue"

export type ReportFilters = {
  range: DateRange
  clientIds: string[]
  statuses: ReportFilterStatus[]
  scope: "all" | TaxScope
}

export type ReportSource = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  services: Service[]
  clients: Client[]
}

export type ReportParcela = {
  inst: Installment
  parcelaNumber: number
  dueDate: Date
  status: "completed" | "overdue" | "pending"
  doneAt?: string
}

export type OnTimeStat = { onTime: number; completed: number; rate: number }

export type ReportCompletedItem = {
  id: string
  name: string
  clientName: string
  completedAt: string | undefined
  href: string
  typeLabel: "Obrigação" | "Guia" | "Parcela" | "Serviço"
}

export type ReportByClientEntry = {
  clientId: string
  clientName: string
  total: number
  completed: number
  pending: number
  inProgress: number
  overdue: number
  obrigCount: number
  guiaCount: number
  parcCount: number
  svcCount: number
}

export type ReportInstallmentRow = {
  key: string
  inst: Installment
  parcelaNumber: number
  /** "N/total" */
  parcela: string
  dueDate: Date
  effStatus: "completed" | "overdue" | "pending"
}

const taxDue = (t: Tax): Date | null =>
  calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)

const taxStatus = (t: Tax) => effectiveStatus({ status: t.status, calculatedDueDate: taxDue(t) ?? undefined })
const serviceStatus = (s: Service) => effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate })

const rate = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

/** Mês do heatmap: o do "to" do range (data LOCAL), senão o mês corrente. */
export function heatmapMonthKey(range: DateRange): string {
  return monthKeyOf(range.to ? parseLocalDate(range.to) : new Date())
}

export function buildReportModel(src: ReportSource, filters: ReportFilters) {
  const { obligations, taxes, installments, services, clients } = src
  const clientSet = filters.clientIds.length > 0 ? new Set(filters.clientIds) : null
  const statusSet = filters.statuses.length > 0 ? new Set<string>(filters.statuses) : null
  const clientName = (id: string | undefined, fallback = "—") => clients.find((c) => c.id === id)?.name ?? fallback

  // ─── Filtros ───────────────────────────────────────────────────────────
  let fo = obligationsInRange(obligations, filters.range)
  if (clientSet) fo = fo.filter((o) => clientSet.has(o.clientId))
  if (filters.scope !== "all") fo = fo.filter((o) => o.scope === filters.scope)
  if (statusSet) fo = fo.filter((o) => statusSet.has(effectiveStatus(o)))
  const filteredObligations = fo

  let ft = taxesInRange(taxes, filters.range)
  if (clientSet) ft = ft.filter((t) => !!t.clientId && clientSet.has(t.clientId))
  if (filters.scope !== "all") ft = ft.filter((t) => t.scope === filters.scope)
  if (statusSet) ft = ft.filter((t) => statusSet.has(taxStatus(t)))
  const filteredTaxes = ft

  // Parcelamentos: expande as parcelas do range e filtra o status DE CADA
  // PARCELA (antes olhava o parcelamento inteiro / a parcela atual).
  let fi = installmentsInRange(installments, filters.range)
  if (clientSet) fi = fi.filter((i) => clientSet.has(i.clientId))
  const parcelasInRange: ReportParcela[] = []
  const instWithParcels = new Set<string>()
  for (const inst of fi) {
    for (const p of installmentParcelasInRange(inst, filters.range)) {
      if (statusSet && !statusSet.has(p.status)) continue
      parcelasInRange.push({ inst, ...p })
      instWithParcels.add(inst.id)
    }
  }
  const filteredInstallments = statusSet ? fi.filter((i) => instWithParcels.has(i.id)) : fi

  let fs = services.filter((s) => (filters.range.from || filters.range.to ? dateInRange(s.dueDate, filters.range) : true))
  if (clientSet) fs = fs.filter((s) => clientSet.has(s.clientId))
  if (statusSet) fs = fs.filter((s) => statusSet.has(serviceStatus(s)))
  const filteredServices = fs

  // ─── Obrigações por status ─────────────────────────────────────────────
  const stats = {
    completed: [] as ObligationWithDetails[],
    inProgress: [] as ObligationWithDetails[],
    pending: [] as ObligationWithDetails[],
    overdue: [] as ObligationWithDetails[],
  }
  for (const o of filteredObligations) {
    const eff = effectiveStatus(o)
    if (eff === "completed") stats.completed.push(o)
    else if (eff === "in_progress") stats.inProgress.push(o)
    else if (eff === "overdue") stats.overdue.push(o)
    else stats.pending.push(o)
  }

  const tipoStats = (statuses: string[]): ReportTipoStats => ({
    total: statuses.length,
    concluidas: statuses.filter((s) => s === "completed").length,
    emAndamento: statuses.filter((s) => s === "in_progress").length,
    pendentes: statuses.filter((s) => s === "pending").length,
    atrasadas: statuses.filter((s) => s === "overdue").length,
  })
  const byType = {
    obrigacoes: tipoStats(filteredObligations.map((o) => effectiveStatus(o))),
    guias: tipoStats(filteredTaxes.map(taxStatus)),
    parcelas: tipoStats(parcelasInRange.map((p) => p.status)),
    servicos: tipoStats(filteredServices.map(serviceStatus)),
  }
  const types = [byType.obrigacoes, byType.guias, byType.parcelas, byType.servicos]
  const allStatus = {
    completed: types.reduce((a, t) => a + t.concluidas, 0),
    inProgress: types.reduce((a, t) => a + t.emAndamento, 0),
    pending: types.reduce((a, t) => a + t.pendentes, 0),
    overdue: types.reduce((a, t) => a + t.atrasadas, 0),
  }

  const taxesCompleted = byType.guias.concluidas
  const parcelasCompleted = byType.parcelas.concluidas
  const totalParcelas = parcelasInRange.length
  const servicesCompleted = byType.servicos.concluidas
  const totalAll = filteredObligations.length + filteredTaxes.length + totalParcelas + filteredServices.length
  const totalCompletedAll = allStatus.completed
  const overallRate = rate(totalCompletedAll, totalAll)

  // ─── No prazo (comparação por DIA) ─────────────────────────────────────
  const oblOnTime = stats.completed.filter((o) => completedOnTimeCheck(o.completedAt, parseLocalDate(o.calculatedDueDate))).length
  let allEvaluated = stats.completed.length
  let allOnTime = oblOnTime
  for (const t of filteredTaxes) {
    if (taxStatus(t) !== "completed") continue
    const due = taxDue(t)
    if (!due) continue // guia sem vencimento calculável não entra na taxa
    allEvaluated++
    if (completedOnTimeCheck(t.completedAt, due)) allOnTime++
  }
  for (const p of parcelasInRange) {
    if (p.status !== "completed") continue
    allEvaluated++
    if (completedOnTimeCheck(p.doneAt, p.dueDate)) allOnTime++
  }
  for (const s of filteredServices) {
    if (serviceStatus(s) !== "completed") continue
    allEvaluated++
    if (completedOnTimeCheck(s.completedAt, parseLocalDate(s.dueDate))) allOnTime++
  }
  const onTime = {
    obligations: { onTime: oblOnTime, completed: stats.completed.length, rate: rate(oblOnTime, stats.completed.length) } as OnTimeStat,
    all: { onTime: allOnTime, completed: allEvaluated, rate: rate(allOnTime, allEvaluated) } as OnTimeStat,
  }

  // Evolução 12 meses (com taxa de conclusão) — sempre baseado em ref=hoje
  const monthlyEvolution: MonthlyBucket[] = monthlyEvolutionBuckets(
    obligations, taxes, installments, 12, new Date(), filters.clientIds, services,
  )

  // ─── Por cliente (4 tipos) ─────────────────────────────────────────────
  const map = new Map<string, ReportByClientEntry>()
  const entry = (id: string, name: string) => {
    let e = map.get(id)
    if (!e) {
      e = { clientId: id, clientName: name, total: 0, completed: 0, pending: 0, inProgress: 0, overdue: 0, obrigCount: 0, guiaCount: 0, parcCount: 0, svcCount: 0 }
      map.set(id, e)
    }
    return e
  }
  const bump = (e: ReportByClientEntry, eff: string) => {
    e.total++
    if (eff === "completed") e.completed++
    else if (eff === "in_progress") e.inProgress++
    else if (eff === "overdue") e.overdue++
    else e.pending++
  }
  for (const o of filteredObligations) {
    const e = entry(o.clientId, o.client.name)
    e.obrigCount++
    bump(e, effectiveStatus(o))
  }
  for (const t of filteredTaxes) {
    if (!t.clientId) continue
    const e = entry(t.clientId, clientName(t.clientId, "Cliente"))
    e.guiaCount++
    bump(e, taxStatus(t))
  }
  for (const p of parcelasInRange) {
    const e = entry(p.inst.clientId, clientName(p.inst.clientId, "Cliente"))
    e.parcCount++
    bump(e, p.status)
  }
  for (const s of filteredServices) {
    const e = entry(s.clientId, clientName(s.clientId, "Cliente"))
    e.svcCount++
    bump(e, serviceStatus(s))
  }
  const byClient = [...map.values()].sort((a, b) => b.total - a.total)

  const byRecurrence: Record<string, number> = {}
  for (const o of filteredObligations) {
    const r = getRecurrenceDescription(o)
    byRecurrence[r] = (byRecurrence[r] || 0) + 1
  }

  const byTax: Record<string, { total: number; completed: number; overdue: number }> = {}
  for (const o of filteredObligations) {
    const taxName = o.tax?.name || "Sem imposto vinculado"
    if (!byTax[taxName]) byTax[taxName] = { total: 0, completed: 0, overdue: 0 }
    byTax[taxName].total++
    const eff = effectiveStatus(o)
    if (eff === "completed") byTax[taxName].completed++
    if (eff === "overdue") byTax[taxName].overdue++
  }

  // ─── Concluídos (4 tipos) ──────────────────────────────────────────────
  const unifiedCompleted: ReportCompletedItem[] = []
  for (const o of stats.completed) {
    unifiedCompleted.push({
      id: o.id, name: o.name, clientName: o.client.name, completedAt: o.completedAt,
      href: `/obrigacoes?clientId=${o.clientId}&obligationId=${o.id}`, typeLabel: "Obrigação",
    })
  }
  for (const t of filteredTaxes) {
    if (t.status !== "completed") continue
    unifiedCompleted.push({
      id: t.id, name: t.name, clientName: clientName(t.clientId), completedAt: t.completedAt,
      href: `/impostos?clientId=${t.clientId}`, typeLabel: "Guia",
    })
  }
  for (const p of parcelasInRange) {
    if (p.status !== "completed") continue
    unifiedCompleted.push({
      id: `${p.inst.id}-parc${p.parcelaNumber}`,
      name: `${p.inst.name} — parcela ${p.parcelaNumber}/${p.inst.installmentCount}`,
      clientName: clientName(p.inst.clientId), completedAt: p.doneAt,
      href: `/parcelamentos?clientId=${p.inst.clientId}`, typeLabel: "Parcela",
    })
  }
  for (const s of filteredServices) {
    if (s.status !== "completed") continue
    unifiedCompleted.push({
      id: s.id, name: s.name, clientName: clientName(s.clientId), completedAt: s.completedAt,
      href: `/servicos?clientId=${s.clientId}`, typeLabel: "Serviço",
    })
  }
  unifiedCompleted.sort((a, b) => {
    const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
    const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
    return db - da
  })

  // ─── Tabela "Parcelamentos no período": uma linha por PARCELA do range ──
  const installmentsInPeriodTable: ReportInstallmentRow[] = parcelasInRange
    .map((p) => ({
      key: `${p.inst.id}-p${p.parcelaNumber}`,
      inst: p.inst,
      parcelaNumber: p.parcelaNumber,
      parcela: `${p.parcelaNumber}/${p.inst.installmentCount}`,
      dueDate: p.dueDate,
      effStatus: p.status,
    }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  const compliance: ClientCompliance[] = calculateClientCompliance(
    clients, filteredObligations, filteredTaxes, filteredInstallments, filteredServices,
  )

  return {
    filters,
    clients,
    filteredObligations,
    filteredTaxes,
    filteredInstallments,
    filteredServices,
    parcelasInRange,
    stats,
    byType,
    allStatus,
    taxesCompleted,
    parcelasCompleted,
    totalParcelas,
    servicesCompleted,
    totalAll,
    totalCompletedAll,
    overallRate,
    onTime,
    monthlyEvolution,
    heatmapMonthKey: heatmapMonthKey(filters.range),
    byClient,
    byRecurrence,
    byTax,
    unifiedCompleted,
    installmentsInPeriodTable,
    compliance,
    periodoLabel: periodoLabel(filters.range.from, filters.range.to),
  }
}

export type ReportModel = ReturnType<typeof buildReportModel>

const prioLabel = (p: string) => (p === "urgent" ? "Urgente" : p === "high" ? "Alta" : p === "low" ? "Baixa" : "Média")

/** Data → "YYYY-MM-DD" do dia LOCAL ("" se inválida/ausente). */
function isoDay(d: string | Date | undefined | null): string {
  if (!d) return ""
  const date = parseLocalDate(d)
  return Number.isNaN(date.getTime()) ? "" : toLocalDateString(date)
}
function brDay(d: string | Date | undefined | null): string {
  const iso = isoDay(d)
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ""
}

/** Matéria-prima única dos relatórios (Excel + PDF leem o mesmo objeto). */
export function buildReportData(m: ReportModel, geradoEmLabel: string = geradoEm()): ReportData {
  const clientName = (id: string | undefined) => m.clients.find((c) => c.id === id)?.name ?? "—"
  const notaPorCliente = new Map(m.compliance.map((c) => [c.client.id, c.grade]))

  const porCliente = m.byClient.map((c) => ({
    cliente: c.clientName,
    total: c.total,
    concluidas: c.completed,
    emAndamento: c.inProgress,
    pendentes: c.pending,
    atrasadas: c.overdue,
    taxa: rate(c.completed, c.total),
    nota: notaPorCliente.get(c.clientId) ?? "",
  }))

  const porTipo = Object.entries(m.byTax)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([nome, t]) => ({ nome, total: t.total, concluidas: t.completed, atrasadas: t.overdue }))

  const porRecorrencia = Object.entries(m.byRecurrence)
    .sort(([, a], [, b]) => b - a)
    .map(([nome, quantidade]) => ({ nome, quantidade }))

  const evolucao = m.monthlyEvolution.map((x) => ({
    mes: x.label,
    concluidas: x.concluidas,
    pendentes: x.pendentes,
    atrasadas: x.atrasadas,
    total: x.concluidas + x.pendentes + x.atrasadas,
    taxa: x.completionRate,
  }))

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
    const iso = isoDay(due)
    arr.push({
      tipo, nome, cliente,
      vencimento: brDay(due),
      vencimentoIso: iso,
      vencimentoMs: iso ? parseLocalDate(iso).getTime() : 0,
      prioridade, competencia,
    })
  }
  for (const o of m.filteredObligations) {
    const eff = effectiveStatus(o)
    if (eff === "overdue") push(atrasadas, "Obrigação", o.name, o.client.name, o.calculatedDueDate, prioLabel(o.priority), o.competencyMonth ?? "")
    else if (eff !== "completed") push(aVencer, "Obrigação", o.name, o.client.name, o.calculatedDueDate, prioLabel(o.priority), o.competencyMonth ?? "")
  }
  for (const t of m.filteredTaxes) {
    const due = taxDue(t) ?? undefined
    const eff = taxStatus(t)
    if (eff === "overdue") push(atrasadas, "Guia", t.name, clientName(t.clientId), due, prioLabel(t.priority), t.competencyMonth ?? "")
    else if (eff !== "completed") push(aVencer, "Guia", t.name, clientName(t.clientId), due, prioLabel(t.priority), t.competencyMonth ?? "")
  }
  for (const p of m.parcelasInRange) {
    const nome = `${p.inst.name} — parcela ${p.parcelaNumber}/${p.inst.installmentCount}`
    if (p.status === "overdue") push(atrasadas, "Parcela", nome, clientName(p.inst.clientId), p.dueDate, prioLabel(p.inst.priority), "")
    else if (p.status === "pending") push(aVencer, "Parcela", nome, clientName(p.inst.clientId), p.dueDate, prioLabel(p.inst.priority), "")
  }
  for (const s of m.filteredServices) {
    const eff = serviceStatus(s)
    if (eff === "overdue") push(atrasadas, "Serviço", s.name, clientName(s.clientId), s.dueDate, prioLabel(s.priority), "")
    else if (eff !== "completed") push(aVencer, "Serviço", s.name, clientName(s.clientId), s.dueDate, prioLabel(s.priority), "")
  }
  atrasadas.sort((a, b) => a.vencimentoMs - b.vencimentoMs)
  aVencer.sort((a, b) => a.vencimentoMs - b.vencimentoMs)

  const concluidas: ReportConcluidaRow[] = m.unifiedCompleted.map((u) => ({
    tipo: u.typeLabel,
    nome: u.name,
    cliente: u.clientName,
    concluidaEm: brDay(u.completedAt),
    concluidaEmIso: isoDay(u.completedAt),
  }))

  return {
    periodoLabel: m.periodoLabel,
    geradoEm: geradoEmLabel,
    kpis: {
      totalGeral: m.totalAll,
      concluidasGeral: m.totalCompletedAll,
      taxaConclusao: m.overallRate,
      taxaNoPrazo: m.onTime.all.rate,
      obrigacoes: m.byType.obrigacoes,
      guias: m.byType.guias,
      parcelas: m.byType.parcelas,
      servicos: m.byType.servicos,
    },
    porCliente,
    porTipo,
    porRecorrencia,
    evolucao,
    atrasadas,
    aVencer,
    concluidas,
  }
}
