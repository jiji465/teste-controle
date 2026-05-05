import type { DashboardStats, ObligationWithDetails, Client, Tax, Obligation, Installment } from "./types"
import {
  adjustForWeekend,
  buildSafeDate,
  calculateDueDate,
  calculateDueDateFromCompetency,
  isUpcomingThisWeek,
} from "./date-utils"
import { effectiveStatus } from "./obligation-status"

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

  // Parcelamentos no período — usa data da parcela atual
  const installmentsInPeriod = installments
    .map((i) => ({ ...i, calculatedDueDate: installmentDueDate(i).toISOString() }))
    .filter((i) => inPeriod(i.calculatedDueDate, period))

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

