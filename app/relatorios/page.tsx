"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/page-skeleton"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/contexts/data-context"

// Painel pesado (gráficos Recharts + exportações): carrega só nesta rota.
const ReportsPanel = dynamic(() => import("@/components/reports-panel").then((m) => m.ReportsPanel), {
  ssr: false,
  loading: () => <PageSkeleton />,
})

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
