"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ObligationList } from "@/features/obligations/components/obligation-list"
import { GlobalSearch } from "@/components/global-search"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { CheckCircle2, Clock, PlayCircle, AlertTriangle, Search } from "lucide-react"
import { useData } from "@/contexts/data-context"

export default function ObligacoesPage() {
  const { obligations: rawObligations, clients, taxes, refreshData } = useData()
  const [activeTab, setActiveTab] = useState("all")
  const [searchOpen, setSearchOpen] = useState(false)

  const obligations = useMemo(
    () => getObligationsWithDetails(rawObligations, clients, taxes),
    [rawObligations, clients, taxes],
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
    const today = new Date()
    const dueDate = new Date(today.getFullYear(), today.getMonth(), o.dueDay)
    return dueDate < today
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
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-balance">Obrigações Acessórias</h1>
              <p className="text-lg text-muted-foreground">Gerencie todas as obrigações fiscais dos seus clientes</p>
            </div>
            <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
              <Search className="size-4" />
              Buscar
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
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
              <Card className="p-6">
                <ObligationList
                  obligations={getFilteredObligations()}
                  clients={clients}
                  taxes={taxes}
                  onUpdate={updateData}
                />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        clients={clients}
        taxes={taxes}
        obligations={obligations}
      />
    </div>
  )
}
