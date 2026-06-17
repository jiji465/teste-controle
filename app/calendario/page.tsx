"use client"

import { useMemo } from "react"
import { Calendar } from "lucide-react"
import { FiscalCalendar } from "@/components/fiscal-calendar"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/contexts/data-context"
import { adjustForWeekend, buildSafeDate } from "@/lib/date-utils"
import type { InstallmentWithDetails } from "@/lib/types"

export default function CalendarioPage() {
  const { taxes, installments: rawInstallments, clients, obligationsWithDetails, isLoading } = useData()

  const obligations = isLoading || !clients.length ? [] : obligationsWithDetails

  const installments = useMemo<InstallmentWithDetails[]>(() => {
    if (isLoading || !clients.length) return []
    return rawInstallments
      .filter((inst) => clients.some((c) => c.id === inst.clientId))
      .map((inst) => {
        const client = clients.find((c) => c.id === inst.clientId)!
        const tax = inst.taxId ? taxes.find((t) => t.id === inst.taxId) : undefined
        const firstDue = new Date(inst.firstDueDate)
        const monthsToAdd = inst.currentInstallment - 1
        const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
        const adjusted = adjustForWeekend(dueDate, inst.weekendRule)
        return {
          ...inst,
          client,
          tax,
          calculatedDueDate: adjusted.toISOString(),
        }
      })
  }, [rawInstallments, clients, taxes, isLoading])

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <div className="space-y-5">
        <PageHeader
          icon={Calendar}
          title="Calendário"
          description="Vencimentos de obrigações, impostos e parcelamentos em um só lugar"
        />

        <FiscalCalendar
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          clients={clients}
        />
      </div>
    </div>
  )
}
