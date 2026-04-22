"use client"

import { useEffect, useState, useMemo } from "react"
import { Navigation } from "@/components/navigation"
import { CalendarView } from "@/components/calendar-view"
import { useData } from "@/contexts/data-context"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { adjustForWeekend } from "@/lib/date-utils"

export default function CalendarioPage() {
  const { obligations: rawObligations, taxes, installments: rawInstallments, clients, isLoading } = useData()

  const obligations = useMemo(() => {
    if (isLoading || !clients.length) return []
    return getObligationsWithDetails(rawObligations, clients, taxes)
  }, [rawObligations, clients, taxes, isLoading])

  const installments = useMemo(() => {
    if (isLoading || !clients.length) return []
    return rawInstallments.map((inst) => {
      const client = clients.find((c) => c.id === inst.clientId)!
      const tax = inst.taxId ? taxes.find((t) => t.id === inst.taxId) : undefined

      // Calculate due date for current installment
      const firstDue = new Date(inst.firstDueDate)
      const monthsToAdd = inst.currentInstallment - 1
      const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, inst.dueDay)
      const adjustedDueDate = adjustForWeekend(dueDate, inst.weekendRule)

      return {
        ...inst,
        client,
        tax,
        calculatedDueDate: adjustedDueDate.toISOString(),
      }
    })
  }, [rawInstallments, clients, taxes, isLoading])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calendário</h1>
            <p className="text-muted-foreground mt-2">
              Visualize os vencimentos de obrigações, impostos e parcelamentos
            </p>
          </div>

          <CalendarView obligations={obligations} taxes={taxes} installments={installments} />
        </div>
      </main>
    </div>
  )
}
