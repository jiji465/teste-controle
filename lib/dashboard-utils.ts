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

/**
 * Para um parcelamento e um período "YYYY-MM" (ou "all"), retorna uma versão
 * "sintética" do parcelamento com:
 *  - status: status DA PARCELA específica que cai no período (NÃO do
 *    parcelamento inteiro). Concluída se tem sentAt/paidAt. Pendente ou
 *    atrasada conforme a data.
 *  - calculatedDueDate: data dessa parcela específica.
 *  - parcelaNumber: número (1..installmentCount).
 *
 * Quando period === "all", usa a parcela atual e o status do parcelamento
 * inteiro (combinado com data da parcela atual via effectiveStatus).
 *
 * Retorna null se nenhuma parcela cai no período (caso "YYYY-MM" sem match).
 *
 * Motivação: o usuário quer que "enviar a parcela do mês" conte como
 * Concluído NAQUELE MÊS, mesmo que o parcelamento inteiro ainda tenha
 * parcelas futuras pendentes.
 */
export function installmentInPeriod(
  inst: Installment,
  period: string,
): (Installment & { calculatedDueDate: string; parcelaNumber: number }) | null {
  const firstDue = new Date(inst.firstDueDate)
  let targetN: number | null = null

  if (period === "all" || !/^\d{4}-\d{2}$/.test(period)) {
    targetN = inst.currentInstallment
  } else {
    for (let n = 1; n <= inst.installmentCount; n++) {
      const d = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (n - 1), inst.dueDay),
        inst.weekendRule,
      )
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (key === period) {
        targetN = n
        break
      }
    }
    if (targetN === null) return null
  }

  const dueDate = adjustForWeekend(
    buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (targetN - 1), inst.dueDay),
    inst.weekendRule,
  )

  // Status da parcela específica: concluída se tem sentAt OU paidAt
  const record = (inst.paidInstallments ?? []).find((p) => p.number === targetN)
  const isDone = !!(record?.paidAt || record?.sentAt)
  let status: Installment["status"]
  if (isDone) {
    status = "completed"
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    status = dueDate < today ? "overdue" : "pending"
  }

  return {
    ...inst,
    status,
    // completedAt da PARCELA (não do parcelamento todo). Importante pra
    // ProductivityStats calcular "Taxa no Prazo" corretamente: compara
    // doneAt da parcela <= dueDate da parcela.
    completedAt: isDone ? record?.paidAt ?? record?.sentAt : undefined,
    completedBy: isDone ? record?.paidBy ?? record?.sentBy : undefined,
    calculatedDueDate: dueDate.toISOString(),
    parcelaNumber: targetN,
  }
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
  services: Service[] = [],
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

  // Parcelamentos no período — usa installmentInPeriod pra obter o status
  // DA PARCELA do mês (não do parcelamento todo). Concluir a parcela de Maio
  // faz o parcelamento contar como "Concluído" no filtro de Maio, mesmo que
  // o parcelamento como um todo continue em andamento (faltam outras parcelas).
  const installmentsInPeriod = installments
    .map((i) => installmentInPeriod(i, period))
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Serviços no período — usam data única (dueDate), não competência
  const servicesInPeriod = services
    .map((s) => ({ ...s, calculatedDueDate: s.dueDate }))
    .filter((s) => inPeriod(s.calculatedDueDate, period))

  const oblBucket = tallyByEffectiveStatus(obligationsInPeriod)
  const taxBucket = tallyByEffectiveStatus(taxesInPeriod)
  const instBucket = tallyByEffectiveStatus(installmentsInPeriod)
  const svcBucket = tallyByEffectiveStatus(servicesInPeriod)

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
    ).length +
    servicesInPeriod.filter(
      (s) => effectiveStatus(s) !== "completed" && isUpcomingThisWeek(s.calculatedDueDate),
    ).length

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
  const out: Array<{
    parcelaNumber: number
    dueDate: Date
    status: "completed" | "overdue" | "pending"
    doneAt?: string
  }> = []
  const firstDue = new Date(inst.firstDueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let n = 1; n <= inst.installmentCount; n++) {
    const date = adjustForWeekend(
      buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (n - 1), inst.dueDay),
      inst.weekendRule,
    )
    if (!dateInRange(date, range)) continue

    const record = (inst.paidInstallments ?? []).find((p) => p.number === n)
    const isDone = !!(record?.paidAt || record?.sentAt)
    let status: "completed" | "overdue" | "pending"
    if (isDone) status = "completed"
    else status = date < today ? "overdue" : "pending"

    out.push({
      parcelaNumber: n,
      dueDate: date,
      status,
      doneAt: record?.paidAt ?? record?.sentAt,
    })
  }
  return out
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
 *  + parcelamentos + serviços. Usa effectiveStatus pra classificar.
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
  for (const s of services) {
    if (clientFilter && !clientFilter.has(s.clientId)) continue
    const date = new Date(s.dueDate)
    if (Number.isNaN(date.getTime())) continue
    const key = bucketKey(date)
    tally(key, effectiveStatus({ status: s.status, calculatedDueDate: s.dueDate }))
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
  services: Service[] = [],
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
  for (const s of services) {
    const d = new Date(s.dueDate)
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
