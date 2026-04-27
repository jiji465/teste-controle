"use client"

import { useMemo } from "react"
import { ReportsPanel } from "@/components/reports-panel"
import { useData } from "@/contexts/data-context"

export default function RelatoriosPage() {
  const { clients, taxes, installments, obligationsWithDetails, isLoading } = useData()

  const obligations = useMemo(
    () => (isLoading || !clients.length ? [] : obligationsWithDetails),
    [obligationsWithDetails, clients.length, isLoading],
  )

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada de obrigações fiscais e produtividade</p>
        </div>

        <ReportsPanel obligations={obligations} taxes={taxes} installments={installments} clients={clients} />
      </div>
    </div>
  )
}
