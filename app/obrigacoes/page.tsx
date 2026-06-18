"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUrlState } from "@/hooks/use-url-state"
import { ObligationList, type ObligationListHandle } from "@/features/obligations/components/obligation-list"
import { GlobalSearch } from "@/components/global-search"
import { ExportDialog } from "@/components/export-dialog"
import { StatFilterBar } from "@/components/stat-filter-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { buildSafeDate } from "@/lib/date-utils"
import { effectiveStatus } from "@/lib/obligation-status"
import { CheckCircle2, Clock, PlayCircle, AlertTriangle, Search, Plus, Download, CalendarDays, FileText } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"

export default function ObligacoesPage() {
  const { obligations: rawObligations, obligationsWithDetails, clients, taxes, refreshData } = useData()
  const [activeTab, setActiveTab] = useUrlState("tab")
  const [searchOpen, setSearchOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const listRef = useRef<ObligationListHandle>(null)
  const { isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()

  const obligations = useMemo(
    () => obligationsWithDetails.filter((o) => isInPeriod(o.calculatedDueDate)),
    [obligationsWithDetails, isInPeriod],
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

  // Usa effectiveStatus pra que pending vencidas sejam classificadas como
  // overdue (e não apareçam em "Pendentes" + "Atrasadas" ao mesmo tempo).
  const pendingObligations = obligations.filter((o) => effectiveStatus(o) === "pending")
  const inProgressObligations = obligations.filter((o) => o.status === "in_progress")
  const completedObligations = obligations.filter((o) => o.status === "completed")
  const overdueObligations = obligations.filter((o) => effectiveStatus(o) === "overdue")

  const getFilteredObligations = () => {
    switch (activeTab) {
      case "pending":
        return pendingObligations
      case "in_progress":
        return inProgressObligations
      case "completed":
        return completedObligations
      case "overdue":
        return overdueObligations
      default:
        return obligations
    }
  }

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

          {/* Cartões de status = resumo + filtro (estilo Dashboard). Clicar
              filtra a lista; o cartão ativo ganha o accent âmbar da marca. */}
          <StatFilterBar
            value={activeTab || "all"}
            onChange={setActiveTab}
            items={[
              { value: "all", label: "Todas", count: obligations.length, icon: FileText, tone: "neutral" },
              { value: "pending", label: "Pendentes", count: pendingObligations.length, icon: Clock, tone: "warning" },
              { value: "in_progress", label: "Em Andamento", count: inProgressObligations.length, icon: PlayCircle, tone: "info" },
              { value: "completed", label: "Concluídas", count: completedObligations.length, icon: CheckCircle2, tone: "success" },
              { value: "overdue", label: "Atrasadas", count: overdueObligations.length, icon: AlertTriangle, tone: "danger" },
            ]}
          />

          <div>
            <ObligationList
              ref={listRef}
              obligations={getFilteredObligations()}
              clients={clients}
              taxes={taxes}
              onUpdate={updateData}
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
