/**
 * Itens do Calendário fiscal — lógica antes inline em
 * components/fiscal-calendar.tsx, extraída pra ser testável.
 *
 *  - Status é o EFETIVO (effectiveStatus): pendente vencido = "overdue";
 *    vence hoje NÃO é atrasado.
 *  - Parcelamentos são expandidos PARCELA A PARCELA no mês visualizado, cada
 *    uma com o status dela (antes só a parcela atual aparecia).
 *  - Guias levam clientId/nome do cliente (antes o filtro por cliente as
 *    escondia e o rótulo era sempre "Guia de Imposto").
 */
import type { Client, Installment, ObligationWithDetails, Priority, Tax } from "./types"
import { calculateDueDateFromCompetency, parseLocalDate } from "./date-utils"
import { effectiveStatus } from "./obligation-status"
import { listParcelas } from "./installment-dates"

export type CalendarItemKind = "obligation" | "tax" | "installment"
export type CalendarItemStatus = "pending" | "in_progress" | "completed" | "overdue"

export type CalendarItem = {
  /** Chave única (parcelas: "inst-<id>-<n>"). */
  id: string
  /** Id do registro de origem (obrigação, guia ou parcelamento). */
  refId: string
  kind: CalendarItemKind
  name: string
  clientId?: string
  clientName: string
  dueDate: Date
  /** Status efetivo. */
  status: CalendarItemStatus
  description?: string
  meta?: string
  priority?: Priority
}

export type CalendarSource = {
  obligations: ObligationWithDetails[]
  taxes: Tax[]
  installments: Installment[]
  clients: Client[]
}

export type CalendarFilters = {
  clientFilter?: string
  kindFilter?: string
  statusFilter?: string
  showCompleted?: boolean
}

const asStatus = (s: string): CalendarItemStatus =>
  s === "completed" || s === "in_progress" || s === "overdue" ? s : "pending"

/** Monta os itens do calendário para o mês visualizado. */
export function buildCalendarItems(src: CalendarSource, year: number, month0: number): CalendarItem[] {
  const items: CalendarItem[] = []
  const clientLabel = (id: string | undefined) => {
    const c = src.clients.find((x) => x.id === id)
    return c ? c.tradeName || c.name : undefined
  }
  const inMonth = (d: Date) => d.getFullYear() === year && d.getMonth() === month0

  for (const o of src.obligations) {
    items.push({
      id: o.id,
      refId: o.id,
      kind: "obligation",
      name: o.name,
      clientId: o.clientId,
      clientName: o.client.name,
      dueDate: parseLocalDate(o.calculatedDueDate),
      status: asStatus(effectiveStatus(o)),
      description: o.description,
      meta: o.tax?.name,
      priority: o.priority,
    })
  }

  // Guias de imposto: se tem competência cadastrada, mostra na data exata
  // calculada. Sem competência (modelo genérico), ignoramos no calendário
  // pra não poluir todo mês.
  for (const t of src.taxes) {
    if (!t.dueDay) continue
    const calc = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
    if (!calc || !inMonth(calc)) continue
    items.push({
      id: `tax-${t.id}`,
      refId: t.id,
      kind: "tax",
      name: t.name,
      clientId: t.clientId,
      clientName: clientLabel(t.clientId) ?? "Guia de Imposto",
      dueDate: calc,
      status: asStatus(effectiveStatus({ status: t.status, calculatedDueDate: calc })),
      description: t.description,
      meta: t.scope ? t.scope.charAt(0).toUpperCase() + t.scope.slice(1) : undefined,
      priority: t.priority,
    })
  }

  // Parcelamentos: TODAS as parcelas que vencem no mês, com status da parcela.
  for (const i of src.installments) {
    for (const p of listParcelas(i, inMonth)) {
      items.push({
        id: `inst-${i.id}-${p.parcelaNumber}`,
        refId: i.id,
        kind: "installment",
        name: i.name,
        clientId: i.clientId,
        clientName: clientLabel(i.clientId) ?? "—",
        dueDate: p.dueDate,
        status: p.status,
        description: i.description,
        meta: `Parcela ${p.parcelaNumber}/${i.installmentCount}`,
        priority: i.priority,
      })
    }
  }

  return items
}

/** Aplica os filtros da toolbar (status comparado pelo status EFETIVO). */
export function filterCalendarItems(items: CalendarItem[], f: CalendarFilters = {}): CalendarItem[] {
  const clientFilter = f.clientFilter ?? "all"
  const kindFilter = f.kindFilter ?? "all"
  const statusFilter = f.statusFilter ?? "all"
  const showCompleted = f.showCompleted ?? false
  return items.filter((item) => {
    // "Esconder concluídas" só vale quando não há filtro explícito de status
    if (!showCompleted && statusFilter === "all" && item.status === "completed") return false
    if (clientFilter !== "all" && item.clientId !== clientFilter) return false
    if (kindFilter !== "all" && item.kind !== kindFilter) return false
    if (statusFilter !== "all" && item.status !== statusFilter) return false
    return true
  })
}

/** Total de vencimentos do mês e quantos estão atrasados (vence hoje não conta). */
export function calendarMonthSummary(items: CalendarItem[], year: number, month0: number) {
  const inMonth = items.filter((i) => i.dueDate.getFullYear() === year && i.dueDate.getMonth() === month0)
  return { total: inMonth.length, overdue: inMonth.filter((i) => i.status === "overdue").length }
}

/** Dia com algum item atrasado (status efetivo). */
export function dayHasOverdue(dayItems: CalendarItem[]): boolean {
  return dayItems.some((i) => i.status === "overdue")
}
