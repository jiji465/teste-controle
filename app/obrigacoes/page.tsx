"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUrlState } from "@/hooks/use-url-state"
import { ObligationList, type ObligationListHandle } from "@/features/obligations/components/obligation-list"
import { GlobalSearch } from "@/components/global-search"
import { ExportDialog } from "@/components/export-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Search, Plus, Download, CalendarDays, FileText } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"

export default function ObligacoesPage() {
  const { obligationsWithDetails, clients, taxes, refreshData } = useData()
  const [activeTab, setActiveTab] = useUrlState("tab")
  const [searchOpen, setSearchOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const listRef = useRef<ObligationListHandle>(null)
  const { isInPeriodOrOverdue, periodLabel, isFiltering } = useSelectedPeriod()

  // Período do topo; no mês atual, atrasadas de meses anteriores continuam aqui
  const obligations = useMemo(
    () => obligationsWithDetails.filter((o) => isInPeriodOrOverdue(o.calculatedDueDate, o.status)),
    [obligationsWithDetails, isInPeriodOrOverdue],
  )

  const updateData = async () => {
    await refreshData()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PageHeader
              icon={FileText}
              title="Obrigações Acessórias"
              description="Declarações e escriturações ao Fisco (SPED, EFD, ECD, ECF, DCTF, DIRF…)"
              badge={
                isFiltering && periodLabel ? (
                  <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                    <CalendarDays className="size-3" />
                    {periodLabel}
                  </Badge>
                ) : null
              }
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="size-4" />
                Buscar
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <Button variant="outline" onClick={() => setExportOpen(true)} className="gap-2">
                <Download className="size-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              <Button onClick={() => listRef.current?.openNewForm()}>
                <Plus className="size-4 mr-2" />
                Nova Obrigação
              </Button>
            </div>
          </div>

          {/* Cartões de status (resumo + filtro) ficam dentro da lista: contam
              a lista já filtrada por busca/cliente/prioridade/esfera. */}
          <div>
            <ObligationList
              ref={listRef}
              obligations={obligations}
              clients={clients}
              taxes={taxes}
              onUpdate={updateData}
              activeTab={activeTab || "all"}
              onTabChange={setActiveTab}
            />
          </div>
        </div>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        clients={clients}
        taxes={taxes}
        obligations={obligations}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        obligations={obligations}
        clients={clients}
      />
    </div>
  )
}
