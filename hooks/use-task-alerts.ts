"use client"

/**
 * useTaskAlerts — centraliza a lógica de "o que está atrasado / vence em 7 dias"
 * considerando os 4 tipos de tarefa (obrigações, guias, parcelamentos, serviços).
 *
 * Antes essa conta vivia duplicada no top nav e no top-bar. A nova shell
 * (header) consome este hook, mantendo um único lugar pra essa regra.
 */

import { useMemo } from "react"
import { useData } from "@/contexts/data-context"
import { isOverdue, isUpcomingThisWeek, calculateDueDateFromCompetency, parseLocalDate } from "@/lib/date-utils"
import { getCurrentParcelaDueDate } from "@/lib/installment-dates"

export type TaskAlertKind = "obrigacao" | "guia" | "parcela" | "servico"

export type TaskAlert = {
  id: string
  name: string
  clientName: string
  href: string
  dueDate: string
  kind: TaskAlertKind
}

export const ALERT_KIND_LABEL: Record<TaskAlertKind, string> = {
  obrigacao: "Obrigação",
  guia: "Guia",
  parcela: "Parcela",
  servico: "Serviço",
}

export function useTaskAlerts() {
  const { obligationsWithDetails: obsWithDetails, clients, taxes, installments, services } = useData()

  return useMemo(() => {
    const clientName = (id: string | undefined) => clients.find((c) => c.id === id)?.name ?? "—"
    const items: TaskAlert[] = []

    for (const o of obsWithDetails) {
      if (o.status === "completed") continue
      items.push({
        id: `obl-${o.id}`,
        name: o.name,
        clientName: o.client.name,
        href: `/obrigacoes?clientId=${o.clientId}`,
        dueDate: o.calculatedDueDate,
        kind: "obrigacao",
      })
    }
    for (const t of taxes) {
      if (t.status === "completed") continue
      const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      if (!d) continue
      items.push({
        id: `tax-${t.id}`,
        name: t.name,
        clientName: clientName(t.clientId),
        href: `/impostos?clientId=${t.clientId ?? ""}`,
        dueDate: d.toISOString(),
        kind: "guia",
      })
    }
    for (const i of installments) {
      if (i.status === "completed") continue
      const due = getCurrentParcelaDueDate(i)
      items.push({
        id: `inst-${i.id}`,
        name: i.name,
        clientName: clientName(i.clientId),
        href: `/parcelamentos?clientId=${i.clientId}`,
        dueDate: due.toISOString(),
        kind: "parcela",
      })
    }
    for (const s of services) {
      if (s.status === "completed") continue
      items.push({
        id: `svc-${s.id}`,
        name: s.name,
        clientName: clientName(s.clientId),
        href: `/servicos?clientId=${s.clientId}`,
        dueDate: s.dueDate,
        kind: "servico",
      })
    }

    // Comparação por DIA (helpers de date-utils): um item que vence hoje
    // entra em "esta semana" — antes, comparar com a hora atual o descartava.
    const overdueList: TaskAlert[] = []
    const weekList: TaskAlert[] = []
    for (const it of items) {
      if (isOverdue(it.dueDate)) overdueList.push(it)
      else if (isUpcomingThisWeek(it.dueDate)) weekList.push(it)
    }
    const byDate = (a: TaskAlert, b: TaskAlert) =>
      parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime()
    overdueList.sort(byDate)
    weekList.sort(byDate)

    return { overdueList, weekList, totalAlerts: overdueList.length + weekList.length }
  }, [obsWithDetails, taxes, installments, services, clients])
}
