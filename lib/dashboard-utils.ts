import type { DashboardStats, ObligationWithDetails, Client, Tax, Obligation, Installment } from "./types"
import {
  adjustForWeekend,
  buildSafeDate,
  calculateDueDate,
  calculateDueDateFromCompetency,
  isUpcomingThisWeek,
} from "./date-utils"
import { effectiveStatus } from "./obligation-status"
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

/** Verifica se uma data cai no período selecionado ("YYYY-MM" ou "all"). */
function inPeriod(date: Date | string | null | undefined, period: string): boolean {
  if (period === "all") return true
  if (!date) return true
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return true
  const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  return yearMonth === period
}

/** Calcula a data da PARCELA ATUAL de um parcelamento (1 registro = N parcelas). */
function installmentDueDate(inst: Installment): Date {
  const firstDue = new Date(inst.firstDueDate)
  const monthsToAdd = inst.currentInstallment - 1
  const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
  return adjustForWeekend(dueDate, inst.weekendRule)
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

/** Calcula stats globais do dashboard, considerando os 3 tipos de item
 *  (obrigações + guias + parcelamentos) e o período selecionado.
 *
 *  - period === "all" → considera tudo.
 *  - period === "YYYY-MM" → filtra por data calculada de vencimento dentro
 *    do mês. Itens sem data calculável são incluídos (não dá pra filtrar).
 */
export const calculateDashboardStats = (
  clients: Client[],
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  period: string,
): DashboardStats => {
  // Obrigações no período (já vêm com calculatedDueDate)
  const obligationsInPeriod = obligations.filter((o) => inPeriod(o.calculatedDueDate, period))

  // Guias no período — calcula data e enriquece pra usar effectiveStatus
  const taxesInPeriod = taxes
    .map((t) => {
      const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      return { ...t, calculatedDueDate: date ? date.toISOString() : undefined }
    })
    .filter((t) => inPeriod(t.calculatedDueDate, period))

  // Parcelamentos no período — inclui se QUALQUER parcela cair no filtro,
  // não só a atual. Sem isso, parcelamento avançado pra parcela 5 (passada)
  // ficava de fora de filtros futuros mesmo tendo parcelas no mês filtrado.
  const installmentsInPeriod = installments
    .filter((i) => {
      if (period === "all") return true
      const firstDue = new Date(i.firstDueDate)
      for (let n = 1; n <= i.installmentCount; n++) {
        const d = adjustForWeekend(
          buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (n - 1), i.dueDay),
          i.weekendRule,
        )
        if (inPeriod(d.toISOString(), period)) return true
      }
      return false
    })
    .map((i) => ({ ...i, calculatedDueDate: installmentDueDate(i).toISOString() }))

  const oblBucket = tallyByEffectiveStatus(obligationsInPeriod)
  const taxBucket = tallyByEffectiveStatus(taxesInPeriod)
  const instBucket = tallyByEffectiveStatus(installmentsInPeriod)

  // Vencendo nos próximos 7 dias — qualquer item ainda em aberto cuja data
  // está dentro de [hoje, hoje+7]. Já dentro do período por construção.
  const upcomingThisWeek =
    obligationsInPeriod.filter(
      (o) => effectiveStatus(o) !== "completed" && isUpcomingThisWeek(o.calculatedDueDate),
    ).length +
    taxesInPeriod.filter(
      (t) =>
        effectiveStatus(t) !== "completed" &&
        t.calculatedDueDate &&
        isUpcomingThisWeek(t.calculatedDueDate),
    ).length +
    installmentsInPeriod.filter(
      (i) => effectiveStatus(i) !== "completed" && isUpcomingThisWeek(i.calculatedDueDate),
    ).length

  const totalItems = oblBucket.total + taxBucket.total + instBucket.total
  const completedInPeriod = oblBucket.completed + taxBucket.completed + instBucket.completed
  const overdueItems = oblBucket.overdue + taxBucket.overdue + instBucket.overdue
  const pendingItems = oblBucket.pending + taxBucket.pending + instBucket.pending

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
    },
  }
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
    const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
    return date ? dateInRange(date, range) : true
  })
}

/** Aplica filtro de date range em parcelamentos: inclui se QUALQUER parcela
 *  cair no período (não só a atual). Antes só olhava a parcela atual —
 *  resultava em "Parcelamentos: 0/0" quando o filtro era um mês futuro mas
 *  o parcelamento já estava na parcela 5 (passada). */
export function installmentsInRange(installments: Installment[], range: DateRange): Installment[] {
  if (!range.from && !range.to) return installments
  return installments.filter((i) => {
    const firstDue = new Date(i.firstDueDate)
    for (let n = 1; n <= i.installmentCount; n++) {
      const date = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (n - 1), i.dueDay),
        i.weekendRule,
      )
      if (dateInRange(date, range)) return true
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
 *  + parcelamentos. Usa effectiveStatus pra classificar.
 *  - clientIds: se fornecido, restringe aos clientes da lista (vazio = todos)
 */
export function monthlyEvolutionBuckets(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  months: number = 12,
  ref: Date = new Date(),
  clientIds: string[] = [],
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = []
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  const clientFilter = clientIds.length > 0 ? new Set(clientIds) : null

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    buckets.push({
      key,
      label: `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`,
      concluidas: 0,
      atrasadas: 0,
      pendentes: 0,
      completionRate: 0,
    })
  }

  const bucketKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

  const tally = (key: string, eff: string) => {
    const b = buckets.find((x) => x.key === key)
    if (!b) return
    if (eff === "completed") b.concluidas++
    else if (eff === "overdue") b.atrasadas++
    else b.pendentes++
  }

  for (const o of obligations) {
    if (clientFilter && !clientFilter.has(o.clientId)) continue
    const key = bucketKey(new Date(o.calculatedDueDate))
    tally(key, effectiveStatus(o))
  }
  for (const t of taxes) {
    if (clientFilter && t.clientId && !clientFilter.has(t.clientId)) continue
    const date = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
    if (!date) continue
    const key = bucketKey(date)
    tally(key, effectiveStatus({ status: t.status, calculatedDueDate: date }))
  }
  for (const i of installments) {
    if (clientFilter && !clientFilter.has(i.clientId)) continue
    const date = installmentDueDate(i)
    const key = bucketKey(date)
    tally(key, effectiveStatus({ status: i.status, calculatedDueDate: date }))
  }

  // Taxa de conclusão por mês
  for (const b of buckets) {
    const total = b.concluidas + b.atrasadas + b.pendentes
    b.completionRate = total > 0 ? Math.round((b.concluidas / total) * 100) : 0
  }
  return buckets
}

// ─── Heatmap: contagem por dia do mês ────────────────────────────────────

/** Conta itens vencendo em cada dia do mês indicado.
 *  Retorna array onde índice = dia-1 (0 = dia 1, 30 = dia 31).
 *  Dias sem o número (ex: 31 em fev) ficam 0. */
export function heatmapByDay(
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
  year: number,
  month0: number, // 0-based (jan=0)
): number[] {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const counts: number[] = Array(31).fill(0)

  const matches = (d: Date) => d.getFullYear() === year && d.getMonth() === month0

  for (const o of obligations) {
    const d = new Date(o.calculatedDueDate)
    if (matches(d)) counts[d.getDate() - 1]++
  }
  for (const t of taxes) {
    const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
    if (d && matches(d)) counts[d.getDate() - 1]++
  }
  for (const i of installments) {
    const d = installmentDueDate(i)
    if (matches(d)) counts[d.getDate() - 1]++
  }

  // Zera dias inexistentes (ex: 30, 31 em fev)
  for (let i = daysInMonth; i < 31; i++) counts[i] = 0
  return counts
}
