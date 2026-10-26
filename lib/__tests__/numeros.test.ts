/**
 * QA de NÚMEROS (dashboard, relatórios, calendário, exportações).
 *
 * Portado da bateria do QA (scratchpad/qa-numeros): cada `expect` traz o valor
 * CORRETO calculado à mão (ver comentários em fixtures/qa-numeros.ts). Os
 * testes marcados [BUG n] eram os 18 que falhavam; agora apontam para o código
 * real (a lógica inline dos componentes foi extraída para funções puras em lib/).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { NOW, clients, obligations as rawObligations, taxes, installments, services } from "./fixtures/qa-numeros"
import {
  getObligationsWithDetails, calculateDashboardStats, installmentInPeriod, installmentParcelasInRange,
  installmentParcelasInPeriod, selectPeriodItems, heroCriticalCount, computeProductivityStats, healthStatusCounts,
  upcomingForecastCounts, monthlyEvolutionBuckets, heatmapByDay, completionsByDay, averageCompletionDays,
  obligationsInRange, taxesInRange, servicesInRange,
} from "../dashboard-utils"
import { calculateClientCompliance, urgencyTier } from "../compliance-score"
import { effectiveStatus, isCriticalNow } from "../obligation-status"
import { calculateDueDateFromCompetency, toLocalDateString } from "../date-utils"
import { getParcelaDueDate } from "../installment-dates"
import { buildReportModel, buildReportData, type ReportFilters } from "../report-model"
import { buildCalendarItems, filterCalendarItems, calendarMonthSummary, dayHasOverdue, type CalendarFilters } from "../calendar-items"
import { filterObligationsByTab, filterObligationsForExport, OBLIGATION_EXPORT_COLUMNS } from "../obligation-export"
import { buildXlsxWorkbook, buildCsv, buildTablePdf } from "../export-utils"
import { buildRelatorioWorkbook } from "../report-excel"
import { buildRelatorioPdf } from "../report-pdf"
import type { Installment, ObligationWithDetails } from "../types"

const ymd = (d: Date | string) => toLocalDateString(typeof d === "string" ? new Date(d) : d)
let obls: ObligationWithDetails[]
const data = () => ({ obligations: obls, taxes, installments, services, clients })

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW })
  obls = getObligationsWithDetails(rawObligations, clients, taxes)
})
afterAll(() => {
  vi.useRealTimers()
})

describe("0. sanidade do dataset", () => {
  it("[OK] fuso e datas calculadas batem com o cálculo à mão", () => {
    expect(new Date(2026, 9, 26).getTimezoneOffset()).toBe(180)
    const due = Object.fromEntries(obls.map((o) => [o.id, ymd(o.calculatedDueDate)]))
    expect(due).toEqual({ O1: "2026-10-20", O2: "2026-10-15", O3: "2026-10-26", O4: "2026-10-13", O5: "2026-09-25", O6: "2026-11-23", O7: "2026-10-28" })
    const t = (id: string) => { const x = taxes.find((y) => y.id === id)!; const d = calculateDueDateFromCompetency(x.competencyMonth, x.dueDay, x.weekendRule, x.dueMonth); return d && ymd(d) }
    expect([t("T1"), t("T2"), t("T3"), t("T4")]).toEqual(["2026-10-20", "2026-10-26", "2026-09-21", null])
    const I1 = installments[0], I2 = installments[1]
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => ymd(getParcelaDueDate(I1, n)))).toEqual(["2026-06-22", "2026-07-20", "2026-08-20", "2026-09-21", "2026-10-20", "2026-11-23", "2026-12-21"])
    expect([1, 2, 3].map((n) => ymd(getParcelaDueDate(I2, n)))).toEqual(["2026-09-15", "2026-10-15", "2026-11-16"])
  })
})

describe("1. calculateDashboardStats", () => {
  it("[OK] Outubro/2026: totais, por tipo e 'esta semana'", () => {
    const s = calculateDashboardStats(clients, obls, taxes, installments, "2026-10", services)
    expect(s.byType.obligations).toEqual({ total: 5, completed: 2, overdue: 1, pending: 2 })
    // T4 (sem competência) entra em todo mês — comportamento documentado
    expect(s.byType.taxes).toEqual({ total: 3, completed: 1, overdue: 0, pending: 2 })
    expect(s.byType.installments).toEqual({ total: 2, completed: 1, overdue: 1, pending: 0 })
    expect(s.byType.services).toEqual({ total: 3, completed: 1, overdue: 0, pending: 2 })
    expect([s.totalItems, s.completedInPeriod, s.overdueItems, s.pendingItems]).toEqual([13, 5, 2, 6])
    expect(s.upcomingThisWeek).toBe(5) // O3, O7, T2, S1, S3
    expect([s.totalClients, s.activeClients]).toEqual([3, 2])
  })
  it("[OK] Novembro/2026: parcelas futuras pendentes, nenhum atraso", () => {
    const s = calculateDashboardStats(clients, obls, taxes, installments, "2026-11", services)
    expect(s.byType.installments).toEqual({ total: 2, completed: 0, overdue: 0, pending: 2 })
    expect(s.overdueItems).toBe(0)
  })
  it("[OK] período sem itens → zeros, sem NaN", () => {
    const s = calculateDashboardStats(clients, [], [], [], "2030-01", [])
    expect([s.totalItems, s.completedInPeriod, s.overdueItems]).toEqual([0, 0, 0])
  })
  it("[BUG 14] mês com DUAS parcelas (ajuste de fim de semana) conta as duas", () => {
    // dia 31, postpone: p1 31/01 sáb→02/02 ; p2 28/02 sáb→02/03 ; p3 31/03 ter. Março tem p2 E p3.
    const inst: Installment = { ...installments[0], id: "IX", firstDueDate: "2026-01-31", dueDay: 31, installmentCount: 6, currentInstallment: 1, paidInstallments: [], status: "pending" }
    expect(installmentParcelasInRange(inst, { from: "2026-03-01", to: "2026-03-31" }).map((p) => p.parcelaNumber)).toEqual([2, 3])
    expect(installmentParcelasInPeriod(inst, "2026-03").map((p) => p.parcelaNumber)).toEqual([2, 3])
    expect(installmentInPeriod(inst, "2026-03")?.parcelaNumber).toBe(2) // compat: primeira do mês
    const s = calculateDashboardStats(clients, [], [], [inst], "2026-03", [])
    expect(s.byType.installments.total).toBe(2)
  })
  it("[BUG 10] mês atual: atrasados de meses anteriores entram em Atrasados/Pendências e no progresso", () => {
    // Sino (use-task-alerts): O2, T3, I2-p2 atrasados. T3 venceu em 21/09 (mês anterior).
    const s = calculateDashboardStats(clients, obls, taxes, installments, "2026-10", services, { carryOverdue: true })
    expect(s.overdueItems).toBe(3)
    expect(s.byType.taxes).toEqual({ total: 4, completed: 1, overdue: 1, pending: 2 })
    expect([s.totalItems, s.completedInPeriod, s.pendingItems]).toEqual([14, 5, 6])
    const sel = selectPeriodItems(data(), "2026-10", { carryOverdue: true })
    expect(sel.carriedOverdue).toBe(1)
    expect(sel.taxes.map((t) => t.id).sort()).toEqual(["T1", "T2", "T3", "T4"])
    // O5 (concluída em setembro) não é carregada; parcelas pagas também não
    expect(sel.obligations.map((o) => o.id).sort()).toEqual(["O1", "O2", "O3", "O4", "O7"])
    expect(sel.installmentParcels.map((p) => `${p.id}-p${p.parcelaNumber}`).sort()).toEqual(["I1-p5", "I2-p2"])
    // Fora do mês atual não carrega
    expect(selectPeriodItems(data(), "2026-11", { carryOverdue: false }).carriedOverdue).toBe(0)
  })
  it("[BUG 10] parcela atrasada de mês anterior também é carregada", () => {
    const inst: Installment = { ...installments[1], id: "IY", paidInstallments: [] } // p1 15/09 não paga
    const sel = selectPeriodItems({ obligations: [], taxes: [], installments: [inst], services: [] }, "2026-10", { carryOverdue: true })
    expect(sel.installmentParcels.map((p) => `${p.parcelaNumber}:${p.status}`)).toEqual(["1:overdue", "2:overdue"])
    expect(sel.installments.map((i) => i.id)).toEqual(["IY"])
  })
})

describe("2. Dashboard: Produtividade, Saúde das Tarefas e hero", () => {
  it("[BUG 2] ProductivityStats 'Taxa no Prazo' Out/26: parcela paga com atraso não conta como no prazo", () => {
    // Avaliáveis: O1 ok, O2 atrasada, O4 ok, T1 atraso, I1-p5 (venc 20/10, paga 23/10) atraso, I2-p2 atrasada → 2/6 = 33%
    const sel = selectPeriodItems(data(), "2026-10")
    const r = computeProductivityStats(sel.obligations, sel.taxes, sel.installmentParcels)
    expect(r.onTimeRate).toBe(33)
  })
  it("[BUG 2] 'Atrasadas' e 'Saúde das Tarefas' em Nov/26 batem com o Resumo Geral", () => {
    const sel = selectPeriodItems(data(), "2026-11")
    const dash = calculateDashboardStats(clients, sel.obligations, sel.taxes, installments, "2026-11", [])
    const prod = computeProductivityStats(sel.obligations, sel.taxes, sel.installmentParcels)
    const health = healthStatusCounts(sel.obligations, sel.taxes, sel.installmentParcels, [])
    expect(dash.overdueItems).toBe(0)
    expect(prod.overdue).toBe(0)
    expect(health.overdue).toBe(0)
  })
  it("[BUG 9] Hero 'X itens críticos pra resolver hoje' inclui guias e serviços", () => {
    // Críticos (atrasado ou vence hoje): O2, O3, T2, T3, I2, S1 = 6
    const crit = [...obls, ...taxes.map((t) => ({ ...t, calculatedDueDate: calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth) ?? undefined })),
      ...installments.map((i) => ({ status: i.status, calculatedDueDate: getParcelaDueDate(i, i.currentInstallment) })),
      ...services.map((s) => ({ status: s.status, calculatedDueDate: s.dueDate }))].filter((x) => isCriticalNow(x as never)).length
    expect(crit).toBe(6)
    expect(heroCriticalCount(selectPeriodItems(data(), "all"))).toBe(6)
    // Mês atual com atrasados carregados: mesmo número
    expect(heroCriticalCount(selectPeriodItems(data(), "2026-10", { carryOverdue: true }))).toBe(6)
  })
})

describe("3. Relatórios (lib/report-model)", () => {
  const OUT: ReportFilters = { range: { from: "2026-10-01", to: "2026-10-31" }, clientIds: [], statuses: [], scope: "all" }
  it("[OK] Totais combinados Out/26", () => {
    const m = buildReportModel(data(), OUT)
    expect([m.filteredObligations.length, m.filteredTaxes.length, m.totalParcelas, m.filteredServices.length]).toEqual([5, 3, 2, 3])
    expect([m.totalAll, m.totalCompletedAll, m.overallRate]).toEqual([13, 5, 38])
    const byC = Object.fromEntries(m.byClient.map((c) => [c.clientId, [c.total, c.completed, c.inProgress, c.pending, c.overdue]]))
    // C1: O1 c, O2 o, O7 ip, T1 c, T4 p, I1p5 c, S1 p, S3 p ; C2: O3 p, O4 c, T2 p, I2p2 o, S2 c
    expect(byC).toEqual({ C1: [8, 3, 1, 3, 1], C2: [5, 2, 0, 2, 1] })
    // Cards de status somam os 4 tipos (consistentes com o Resumo/Excel)
    expect(m.allStatus).toEqual({ completed: 5, inProgress: 1, pending: 5, overdue: 2 })
  })
  it("[BUG 1] 'No Prazo' compara por DIA (concluído no dia do vencimento está no prazo)", () => {
    // O1 concluída 20/10 10:00 (venc 20/10) e O4 13/10 22:30 (venc 13/10): ambas no prazo → 2/2 = 100%
    const m = buildReportModel(data(), OUT)
    expect([m.onTime.obligations.onTime, m.onTime.obligations.completed, m.onTime.obligations.rate]).toEqual([2, 2, 100])
    // Todos os tipos (o que o card/capa mostram): O1, O4, S2 no prazo; T1 e I1-p5 com atraso → 3/5
    expect([m.onTime.all.onTime, m.onTime.all.completed, m.onTime.all.rate]).toEqual([3, 5, 60])
    expect(buildReportData(m).kpis.taxaNoPrazo).toBe(60)
  })
  it("[BUG 4] filtro de status 'Concluída' mantém a parcela concluída no período", () => {
    const m = buildReportModel(data(), { ...OUT, statuses: ["completed"] })
    expect([m.parcelasCompleted, m.totalParcelas]).toEqual([1, 1])
  })
  it("[BUG 4] filtro de status 'Atrasada' não traz parcela CONCLUÍDA junto", () => {
    const m = buildReportModel(data(), { ...OUT, range: { from: "2026-09-01", to: "2026-10-31" }, statuses: ["overdue"] })
    expect(m.parcelasInRange.map((p) => `${p.inst.id}-p${p.parcelaNumber}:${p.status}`)).toEqual(["I2-p2:overdue"])
  })
  it("[BUG 5] tabela 'Parcelamentos no período' mostra as parcelas DO período", () => {
    const m = buildReportModel(data(), { ...OUT, range: { from: "2026-09-01", to: "2026-09-30" } })
    const rows = m.installmentsInPeriodTable.map((r) => `${r.inst.id} ${r.parcela} ${ymd(r.dueDate)} ${r.effStatus}`)
    expect(rows).toEqual(["I2 1/6 2026-09-15 completed", "I1 4/12 2026-09-21 completed"])
  })
  it("[BUG 13] mês do heatmap usa a data LOCAL: range terminando dia 1 fica no mês certo", () => {
    const m = buildReportModel(data(), { ...OUT, range: { from: "2026-10-26", to: "2026-11-01" } })
    expect(m.heatmapMonthKey).toBe("2026-11")
  })
  it("[OK] compliance A/B/C (dados completos)", () => {
    const c = Object.fromEntries(calculateClientCompliance(clients, obls, taxes, installments, services).map((x) => [x.client.id, [x.totalItems, x.completed, x.completedOnTime, x.currentlyOverdue, x.onTimeRate, x.grade]]))
    expect(c).toEqual({ C1: [9, 3, 1, 1, 33, "C"], C2: [7, 2, 2, 2, 100, "B"] })
  })
})

describe("4. Evolução / heatmaps / previsão", () => {
  it("[BUG 3] monthlyEvolutionBuckets conta parcela a parcela", () => {
    const b = Object.fromEntries(monthlyEvolutionBuckets(obls, taxes, installments, 12, new Date(), [], services).map((x) => [x.key, [x.concluidas, x.atrasadas, x.pendentes]]))
    // Setembro: O5 concl, T3 atras, I1-p4 concl, I2-p1 concl → [3,1,0]
    expect(b["2026-09"]).toEqual([3, 1, 0])
    // Outubro: concl O1,O4,T1,I1-p5,S2 ; atras O2,I2-p2 ; pend O3,O7,T2,S1,S3
    expect(b["2026-10"]).toEqual([5, 2, 5])
  })
  it("[BUG 3] heatmapByDay (Picos de vencimento) conta todas as parcelas", () => {
    const out = heatmapByDay(obls, taxes, installments, 2026, 9, services)
    const nov = heatmapByDay(obls, taxes, installments, 2026, 10, services)
    expect(nov[15]).toBe(1) // I2-p3 16/11
    expect(out[19]).toBe(3) // O1, T1, I1-p5
  })
  it("[BUG 3] UpcomingForecast 'Próximo mês' (dashboard em Out/26) conta todas as parcelas", () => {
    // Novembro tem I1-p6 (23/11) e I2-p3 (16/11) → 2
    const f = upcomingForecastCounts(obls, taxes, installments, services, "2026-10")
    expect(f.counts.parcs).toBe(2)
    expect(f.counts.obs).toBe(1) // O6
  })
  it("[OK] completionsByDay usa o dia LOCAL da conclusão", () => {
    const c = completionsByDay(obls, taxes, installments, 2026, 9, services)
    const nz = Object.fromEntries(c.map((v, i) => [i + 1, v]).filter(([, v]) => v))
    expect(nz).toEqual({ 5: 1, 13: 1, 20: 1, 21: 1, 23: 1 })
  })
  it("[OK] averageCompletionDays", () => {
    expect(averageCompletionDays([])).toBeNull()
    expect(averageCompletionDays(obls)).toBe(19.5)
  })
  it("[OK] effectiveStatus / urgencyTier — vence hoje não é atrasado", () => {
    expect(effectiveStatus({ status: "pending", calculatedDueDate: "2026-10-26" })).toBe("pending")
    expect(effectiveStatus({ status: "in_progress", calculatedDueDate: "2026-10-25" })).toBe("overdue")
    expect(urgencyTier(new Date(2026, 9, 26), "pending")).toBe("today")
  })
  it("[OK] ranges de date-range", () => {
    expect(obligationsInRange(obls, { from: "2026-10-26", to: "2026-10-26" }).map((o) => o.id)).toEqual(["O3"])
    expect(taxesInRange(taxes, { from: "2026-10-26", to: "2026-10-26" }).map((t) => t.id)).toEqual(["T2", "T4"])
    expect(servicesInRange(services, { from: "2026-10-26", to: "2026-10-26" }).map((t) => t.id)).toEqual(["S1"])
  })
})

describe("6. Calendário (lib/calendar-items)", () => {
  const model = (year: number, month0: number, f: CalendarFilters = {}) => {
    const items = buildCalendarItems({ obligations: obls, taxes, installments, clients }, year, month0)
    const filtered = filterCalendarItems(items, f)
    return { items, filtered, summary: calendarMonthSummary(filtered, year, month0) }
  }
  const ids = (list: { id: string; refId: string; kind: string }[]) => list.map((i) => (i.kind === "installment" ? i.refId : i.id)).sort()

  it("[BUG 6] contador 'atrasado(s)' do mês não conta itens que vencem HOJE", () => {
    const m = model(2026, 9)
    expect(m.summary.overdue).toBe(2) // O2, I2-p2
    const day26 = m.filtered.filter((i) => ymd(i.dueDate) === "2026-10-26")
    expect(day26.length).toBeGreaterThan(0)
    expect(dayHasOverdue(day26)).toBe(false)
  })
  it("[BUG 7] filtro por cliente mostra as guias do cliente (com o nome dele)", () => {
    const m = model(2026, 9, { clientFilter: "C2" })
    const oct = m.filtered.filter((i) => i.dueDate.getMonth() === 9)
    expect(ids(oct)).toEqual(["I2", "O3", "tax-T2"])
    expect(oct.find((i) => i.id === "tax-T2")?.clientName).toBe("Beta ME")
  })
  it("[BUG 8] filtro de status 'Atrasada' acha pendentes vencidos; selo mostra Atrasada", () => {
    const m = model(2026, 9, { statusFilter: "overdue" })
    const oct = m.filtered.filter((i) => i.dueDate.getMonth() === 9)
    expect(ids(oct)).toEqual(["I2", "O2"])
    expect(oct.every((i) => i.status === "overdue")).toBe(true)
  })
  it("[BUG 3] mês futuro mostra todas as parcelas do mês (não só a atual)", () => {
    const m = model(2026, 10)
    expect(m.summary.total).toBe(3) // O6, I1-p6, I2-p3
    expect(m.filtered.filter((i) => i.kind === "installment").map((i) => i.meta).sort()).toEqual(["Parcela 3/6", "Parcela 6/12"])
  })
})

describe("7. Exportações", () => {
  const shown = (v: unknown) => (v instanceof Date ? `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}` : String(v))

  it("[BUG 11] export de obrigações: filtro de datas inclui o ÚLTIMO dia do período", () => {
    const d = filterObligationsForExport(obls, { dateStart: "2026-10-01", dateEnd: "2026-10-26" })
    expect(d.map((o) => o.id).sort()).toEqual(["O1", "O2", "O3", "O4"])
    // só um dos limites também funciona
    expect(filterObligationsForExport(obls, { dateEnd: "2026-09-30" }).map((o) => o.id)).toEqual(["O5"])
  })
  it("[BUG 11] export de obrigações: status efetivo e coluna Competência", () => {
    const col = (h: string) => OBLIGATION_EXPORT_COLUMNS.find((c) => c.header === h)!
    const o2 = obls.find((o) => o.id === "O2")!
    const o3 = obls.find((o) => o.id === "O3")!
    expect(col("Status").accessor(o2)).toBe("Atrasado")
    expect(col("Status").accessor(o3)).toBe("Pendente")
    expect(col("Competência").accessor(o2)).toBe("09/2026")
  })
  it("[BUG 11] export de obrigações respeita a aba visível (?tab=)", () => {
    expect(filterObligationsByTab(obls, "overdue").map((o) => o.id)).toEqual(["O2"])
    expect(filterObligationsByTab(obls, "pending").map((o) => o.id).sort()).toEqual(["O3", "O6"])
    expect(filterObligationsByTab(obls, "all")).toHaveLength(obls.length)
  })
  it("[BUG 12] exportToXlsx grava a data LOCAL (conclusão às 22:30 não vira o dia seguinte)", async () => {
    const rows = obls.filter((o) => ["O1", "O4"].includes(o.id))
    const wb = await buildXlsxWorkbook({
      sheetName: "Obrigações", rows,
      columns: [
        { header: "Obrigação", accessor: (o) => o.name },
        { header: "Vencimento", accessor: (o) => new Date(new Date(o.calculatedDueDate).getTime()) },
        { header: "Concluída em", accessor: (o) => (o.completedAt ? new Date(o.completedAt) : "") },
      ],
    })
    // round-trip pelo formato do arquivo
    const ExcelJS = (await import("exceljs")).default
    const back = new ExcelJS.Workbook()
    await back.xlsx.load(await wb.xlsx.writeBuffer())
    const ws = back.worksheets[0]
    const table = [2, 3].map((r) => [ws.getCell(r, 1).value, shown(ws.getCell(r, 2).value), shown(ws.getCell(r, 3).value)])
    expect(table[0]).toEqual(["O1", "20/10/2026", "20/10/2026"])
    expect(table[1]).toEqual(["O4", "13/10/2026", "13/10/2026"])
    expect(ws.getColumn(3).numFmt).toBe("dd/mm/yyyy")
  })
  it("[OK] CSV: BOM, ';', datas pt-BR no fuso local", () => {
    const txt = buildCsv({ rows: obls.filter((o) => o.id === "O4"), columns: [
      { header: "Obrigação", accessor: (o) => o.name },
      { header: "Concluída em", accessor: (o) => (o.completedAt ? new Date(o.completedAt) : "") },
      { header: "Valor", accessor: () => 1234.5 },
    ] })
    expect(txt.charCodeAt(0)).toBe(0xfeff)
    expect(txt.slice(1).split("\n")[1]).toContain('"13/10/2026"')
  })
  it("[BUG 15] CSV injection: valores que começam com = + - @ TAB CR são neutralizados", () => {
    const evil = ["=HYPERLINK(\"x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd", "normal"]
    const txt = buildCsv({ rows: evil, columns: [{ header: "v", accessor: (s) => s }, { header: "n", accessor: () => -5 }] })
    const lines = txt.slice(1).split("\n").slice(1)
    expect(lines.map((l) => l.split(";")[0])).toEqual([
      "\"'=HYPERLINK(\"\"x\"\")\"", "\"'+1+1\"", "\"'-2+3\"", "\"'@SUM(A1)\"", "\"'\tcmd\"", "\"'\rcmd\"", "\"normal\"",
    ])
    // números negativos legítimos não são alterados
    expect(lines[0].split(";")[1]).toBe('"-5"')
  })
  it("[OK] PDF tabular: datas locais", async () => {
    const doc = await buildTablePdf({ title: "Relatório de Obrigações", rows: obls.filter((o) => o.id === "O4"), columns: [
      { header: "Obrigação", accessor: (o) => o.name },
      { header: "Concluída em", accessor: (o) => (o.completedAt ? new Date(o.completedAt) : "") },
    ] })
    const pages = await pdfPages(doc.output("arraybuffer"))
    expect(pages.join("\n")).toContain("13/10/2026")
  })

  it("[BUG 12/18] relatório Excel + PDF: datas reais, rótulos e cabeçalho único por página", async () => {
    const m = buildReportModel(data(), { range: { from: "2026-10-01", to: "2026-10-31" }, clientIds: [], statuses: [], scope: "all" })
    const rep = buildReportData(m, "26/10/2026, 10:00:00")
    const wb = await buildRelatorioWorkbook(rep)
    const ExcelJS = (await import("exceljs")).default
    const back = new ExcelJS.Workbook()
    await back.xlsx.load(await wb.xlsx.writeBuffer())
    const dump = (name: string) => { const ws = back.getWorksheet(name)!; const out: unknown[][] = []; ws.eachRow((r) => out.push((r.values as unknown[]).slice(1))); return out }
    expect(dump("Resumo").filter((r) => typeof r[1] === "number")).toEqual([
      ["Obrigações", 5, 2, 1, 1, 1], ["Guias de imposto", 3, 1, 0, 2, 0], ["Parcelamentos", 2, 1, 0, 0, 1], ["Serviços", 3, 1, 0, 2, 0],
    ])
    const capa = Object.fromEntries(dump("Capa").filter((r) => r.length >= 3).map((r) => [r[1], r[2]]))
    expect(capa["Taxa no prazo (todos os tipos)"]).toBe("60%")
    // Concluídas: data real (célula Date, formato dd/mm/yyyy), no dia LOCAL.
    // dump: título + cabeçalho (a linha vazia de respiro não é listada) → slice(2)
    const concl = dump("Concluídas").slice(2).map((r) => `${r[1]}=${shown(r[3])}`)
    expect(concl).toContain("O4=13/10/2026")
    expect(concl).toContain("S2=05/10/2026")
    expect(back.getWorksheet("Concluídas")!.getCell(4, 4).numFmt).toBe("dd/mm/yyyy")
    // Atrasadas: vencimento como data real
    const atras = dump("Atrasadas").slice(2).map((r) => `${r[1]}=${shown(r[3])}`)
    expect(atras).toEqual(["O2=15/10/2026", "Simples Parc — parcela 2/6=15/10/2026"])

    const pages = await pdfPages(buildRelatorioPdf(rep).output("arraybuffer"))
    const all = pages.join("\n")
    expect(all).toContain("Simples Parc — parcela 2/6")
    expect(all).toContain("Taxa no prazo (todos os tipos)".toUpperCase())
    pages.forEach((p, i) => {
      const count = (s: string) => p.split(s).length - 1
      expect(count("Gerado em 26/10/2026")).toBe(1)
      expect(count(`Página ${i + 1} de ${pages.length}`)).toBe(1)
      expect(count("Página")).toBe(1)
    })
  })
})

async function pdfPages(buf: ArrayBuffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise
  const out: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.push(c.items.map((it: any) => it.str).join("\n"))
  }
  return out
}
