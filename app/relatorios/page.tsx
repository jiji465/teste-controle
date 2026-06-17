"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import { ReportsPanel } from "@/components/reports-panel"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/contexts/data-context"

export default function RelatoriosPage() {
  const { clients, taxes, installments, services, obligationsWithDetails, isLoading } = useData()

  const obligations = useMemo(
    () => (isLoading || !clients.length ? [] : obligationsWithDetails),
    [obligationsWithDetails, clients.length, isLoading],
  )

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <div className="space-y-5">
        <PageHeader
          icon={BarChart3}
          title="Relatórios"
          description="Análise detalhada de obrigações fiscais e produtividade"
        />

        <ReportsPanel
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          services={services}
          clients={clients}
        />
      </div>
    </div>
  )
}
