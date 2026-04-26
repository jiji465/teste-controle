"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUrlState } from "@/hooks/use-url-state"
import { ObligationList, type ObligationListHandle } from "@/features/obligations/components/obligation-list"
import { GlobalSearch } from "@/components/global-search"
import { ExportDialog } from "@/components/export-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buildSafeDate } from "@/lib/date-utils"
import { CheckCircle2, Clock, PlayCircle, AlertTriangle, Search, Plus, Download, CalendarDays } from "lucide-react"
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

  const pendingObligations = obligations.filter((o) => o.status === "pending")
  const inProgressObligations = obligations.filter((o) => o.status === "in_progress")
  const completedObligations = obligations.filter((o) => o.status === "completed")
  const overdueObligations = obligations.filter((o) => {
    if (o.status === "completed") return false
    if (o.status === "overdue") return true
    // Usa a data calculada (já considera competência + dueDay + weekendRule)
    return new Date(o.calculatedDueDate) < new Date()
  })

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
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">Obrigações Acessórias</h1>
                {isFiltering && periodLabel && (
                  <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                    <CalendarDays className="size-3" />
                    {periodLabel}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Declarações e escriturações ao Fisco (SPED, EFD, ECD, ECF, DCTF, DIRF…)</p>
            </div>
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
                <span className="text-sm font-medium">Todas</span>
                <Badge variant="secondary" className="text-xs">
                  {obligations.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span className="text-sm font-medium">Pendentes</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {pendingObligations.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <PlayCircle className="size-3.5" />
                  <span className="text-sm font-medium">Em Andamento</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  {inProgressObligations.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-sm font-medium">Concluídas</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                >
                  {completedObligations.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-sm font-medium">Atrasadas</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  {overdueObligations.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <ObligationList
                ref={listRef}
                obligations={getFilteredObligations()}
                clients={clients}
                taxes={taxes}
                onUpdate={updateData}
              />
            </TabsContent>
          </Tabs>
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
