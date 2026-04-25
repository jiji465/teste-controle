"use client"

import { useMemo } from "react"
import { ReportsPanel } from "@/components/reports-panel"
import { useData } from "@/contexts/data-context"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"

export default function RelatoriosPage() {
  const { obligations: rawObligations, clients, taxes, installments, isLoading } = useData()

  const obligations = useMemo(() => {
    if (isLoading || !clients.length) return []
    return getObligationsWithDetails(rawObligations, clients, taxes)
  }, [rawObligations, clients, taxes, isLoading])

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada de obrigações fiscais e produtividade</p>
        </div>

        <ReportsPanel obligations={obligations} taxes={taxes} installments={installments} />
      </div>
    </div>
  )
}
