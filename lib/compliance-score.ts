/**
 * Cálculo de "Compliance Score" por cliente — nota A/B/C baseada em
 * taxa de cumprimento no prazo + quantidade de atrasos atuais.
 */
import type { Client, ObligationWithDetails, Tax, Installment } from "./types"
import { effectiveStatus } from "./obligation-status"
import { adjustForWeekend, buildSafeDate, calculateDueDateFromCompetency } from "./date-utils"

export type ComplianceGrade = "A" | "B" | "C"

export type ClientCompliance = {
  client: Client
  totalItems: number
  completed: number
  completedOnTime: number
  currentlyOverdue: number
  onTimeRate: number // 0-100
  grade: ComplianceGrade
}

const startOfDay = (d: Date): Date => {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function deriveTaxDueDate(t: Tax): Date | null {
  return calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
}

function deriveInstallmentDueDate(i: Installment): Date {
  const firstDue = new Date(i.firstDueDate)
  const monthsToAdd = i.currentInstallment - 1
  const raw = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, i.dueDay)
  return adjustForWeekend(raw, i.weekendRule)
}

/** "Concluído no prazo" = completedAt no MESMO DIA do vencimento ou antes.
 *  Normaliza pra dia inteiro (sem hora). */
function completedOnTimeCheck(completedAt: string | undefined, dueDate: Date | null | undefined): boolean {
  if (!completedAt || !dueDate) return false
  const cd = startOfDay(new Date(completedAt))
  const dd = startOfDay(dueDate)
  return cd.getTime() <= dd.getTime()
}

function gradeFor(onTimeRate: number, currentlyOverdue: number): ComplianceGrade {
  if (onTimeRate >= 95 && currentlyOverdue === 0) return "A"
  if (onTimeRate >= 80 && currentlyOverdue <= 2) return "B"
  return "C"
}

/** Calcula compliance pra todos os clientes ativos. */
export function calculateClientCompliance(
  clients: Client[],
  obligations: ObligationWithDetails[],
  taxes: Tax[],
  installments: Installment[],
): ClientCompliance[] {
  const result: ClientCompliance[] = []

  for (const client of clients) {
    if (client.status !== "active") continue

    let totalItems = 0
    let completed = 0
    let completedOnTime = 0
    let currentlyOverdue = 0

    // Obrigações do cliente
    for (const o of obligations) {
      if (o.clientId !== client.id) continue
      totalItems++
      const eff = effectiveStatus(o)
      if (eff === "completed") {
        completed++
        if (completedOnTimeCheck(o.completedAt, new Date(o.calculatedDueDate))) {
          completedOnTime++
        }
      } else if (eff === "overdue") {
        currentlyOverdue++
      }
    }

    // Guias do cliente
    for (const t of taxes) {
      if (t.clientId !== client.id) continue
      totalItems++
      const due = deriveTaxDueDate(t)
      const eff = effectiveStatus({ status: t.status, calculatedDueDate: due ?? undefined })
      if (eff === "completed") {
        completed++
        if (completedOnTimeCheck(t.completedAt, due)) completedOnTime++
      } else if (eff === "overdue") {
        currentlyOverdue++
      }
    }

    // Parcelamentos do cliente — usa a data da parcela atual
    for (const i of installments) {
      if (i.clientId !== client.id) continue
      totalItems++
      const due = deriveInstallmentDueDate(i)
      const eff = effectiveStatus({ status: i.status, calculatedDueDate: due })
      if (eff === "completed") {
        completed++
        if (completedOnTimeCheck(i.completedAt, due)) completedOnTime++
      } else if (eff === "overdue") {
        currentlyOverdue++
      }
    }

    // Sem itens → grade A por convenção (nada pra cobrar)
    const onTimeRate = completed > 0 ? Math.round((completedOnTime / completed) * 100) : 100
    const grade = totalItems === 0 ? "A" : gradeFor(onTimeRate, currentlyOverdue)

    result.push({
      client,
      totalItems,
      completed,
      completedOnTime,
      currentlyOverdue,
      onTimeRate,
      grade,
    })
  }

  return result
}

/** Score ordenado: pior nota primeiro (C → B → A) e, dentro do grupo, mais
 *  atrasos primeiro. Usado pro ranking de "Atenção". */
export function sortWorstFirst(scores: ClientCompliance[]): ClientCompliance[] {
  const order: Record<ComplianceGrade, number> = { C: 0, B: 1, A: 2 }
  return [...scores].sort((a, b) => {
    if (order[a.grade] !== order[b.grade]) return order[a.grade] - order[b.grade]
    if (b.currentlyOverdue !== a.currentlyOverdue) return b.currentlyOverdue - a.currentlyOverdue
    return a.onTimeRate - b.onTimeRate
  })
}

/** Score ordenado: melhor nota primeiro, maior taxa primeiro. Usado pro
 *  "Top performers". */
export function sortBestFirst(scores: ClientCompliance[]): ClientCompliance[] {
  return [...scores].sort((a, b) => {
    const order: Record<ComplianceGrade, number> = { A: 0, B: 1, C: 2 }
    if (order[a.grade] !== order[b.grade]) return order[a.grade] - order[b.grade]
    if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate
    return a.currentlyOverdue - b.currentlyOverdue
  })
}

/** Tier de urgência baseado em quantos dias faltam pro vencimento.
 *  - "overdue": já passou
 *  - "today": vence hoje
 *  - "soon": 1-3 dias
 *  - "week": 4-7 dias
 *  - "month": 8-30 dias
 *  - "later": > 30 dias
 *  - null: já concluído
 */
export type UrgencyTier = "overdue" | "today" | "soon" | "week" | "month" | "later"

export function urgencyTier(dueDate: Date, status: string): UrgencyTier | null {
  if (status === "completed") return null
  const today = startOfDay(new Date())
  const due = startOfDay(dueDate)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "overdue"
  if (diffDays === 0) return "today"
  if (diffDays <= 3) return "soon"
  if (diffDays <= 7) return "week"
  if (diffDays <= 30) return "month"
  return "later"
}
