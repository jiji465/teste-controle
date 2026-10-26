"use client"

import { useMemo } from "react"
import { Calendar } from "lucide-react"
import { FiscalCalendar } from "@/components/fiscal-calendar"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/contexts/data-context"

export default function CalendarioPage() {
  const { taxes, installments: rawInstallments, clients, obligationsWithDetails, isLoading } = useData()

  const obligations = isLoading || !clients.length ? [] : obligationsWithDetails

  // O calendário expande cada parcelamento PARCELA A PARCELA no mês exibido
  // (lib/calendar-items). Antes calculávamos aqui só a parcela atual — meses
  // futuros/passados perdiam as outras parcelas.
  const installments = useMemo(() => {
    if (isLoading || !clients.length) return []
    return rawInstallments.filter((inst) => clients.some((c) => c.id === inst.clientId))
  }, [rawInstallments, clients, isLoading])

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
