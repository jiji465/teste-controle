import type {
  DashboardStats,
  ObligationWithDetails,
  Client,
  Tax,
  Obligation,
  Installment,
  Service,
} from "./types"
import {
  getCurrentParcelaDueDate,
  getParcelaDueDate,
  getParcelaInfo,
  listParcelas,
  type ParcelaInfo,
} from "./installment-dates"
import {
  calculateDueDate,
  calculateDueDateFromCompetency,
  isOverdue,
  isUpcomingThisWeek,
  parseLocalDate,
} from "./date-utils"
import { effectiveStatus, isCriticalNow } from "./obligation-status"
import { dateInRange, type DateRange } from "./date-range"

export const getObligationsWithDetails = (
  obligations: Obligation[],
  clients: Client[],
  taxes: Tax[],
): ObligationWithDetails[] => {
  return obligations
    .filter((obligation) => clients.some((c) => c.id === obligation.clientId))
    .map((obligation) => {
      const client = clients.find((c) => c.id === obligation.clientId)!
      const tax = obligation.taxId ? taxes.find((t) => t.id === obligation.taxId) : undefined

      // Preferimos calcular a data a partir do mês de competência (novo padrão).
      // Se não houver, caímos no cálculo antigo baseado em dueMonth/frequency.
      const fromCompetency = calculateDueDateFromCompetency(
        obligation.competencyMonth,
        obligation.dueDay,
        obligation.weekendRule,
        obligation.dueMonth, // anuais com data fixa (DEFIS=3, DASN-SIMEI=5)
      )
      const calculatedDueDate = (
        fromCompetency ??
        calculateDueDate(
          obligation.dueDay,
          obligation.dueMonth,
          obligation.frequency,
          obligation.weekendRule,
        )
      ).toISOString()

      return {
        ...obligation,
        client,
        tax,
        calculatedDueDate,
      }
    })
}

/** "YYYY-MM" do dia LOCAL da data. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** "YYYY-MM" do mês corrente (fuso local). */
export function currentMonthKey(ref: Date = new Date()): string {
  return monthKeyOf(ref)
}

const isMonthPeriod = (period: string) => /^\d{4}-\d{2}$/.test(period)

/** Verifica se uma data cai no período selecionado ("YYYY-MM" ou "all"). */
function inPeriod(date: Date | string | null | undefined, period: string): boolean {
  if (period === "all" || !isMonthPeriod(period)) return true
  if (!date) return true
  // parseLocalDate evita o bug de fuso UTC-3: new Date("2026-05-31") seria
  // 21h do dia 30 no Brasil, jogando a data pro mês errado na virada.
  const d = parseLocalDate(date)
  if (Number.isNaN(d.getTime())) return true
  return monthKeyOf(d) === period
}

/** Data venceu num mês ANTERIOR ao período "YYYY-MM". */
function beforePeriod(date: Date | string | null | undefined, period: string): boolean {
  if (!date || !isMonthPeriod(period)) return false
  const d = parseLocalDate(date)
  if (Number.isNaN(d.getTime())) return false
  return monthKeyOf(d) < period
}

// ─── Parcelamentos: 1 registro = N parcelas ──────────────────────────────

/** Parcelamento "sintético" representando UMA parcela: status, data e
 *  conclusão são DA PARCELA (não do parcelamento inteiro). */
export type PeriodInstallment = Installment & { calculatedDueDate: string; parcelaNumber: number }

function toPeriodInstallment(inst: Installment, p: ParcelaInfo): PeriodInstallment {
  const done = p.status === "completed"
  return {
    ...inst,
    status: p.status,
    // completedAt da PARCELA (não do parcelamento todo). Importante pra
    // "Taxa no Prazo": compara doneAt da parcela <= vencimento da parcela.
    completedAt: done ? p.doneAt : undefined,
    completedBy: done ? p.doneBy : undefined,
    calculatedDueDate: p.dueDate.toISOString(),
    parcelaNumber: p.parcelaNumber,
  }
}

/**
 * Parcelas de um parcelamento que caem no período "YYYY-MM", cada uma como
 * um parcelamento sintético (status/data/conclusão DA PARCELA). Um mês pode
 * ter DUAS parcelas (ex.: dia 31 adiado por fim de semana) — todas entram.
 *
 * period === "all" → só a parcela atual (próxima a concluir).
 */
export function installmentParcelasInPeriod(inst: Installment, period: string): PeriodInstallment[] {
  if (period === "all" || !isMonthPeriod(period)) {
    return [toPeriodInstallment(inst, getParcelaInfo(inst, inst.currentInstallment))]
  }
  return listParcelas(inst, (d) => monthKeyOf(d) === period).map((p) => toPeriodInstallment(inst, p))
}

/**
 * Compat: PRIMEIRA parcela do período (ou a atual quando "all"). Prefira
 * `installmentParcelasInPeriod`, que devolve todas as parcelas do mês.
 */
export function installmentInPeriod(inst: Installment, period: string): PeriodInstallment | null {
  return installmentParcelasInPeriod(inst, period)[0] ?? null
}

// ─── Seleção do período (fonte única do Dashboard) ───────────────────────

export type PeriodData = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  services: Service[]
}

export type TaxWithDueDate = Tax & { calculatedDueDate?: string }

export type PeriodSelection = {
  obligations: ObligationWithDetails[]
  taxes: TaxWithDueDate[]
  /** Parcelamentos com ao menos uma parcela no período (registro inteiro). */
  installments: Installment[]
  /** Parcelas individuais do período (uma entrada por parcela). */
  installmentParcels: PeriodInstallment[]
  services: Service[]
  /** Quantos itens atrasados de meses anteriores foram trazidos pro período. */
  carriedOverdue: number
}

export type PeriodSelectionOptions = {
  /**
   * Quando o período é o MÊS ATUAL: inclui também os itens NÃO concluídos que
   * venceram em meses anteriores (continuam atrasados — mesma regra do sino
   * de alertas, hooks/use-task-alerts.ts). Sem isso o Dashboard dizia "Tudo
   * em dia" no mês corrente enquanto o sino mostrava atrasos de meses passados.
   */
  carryOverdue?: boolean
}

const taxDueDate = (t: Tax): Date | null =>
  calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)

/** Seleciona os itens de um período ("YYYY-MM" ou "all"). */
export function selectPeriodItems(
  data: PeriodData,
  period: string,
  opts: PeriodSelectionOptions = {},
): PeriodSelection {
  const carry = !!opts.carryOverdue && isMonthPeriod(period)
  let carried = 0
  const carriedOverdue = (date: Date | string | null | undefined, item: { status: string }) => {
    if (!carry || !beforePeriod(date, period)) return false
    const ok = effectiveStatus({ status: item.status, calculatedDueDate: date ?? undefined }) === "overdue"
    if (ok) carried++
    return ok
  }

  const obligations = data.obligations.filter(
    (o) => inPeriod(o.calculatedDueDate, period) || carriedOverdue(o.calculatedDueDate, o),
  )

  const taxes: TaxWithDueDate[] = data.taxes
    .map((t) => {
      const date = taxDueDate(t)
      return { ...t, calculatedDueDate: date ? date.toISOString() : undefined }
    })
    .filter((t) => inPeriod(t.calculatedDueDate, period) || carriedOverdue(t.calculatedDueDate, t))

  const installmentParcels: PeriodInstallment[] = []
  const installments: Installment[] = []
  for (const inst of data.installments) {
    const parcels = installmentParcelasInPeriod(inst, period)
    if (carry) {
      for (const p of listParcelas(inst, (d) => beforePeriod(d, period))) {
        if (p.status === "overdue") {
          parcels.unshift(toPeriodInstallment(inst, p))
          carried++
        }
      }
      parcels.sort((a, b) => a.parcelaNumber - b.parcelaNumber)
    }
    if (parcels.length > 0) {
      installments.push(inst)
      installmentParcels.push(...parcels)
    }
  }

  const services = data.services.filter(
    (s) => inPeriod(s.dueDate, period) || carriedOverdue(s.dueDate, s),
  )

  return { obligations, taxes, installments, installmentParcels, services, carriedOverdue: carried }
}

type Bucket = { total: number; completed: number; overdue: number; pending: number }
type StatusBucketable = { status: string; calculatedDueDate?: string | Date }

function emptyBucket(): Bucket {
  return { total: 0, completed: 0, overdue: 0, pending: 0 }
}

function tallyByEffectiveStatus<T extends StatusBucketable>(items: T[]): Bucket {
  const bucket = emptyBucket()
  for (const item of items) {
    bucket.total++
    const eff = effectiveStatus(item)
    if (eff === "completed") bucket.completed++
    else if (eff === "overdue") bucket.overdue++
    else bucket.pending++ // pending + in_progress entram aqui (ainda não concluídos)
  }
  return bucket
}

/** Calcula stats globais do dashboard, considerando os 4 tipos de item
 *  (obrigações + guias + parcelas + serviços) e o período selecionado.
 *
 *  - period === "all" → considera tudo (parcelamento = parcela atual).
 *  - period === "YYYY-MM" → filtra por data calculada de vencimento dentro
 *    do mês; parcelamentos contam CADA parcela do mês. Itens sem data
 *    calculável são incluídos (não dá pra filtrar).
 *  - opts.carryOverdue → ver PeriodSelectionOptions.
 */
export const calculateDashboardStats = (
  clients: Client[],
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  period: string,
  services: Service[] = [],
  opts: PeriodSelectionOptions = {},
): DashboardStats => {
  const sel = selectPeriodItems({ obligations, taxes, installments, services }, period, opts)
  const servicesInPeriod = sel.services.map((s) => ({ ...s, calculatedDueDate: s.dueDate }))

  const oblBucket = tallyByEffectiveStatus(sel.obligations)
  const taxBucket = tallyByEffectiveStatus(sel.taxes)
  const instBucket = tallyByEffectiveStatus(sel.installmentParcels)
  const svcBucket = tallyByEffectiveStatus(servicesInPeriod)

  // Vencendo nos próximos 7 dias — qualquer item ainda em aberto cuja data
  // está dentro de [hoje, hoje+7]. Já dentro do período por construção.
  const openThisWeek = (items: StatusBucketable[]) =>
    items.filter(
      (i) => effectiveStatus(i) !== "completed" && !!i.calculatedDueDate && isUpcomingThisWeek(i.calculatedDueDate),
    ).length
  const upcomingThisWeek =
    openThisWeek(sel.obligations) +
    openThisWeek(sel.taxes) +
    openThisWeek(sel.installmentParcels) +
    openThisWeek(servicesInPeriod)

  const totalItems = oblBucket.total + taxBucket.total + instBucket.total + svcBucket.total
  const completedInPeriod =
    oblBucket.completed + taxBucket.completed + instBucket.completed + svcBucket.completed
  const overdueItems = oblBucket.overdue + taxBucket.overdue + instBucket.overdue + svcBucket.overdue
  const pendingItems = oblBucket.pending + taxBucket.pending + instBucket.pending + svcBucket.pending

  const activeClients = clients.filter((c) => c.status === "active").length

  return {
    totalClients: clients.length,
    activeClients,
    totalItems,
    pendingItems,
    completedInPeriod,
    overdueItems,
    upcomingThisWeek,
    byType: {
      obligations: oblBucket,
      taxes: taxBucket,
      installments: instBucket,
      services: svcBucket,
    },
  }
}

// ─── Indicadores derivados (lógica antes inline nos componentes) ─────────

/** Vencimento de um item de parcelamento: usa a data DA PARCELA quando o
 *  objeto é sintético (PeriodInstallment), senão a parcela atual. */
function installmentDue(i: Installment & { calculatedDueDate?: string }): Date {
  return i.calculatedDueDate ? parseLocalDate(i.calculatedDueDate) : getCurrentParcelaDueDate(i)
}

/** "X itens críticos pra resolver hoje" do hero: atrasados OU vencendo hoje,
 *  dos 4 tipos (isCriticalNow). */
export function heroCriticalCount(
  sel: Pick<PeriodSelection, "obligations" | "taxes" | "installmentParcels" | "services">,
): number {
  let n = 0
  for (const o of sel.obligations) if (isCriticalNow(o)) n++
  for (const t of sel.taxes) {
    const due = t.calculatedDueDate ?? taxDueDate(t)?.toISOString()
    if (isCriticalNow({ status: t.status, calculatedDueDate: due })) n++
  }
  for (const p of sel.installmentParcels) if (isCriticalNow(p)) n++
  for (const s of sel.services) if (isCriticalNow({ status: s.status, calculatedDueDate: s.dueDate })) n++
  return n
}

export type ProductivityStatsResult = {
  completed: number
  inProgress: number
  overdue: number
  onTimeRate: number
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

/** Indicadores de Produtividade (obrigações + guias + parcelas). Para
 *  parcelamentos, passe as parcelas do período (PeriodInstallment) — a data
 *  e a conclusão usadas são as DA PARCELA. */
export function computeProductivityStats(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Array<Installment & { calculatedDueDate?: string }>,
): ProductivityStatsResult {
  let completed = 0
  let inProgress = 0
  let overdue = 0
  let completedOnTime = 0
  let evaluable = 0

  const tally = (status: string, completedAt: string | undefined, dueDate: Date) => {
    if (status === "completed") completed++
    if (status === "in_progress") inProgress++
    if (status !== "completed" && isOverdue(dueDate)) overdue++
    if (completedAt || isOverdue(dueDate)) {
      evaluable++
      if (completedAt && startOfDay(new Date(completedAt)) <= startOfDay(dueDate)) completedOnTime++
    }
  }

  for (const o of obligations) tally(o.status, o.completedAt, parseLocalDate(o.calculatedDueDate))
  for (const t of taxes) {
    const d = taxDueDate(t)
    if (!d) continue
    tally(t.status, t.completedAt, d)
  }
  for (const i of installments) tally(i.status, i.completedAt, installmentDue(i))

  return {
    completed,
    inProgress,
    overdue,
    onTimeRate: evaluable > 0 ? Math.round((completedOnTime / evaluable) * 100) : 0,
  }
}

export type StatusCounts = { pending: number; in_progress: number; completed: number; overdue: number }

/** Contagem por status efetivo (card "Saúde das Tarefas"). */
export function healthStatusCounts(
  obligations: ObligationWithDetails[],
  taxes: Tax[] = [],
  installments: Array<Installment & { calculatedDueDate?: string }> = [],
  services: Service[] = [],
): StatusCounts {
  const c: StatusCounts = { pending: 0, in_progress: 0, completed: 0, overdue: 0 }
  const bump = (s: string) => {
    if (s in c) c[s as keyof StatusCounts]++
  }
  for (const o of obligations) bump(effectiveStatus(o))
  for (const t of taxes) bump(effectiveStatus({ status: t.status, calculatedDueDate: taxDueDate(t) ?? undefined }))
  for (const i of installments) bump(effectiveStatus({ status: i.status, calculatedDueDate: installmentDue(i) }))
  for (const s of services) bump(effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate }))
  return c
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export type UpcomingForecast = {
  isAllPeriods: boolean
  headerLabel: string
  descPrefix: string
  descRef: string
  /** Query string pro link de Relatórios ("" quando sem filtro). */
  link: string
  counts: { obs: number; txs: number; parcs: number; svcs: number }
}

/** "Próximo mês" do Dashboard (ou próximos 30 dias quando "all").
 *  Parcelamentos contam TODAS as parcelas que vencem na janela. */
export function upcomingForecastCounts(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  services: Service[] = [],
  currentMonth?: string,
): UpcomingForecast {
  const isAllPeriods = !currentMonth || currentMonth === "all" || !isMonthPeriod(currentMonth)
  let matches: (d: Date) => boolean
  let headerLabel: string
  let descPrefix: string
  let descRef: string
  let link: string

  if (isAllPeriods) {
    const today = startOfDay(new Date())
    const limit = new Date(today)
    limit.setDate(limit.getDate() + 30)
    matches = (d: Date) => d >= today && d <= limit
    headerLabel = "Próximos 30 dias"
    descPrefix = "O que vence "
    descRef = "nos próximos 30 dias"
    link = ""
  } else {
    const [y, m] = currentMonth.split("-").map(Number)
    const nextDate = new Date(y, m, 1) // m é 1-based → mês seguinte
    const nextKey = monthKeyOf(nextDate)
    matches = (d: Date) => monthKeyOf(d) === nextKey
    headerLabel = "Próximo mês"
    descPrefix = "O que vence em "
    descRef = `${MONTH_NAMES[nextDate.getMonth()]}/${nextDate.getFullYear()}`
    link = `?period=${nextKey}`
  }

  let obs = 0
  let txs = 0
  let parcs = 0
  let svcs = 0
  for (const o of obligations) if (matches(parseLocalDate(o.calculatedDueDate))) obs++
  for (const t of taxes) {
    const d = taxDueDate(t)
    if (d && matches(d)) txs++
  }
  for (const i of installments) parcs += listParcelas(i, matches).length
  for (const s of services) {
    const d = parseLocalDate(s.dueDate)
    if (!Number.isNaN(d.getTime()) && matches(d)) svcs++
  }
  return { isAllPeriods, headerLabel, descPrefix, descRef, link, counts: { obs, txs, parcs, svcs } }
}

// ─── Tempo médio de conclusão ────────────────────────────────────────────

type CompletionTimable = { status: string; completedAt?: string; createdAt: string }

/** Calcula tempo médio (em dias) de criação → conclusão pra um conjunto de
 *  itens concluídos. Retorna null se não há itens concluídos. */
export function averageCompletionDays(items: CompletionTimable[]): number | null {
  let sum = 0
  let count = 0
  for (const item of items) {
    if (item.status !== "completed" || !item.completedAt) continue
    const created = new Date(item.createdAt).getTime()
    const done = new Date(item.completedAt).getTime()
    if (Number.isNaN(created) || Number.isNaN(done)) continue
    if (done < created) continue // sanity
    sum += (done - created) / (1000 * 60 * 60 * 24)
    count++
  }
  if (count === 0) return null
  return Math.round((sum / count) * 10) / 10 // 1 casa decimal
}

// ─── Filtragem por DateRange (pra Relatórios com filtro de data livre) ──

/** Aplica filtro de date range em obrigações (usa calculatedDueDate). */
export function obligationsInRange(
  obligations: ObligationWithDetails[],
  range: DateRange,
): ObligationWithDetails[] {
  if (!range.from && !range.to) return obligations
  return obligations.filter((o) => dateInRange(o.calculatedDueDate, range))
}

/** Aplica filtro de date range em guias (usa data calculada por competência). */
export function taxesInRange(taxes: Tax[], range: DateRange): Tax[] {
  if (!range.from && !range.to) return taxes
  return taxes.filter((t) => {
    const date = taxDueDate(t)
    return date ? dateInRange(date, range) : true
  })
}

/** Expande um parcelamento nas suas PARCELAS individuais que caem no range,
 *  com status DA PARCELA (concluída se tem sentAt/paidAt, atrasada se data
 *  passou, pendente caso contrário).
 *
 *  Usado em Relatórios pra contar "X de Y parcelas concluídas no período"
 *  em vez de "X de Y parcelamentos inteiros" — bate com o modelo mental do
 *  usuário: "enviei a parcela do mês = concluído naquele mês". */
export function installmentParcelasInRange(
  inst: Installment,
  range: DateRange,
): Array<{
  parcelaNumber: number
  dueDate: Date
  status: "completed" | "overdue" | "pending"
  /** Quando ficou concluída (sentAt ou paidAt). */
  doneAt?: string
}> {
  return listParcelas(inst, (d) => dateInRange(d, range)).map((p) => ({
    parcelaNumber: p.parcelaNumber,
    dueDate: p.dueDate,
    status: p.status,
    doneAt: p.doneAt,
  }))
}

/** Filtro de date range pra serviços (compara dueDate). */
export function servicesInRange(services: Service[], range: DateRange): Service[] {
  if (!range.from && !range.to) return services
  return services.filter((s) => dateInRange(s.dueDate, range))
}

/** Aplica filtro de date range em parcelamentos: inclui se QUALQUER parcela
 *  cair no período (não só a atual). Antes só olhava a parcela atual —
 *  resultava em "Parcelamentos: 0/0" quando o filtro era um mês futuro mas
 *  o parcelamento já estava na parcela 5 (passada). */
export function installmentsInRange(installments: Installment[], range: DateRange): Installment[] {
  if (!range.from && !range.to) return installments
  return installments.filter((i) => {
    for (let n = 1; n <= i.installmentCount; n++) {
      if (dateInRange(getParcelaDueDate(i, n), range)) return true
    }
    return false
  })
}

// ─── Contagem mensal pra gráfico de evolução (12 meses) ─────────────────

export type MonthlyBucket = {
  /** "YYYY-MM" */
  key: string
  /** "jan/25" pretty label */
  label: string
  concluidas: number
  atrasadas: number
  pendentes: number
  /** taxa de conclusão (% completed / total) */
  completionRate: number
}

/** Gera buckets mensais para os últimos N meses, somando obrigações + guias
 *  + parcelas + serviços. Usa effectiveStatus pra classificar; parcelamentos
 *  contam PARCELA A PARCELA (cada uma no mês do seu vencimento, com o status
 *  dela).
 *  - clientIds: se fornecido, restringe aos clientes da lista (vazio = todos)
 */
export function monthlyEvolutionBuckets(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  months: number = 12,
  ref: Date = new Date(),
  clientIds: string[] = [],
  services: Service[] = [],
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = []
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  const clientFilter = clientIds.length > 0 ? new Set(clientIds) : null

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    buckets.push({
      key: monthKeyOf(date),
      label: `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`,
      concluidas: 0,
      atrasadas: 0,
      pendentes: 0,
      completionRate: 0,
    })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  const tally = (key: string, eff: string) => {
    const b = byKey.get(key)
    if (!b) return
    if (eff === "completed") b.concluidas++
    else if (eff === "overdue") b.atrasadas++
    else b.pendentes++
  }

  for (const o of obligations) {
    if (clientFilter && !clientFilter.has(o.clientId)) continue
    tally(monthKeyOf(parseLocalDate(o.calculatedDueDate)), effectiveStatus(o))
  }
  for (const t of taxes) {
    if (clientFilter && t.clientId && !clientFilter.has(t.clientId)) continue
    const date = taxDueDate(t)
    if (!date) continue
    tally(monthKeyOf(date), effectiveStatus({ status: t.status, calculatedDueDate: date }))
  }
  for (const i of installments) {
    if (clientFilter && !clientFilter.has(i.clientId)) continue
    for (const p of listParcelas(i, (d) => byKey.has(monthKeyOf(d)))) {
      tally(monthKeyOf(p.dueDate), p.status)
    }
  }
  for (const s of services) {
    if (clientFilter && !clientFilter.has(s.clientId)) continue
    const date = parseLocalDate(s.dueDate)
    if (Number.isNaN(date.getTime())) continue
    tally(monthKeyOf(date), effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate }))
  }

  // Taxa de conclusão por mês
  for (const b of buckets) {
    const total = b.concluidas + b.atrasadas + b.pendentes
    b.completionRate = total > 0 ? Math.round((b.concluidas / total) * 100) : 0
  }
  return buckets
}

// ─── Heatmap: contagem por dia do mês ────────────────────────────────────

/** Conta itens vencendo em cada dia do mês indicado (parcelamentos: TODAS
 *  as parcelas que vencem no mês, não só a atual).
 *  Retorna array onde índice = dia-1 (0 = dia 1, 30 = dia 31).
 *  Dias sem o número (ex: 31 em fev) ficam 0. */
export function heatmapByDay(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  year: number,
  month0: number, // 0-based (jan=0)
  services: Service[] = [],
): number[] {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const counts: number[] = Array(31).fill(0)

  const matches = (d: Date) => d.getFullYear() === year && d.getMonth() === month0

  for (const o of obligations) {
    const d = parseLocalDate(o.calculatedDueDate)
    if (matches(d)) counts[d.getDate() - 1]++
  }
  for (const t of taxes) {
    const d = taxDueDate(t)
    if (d && matches(d)) counts[d.getDate() - 1]++
  }
  for (const i of installments) {
    for (const p of listParcelas(i, matches)) counts[p.dueDate.getDate() - 1]++
  }
  for (const s of services) {
    const d = parseLocalDate(s.dueDate)
    if (!Number.isNaN(d.getTime()) && matches(d)) counts[d.getDate() - 1]++
  }

  // Zera dias inexistentes (ex: 30, 31 em fev)
  for (let i = daysInMonth; i < 31; i++) counts[i] = 0
  return counts
}

// ─── Heatmap de ENTREGAS: conclusões por dia do mês ──────────────────────

/** Conta itens CONCLUÍDOS em cada dia do mês indicado — usa a data real de
 *  entrega (não a de vencimento):
 *   - obrigações / guias / serviços: `completedAt`
 *   - parcelamentos: cada parcela paga conta 1 (usa `paidAt`, senão `sentAt`)
 *
 *  Retorna array onde índice = dia-1 (0 = dia 1, 30 = dia 31). Dias
 *  inexistentes (ex: 31 em fev) ficam 0.
 *
 *  Importante: NÃO usa `new Date("YYYY-MM-DD")` direto (shift de fuso UTC-3);
 *  para `completedAt`/`paidAt` que são ISO completos (com hora), o
 *  `new Date(iso)` é seguro pois representa o instante real. */
export function completionsByDay(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  year: number,
  month0: number, // 0-based (jan=0)
  services: Service[] = [],
): number[] {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const counts: number[] = Array(31).fill(0)

  const tally = (iso: string | undefined | null) => {
    if (!iso) return
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return
    if (d.getFullYear() === year && d.getMonth() === month0) {
      counts[d.getDate() - 1]++
    }
  }

  for (const o of obligations) {
    if (o.status === "completed") tally(o.completedAt)
  }
  for (const t of taxes) {
    if (t.status === "completed") tally(t.completedAt)
  }
  for (const s of services) {
    if (s.status === "completed") tally(s.completedAt)
  }
  // Parcelamentos: cada parcela paga é uma entrega no dia em que foi paga/enviada.
  for (const i of installments) {
    for (const p of i.paidInstallments ?? []) {
      tally(p.paidAt ?? p.sentAt)
    }
  }

  for (let i = daysInMonth; i < 31; i++) counts[i] = 0
  return counts
}
