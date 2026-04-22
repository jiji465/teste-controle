"use client"

import { useEffect, useState, useMemo } from "react"
import { Navigation } from "@/components/navigation"
import { ReportsPanel } from "@/components/reports-panel"
import { useData } from "@/contexts/data-context"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"

export default function RelatoriosPage() {
  const { obligations: rawObligations, clients, taxes, isLoading } = useData()

  const obligations = useMemo(() => {
    if (isLoading || !clients.length) return []
    return getObligationsWithDetails(rawObligations, clients, taxes)
  }, [rawObligations, clients, taxes, isLoading])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-balance">Relatórios</h1>
            <p className="text-lg text-muted-foreground">Análise detalhada de obrigações fiscais e produtividade</p>
          </div>

          <ReportsPanel obligations={obligations} />
        </div>
      </main>
    </div>
  )
}
