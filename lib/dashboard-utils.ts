import type { DashboardStats, ObligationWithDetails, Client, Tax, Obligation } from "./types"
import {
  calculateDueDate,
  calculateDueDateFromCompetency,
  isOverdue,
  isUpcomingThisWeek,
} from "./date-utils"

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

export const calculateDashboardStats = (
  clients: Client[],
  obligations: ObligationWithDetails[],
): DashboardStats => {
  const pendingObligations = obligations.filter((o) => o.status === "pending")
  const overdueObligations = pendingObligations.filter((o) => isOverdue(o.calculatedDueDate))
  const upcomingThisWeek = pendingObligations.filter((o) => isUpcomingThisWeek(o.calculatedDueDate))

  const today = new Date()
  const completedThisMonth = obligations.filter((o) => {
    if (!o.completedAt) return false
    const completed = new Date(o.completedAt)
    return (
      completed.getMonth() === today.getMonth() &&
      completed.getFullYear() === today.getFullYear() &&
      o.status === "completed"
    )
  }).length

  const activeClients = clients.filter((c) => c.status === "active").length

  return {
    totalClients: clients.length,
    activeClients,
    totalObligations: obligations.length,
    pendingObligations: pendingObligations.length,
    completedThisMonth,
    overdueObligations: overdueObligations.length,
    upcomingThisWeek: upcomingThisWeek.length,
  }
}
