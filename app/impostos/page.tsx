"use client"

import { useEffect, useMemo, useState } from "react"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { useUrlState } from "@/hooks/use-url-state"
import { TaxForm } from "@/features/taxes/components/tax-form"
import { GlobalSearch } from "@/components/global-search"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResizableTableHead } from "@/components/ui/resizable-table-head"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { ExportButton } from "@/components/export-button"
import type { ExportColumn } from "@/lib/export-utils"
import { saveTax, deleteTax } from "@/lib/supabase/database"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { calculateDueDateFromCompetency, formatDate, isOverdue } from "@/lib/date-utils"
import { matchesText } from "@/lib/utils"
import { toast } from "sonner"
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Tag,
  Filter,
  RotateCcw,
  Calendar as CalendarIcon,
  ArrowUpDown,
  Building2,
  CalendarDays,
  Layers,
  Scale,
  AlertCircle as PriorityIcon,
} from "lucide-react"
import { ActiveFilterChips, FilterShell, FilterField, type ActiveChip } from "@/components/filter-panel"
import type { Tax, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"

const RECURRENCE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Personalizado",
}

function getRelativeDate(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Hoje"
  if (diffDays === 1) return "Amanhã"
  if (diffDays === -1) return "Ontem"
  if (diffDays < 0) return `${Math.abs(diffDays)} dias atrás`
  return `Em ${diffDays} dias`
}

export default function ImpostosPage() {
  const { taxes, clients, obligations: rawObligations, refreshData } = useData()
  const { isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()
  const [editingTax, setEditingTax] = useState<Tax | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useUrlState("tab")
  const [regimeFilter, setRegimeFilter] = useUrlState("regime")
  const [scopeFilter, setScopeFilter] = useUrlState("scope")
  const [priorityFilter, setPriorityFilter] = useUrlState("priority")
  const [clientFilter, setClientFilter] = useUrlState("clientId")
  const [competencyFilter, setCompetencyFilter] = useUrlState("competency", "")
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkDueDay, setBulkDueDay] = useState("")
  const [bulkPriority, setBulkPriority] = useState<"" | "low" | "medium" | "high" | "urgent">("")
  const [bulkAssignedTo, setBulkAssignedTo] = useState("")
  const [taxSearch, setTaxSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<"client" | "status" | "dueDate" | "name">("dueDate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const toggleSort = (field: "client" | "status" | "dueDate" | "name") => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    else { setSortBy(field); setSortOrder("asc") }
  }
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (regimeFilter !== "all" ? 1 : 0) +
    (scopeFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (clientFilter && clientFilter !== "all" ? 1 : 0) +
    (competencyFilter && competencyFilter !== "all" ? 1 : 0)

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

  const handleSave = async (tax: Tax) => {
    try {
      await saveTax(tax)
      toast.success("Imposto salvo com sucesso")
      await updateData()
      setEditingTax(undefined)
      setIsFormOpen(false)
    } catch (error) {
      console.error("[impostos] Erro ao salvar imposto:", error)
      toast.error("Erro ao salvar imposto. Tente novamente.")
    }
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir imposto",
      description: "Tem certeza que deseja excluir este imposto? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteTax(id)
          toast.success("Imposto excluído")
          await updateData()
        } catch (error) {
          console.error("[impostos] Erro ao excluir imposto:", error)
          toast.error("Erro ao excluir imposto. Tente novamente.")
        }
      },
    })
  }

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax)
    setIsFormOpen(true)
  }

  const handleNew = () => {
    setEditingTax(undefined)
    setIsFormOpen(true)
  }

  const handleStartTax = async (tax: Tax) => {
    try {
      const updatedTax = { ...tax, status: "in_progress" as const }
      await saveTax(updatedTax)
      await updateData()
    } catch (error) {
      console.error("[v0] Error starting tax:", error)
    }
  }

  const handleCompleteTax = async (tax: Tax) => {
    try {
      const updatedTax = {
        ...tax,
        status: "completed" as const,
        completedAt: new Date().toISOString(),
      }
      await saveTax(updatedTax)
      await updateData()
    } catch (error) {
      console.error("[v0] Error completing tax:", error)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkComplete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Concluir ${selectedIds.size} impostos`,
      description: `Marcar ${selectedIds.size} impostos como concluídos?`,
      confirmLabel: "Concluir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          await Promise.all(
            taxes
              .filter((t) => selectedIds.has(t.id) && t.status !== "completed")
              .map((t) => saveTax({ ...t, status: "completed", completedAt: now })),
          )
          toast.success(`${selectedIds.size} impostos concluídos`)
          clearSelection()
          await updateData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkInProgress = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Iniciar ${selectedIds.size} guias`,
      description: `Marcar ${selectedIds.size} guias como "Em andamento"?`,
      confirmLabel: "Iniciar",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = taxes.filter((t) => selectedIds.has(t.id) && t.status !== "in_progress")
          await Promise.all(
            targets.map((t) =>
              saveTax({ ...t, status: "in_progress", completedAt: undefined, completedBy: undefined }),
            ),
          )
          toast.success(`${targets.length} guias em andamento`)
          clearSelection()
          await updateData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkReopen = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Reabrir ${selectedIds.size} guias`,
      description: `Volta para "Pendente" e limpa a data de entrega.`,
      confirmLabel: "Reabrir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = taxes.filter((t) => selectedIds.has(t.id) && t.status === "completed")
          await Promise.all(
            targets.map((t) =>
              saveTax({ ...t, status: "pending", completedAt: undefined, completedBy: undefined }),
            ),
          )
          toast.success(`${targets.length} guias reabertas`)
          clearSelection()
          await updateData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Excluir ${selectedIds.size} impostos`,
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await Promise.all(Array.from(selectedIds).map((id) => deleteTax(id)))
          toast.success(`${selectedIds.size} impostos excluídos`)
          clearSelection()
          await updateData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const openBulkEdit = () => {
    setBulkDueDay("")
    setBulkPriority("")
    setBulkAssignedTo("")
    setBulkEditOpen(true)
  }

  const handleBulkEditApply = async () => {
    if (selectedIds.size === 0) return
    const dueDayNum = bulkDueDay ? Number(bulkDueDay) : null
    if (dueDayNum !== null && (Number.isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      toast.error("Dia do vencimento deve estar entre 1 e 31")
      return
    }
    if (!dueDayNum && !bulkPriority && !bulkAssignedTo) {
      toast.info("Preencha pelo menos um campo para aplicar")
      return
    }
    setBulkLoading(true)
    try {
      const targets = taxes.filter((t) => selectedIds.has(t.id))
      await Promise.all(
        targets.map((t) => {
          const updated = { ...t }
          if (dueDayNum) updated.dueDay = dueDayNum
          if (bulkPriority) updated.priority = bulkPriority
          if (bulkAssignedTo) updated.assignedTo = bulkAssignedTo
          return saveTax(updated)
        }),
      )
      toast.success(`${targets.length} impostos atualizados`)
      setBulkEditOpen(false)
      clearSelection()
      await updateData()
    } finally {
      setBulkLoading(false)
    }
  }

  const searchedTaxes = useMemo(() => {
    const q = taxSearch.trim()
    return taxes.filter((t) => {
      if (q) {
        const textHit =
          matchesText(t.name, q) ||
          matchesText(t.description, q) ||
          matchesText(t.assignedTo, q) ||
          matchesText(t.protocol, q) ||
          matchesText(t.notes, q) ||
          (t.tags ?? []).some((tag) => matchesText(tag, q)) ||
          (t.scope ? matchesText(t.scope, q) : false) ||
          (t.competencyMonth ? matchesText(t.competencyMonth, q) : false)
        if (!textHit) return false
      }
      const matchesRegime =
        regimeFilter === "all" ||
        !t.applicableRegimes ||
        t.applicableRegimes.length === 0 ||
        t.applicableRegimes.includes(regimeFilter as TaxRegime)
      const matchesScope = scopeFilter === "all" || t.scope === scopeFilter
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter
      const matchesClient =
        !clientFilter || clientFilter === "all" || t.clientId === clientFilter
      const matchesCompetency =
        !competencyFilter || competencyFilter === "all" || t.competencyMonth === competencyFilter
      // Filtro global por período (PeriodSwitcher do topo) — por vencimento calculado.
      // Itens sem competência → calcDate é null → passa (sempre mostrar).
      const calcDate = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule)
      const matchesGlobalPeriod = isInPeriod(calcDate)
      return matchesRegime && matchesScope && matchesPriority && matchesClient && matchesCompetency && matchesGlobalPeriod
    })
  }, [taxes, taxSearch, regimeFilter, scopeFilter, priorityFilter, clientFilter, competencyFilter, isInPeriod])

  const sortedTaxes = useMemo(() => {
    const arr = [...searchedTaxes]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortBy === "name") cmp = a.name.localeCompare(b.name)
      else if (sortBy === "client") {
        const an = clients.find((c) => c.id === a.clientId)?.name ?? ""
        const bn = clients.find((c) => c.id === b.clientId)?.name ?? ""
        cmp = an.localeCompare(bn)
      }
      else if (sortBy === "status") {
        const order = { overdue: 0, pending: 1, in_progress: 2, completed: 3 } as const
        cmp = (order[a.status] ?? 9) - (order[b.status] ?? 9)
      }
      else if (sortBy === "dueDate") {
        const ad = calculateDueDateFromCompetency(a.competencyMonth, a.dueDay, a.weekendRule)
        const bd = calculateDueDateFromCompetency(b.competencyMonth, b.dueDay, b.weekendRule)
        const at = ad ? ad.getTime() : Number.MAX_SAFE_INTEGER
        const bt = bd ? bd.getTime() : Number.MAX_SAFE_INTEGER
        cmp = at - bt
      }
      return sortOrder === "asc" ? cmp : -cmp
    })
    return arr
  }, [searchedTaxes, sortBy, sortOrder, clients])

  const pendingTaxes = sortedTaxes.filter((t) => t.status === "pending")
  const inProgressTaxes = sortedTaxes.filter((t) => t.status === "in_progress")
  const completedTaxes = sortedTaxes.filter((t) => t.status === "completed")
  const overdueTaxes = sortedTaxes.filter((t) => t.status === "overdue")

  const taxExportColumns: ExportColumn<Tax>[] = [
    { header: "Nome", width: 24, accessor: (t) => t.name },
    { header: "Cliente", width: 22, accessor: (t) => clients.find((c) => c.id === t.clientId)?.name ?? "" },
    { header: "Esfera", width: 12, accessor: (t) => t.scope ?? "" },
    { header: "Competência", width: 12, accessor: (t) => t.competencyMonth ?? "" },
    { header: "Dia venc.", width: 10, accessor: (t) => t.dueDay ?? "" },
    { header: "Regimes", width: 28, accessor: (t) => (t.applicableRegimes ?? []).map((r) => TAX_REGIME_LABELS[r as TaxRegime]).join(", ") },
    { header: "Status", width: 12, accessor: (t) => statusLabel(t.status) },
    { header: "Prioridade", width: 10, accessor: (t) => priorityLabel(t.priority) },
    { header: "Responsável", width: 16, accessor: (t) => t.assignedTo ?? "" },
    { header: "Concluído em", width: 14, accessor: (t) => (t.completedAt ? new Date(t.completedAt) : "") },
  ]

  const getFilteredTaxes = () => {
    switch (activeTab) {
      case "pending":
        return pendingTaxes
      case "in_progress":
        return inProgressTaxes
      case "completed":
        return completedTaxes
      case "overdue":
        return overdueTaxes
      default:
        return sortedTaxes
    }
  }

  const getStatusBadge = (status: Tax["status"], completedAt?: string, calculatedDueDate?: Date | null) => {
    // Marca como atrasada dinamicamente se a data calculada já passou
    const isCalculatedOverdue =
      status !== "completed" &&
      calculatedDueDate &&
      isOverdue(calculatedDueDate)

    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="size-3 mr-1" />
            Entregue {completedAt && `em ${new Date(completedAt).toLocaleDateString("pt-BR")}`}
          </Badge>
        )
      case "in_progress":
        if (isCalculatedOverdue) {
          return (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="size-3 mr-1" />
              Atrasada
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <PlayCircle className="size-3 mr-1" />
            Em Andamento
          </Badge>
        )
      case "overdue":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="size-3 mr-1" />
            Atrasada
          </Badge>
        )
      default:
        if (isCalculatedOverdue) {
          return (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="size-3 mr-1" />
              Atrasada
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
            <Clock className="size-3 mr-1" />
            Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">Guias de Imposto</h1>
              {isFiltering && periodLabel && (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <CalendarIcon className="size-3" />
                  {periodLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Guias de pagamento (DARF, GPS, GARE, DAS, GNRE…) por cliente</p>
          </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="size-4" />
                Buscar
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <ExportButton
                filenamePrefix="impostos"
                pdfTitle="Relatório de Impostos"
                sheetName="Impostos"
                columns={taxExportColumns}
                rows={searchedTaxes}
              />
              <Button onClick={handleNew}>
                <Plus className="size-4 mr-2" />
                Nova Guia
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
                <span className="text-sm font-medium">Todos</span>
                <Badge variant="secondary" className="text-xs">
                  {taxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span className="text-sm font-medium">Pendentes</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {pendingTaxes.length}
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
                  {inProgressTaxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-sm font-medium">Concluídos</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                >
                  {completedTaxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-sm font-medium">Atrasados</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  {overdueTaxes.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, descrição, esfera, responsável, protocolo, competência, tags…"
                    value={taxSearch}
                    onChange={(e) => setTaxSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="size-4 mr-2" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 size-5 rounded-full p-0 flex items-center justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Chips de filtros ativos */}
              {(() => {
                const chips: ActiveChip[] = []
                if (clientFilter && clientFilter !== "all") {
                  const c = clients.find((cl) => cl.id === clientFilter)
                  chips.push({ label: `Cliente: ${c?.name ?? "—"}`, onRemove: () => setClientFilter("all") })
                }
                if (competencyFilter) {
                  chips.push({ label: `Competência: ${competencyFilter}`, onRemove: () => setCompetencyFilter("") })
                }
                if (regimeFilter !== "all") {
                  chips.push({ label: `Regime: ${TAX_REGIME_LABELS[regimeFilter as TaxRegime] ?? regimeFilter}`, onRemove: () => setRegimeFilter("all") })
                }
                if (scopeFilter !== "all") {
                  const labels: Record<string, string> = { federal: "Federal", estadual: "Estadual", municipal: "Municipal" }
                  chips.push({ label: `Esfera: ${labels[scopeFilter] ?? scopeFilter}`, onRemove: () => setScopeFilter("all") })
                }
                if (priorityFilter !== "all") {
                  const labels: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa" }
                  chips.push({ label: `Prioridade: ${labels[priorityFilter] ?? priorityFilter}`, onRemove: () => setPriorityFilter("all") })
                }
                return (
                  <ActiveFilterChips
                    chips={chips}
                    onClearAll={() => {
                      setClientFilter("all")
                      setCompetencyFilter("")
                      setRegimeFilter("all")
                      setScopeFilter("all")
                      setPriorityFilter("all")
                    }}
                  />
                )
              })()}

              {showFilters && (
                <FilterShell cols={3}>
                  <FilterField icon={<Building2 className="size-3.5" />} label="Cliente" active={!!clientFilter && clientFilter !== "all"}>
                    <Select value={clientFilter || "all"} onValueChange={setClientFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clientes</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField icon={<CalendarDays className="size-3.5" />} label="Mês de competência" active={!!competencyFilter}>
                    <Input
                      type="month"
                      value={competencyFilter || ""}
                      onChange={(e) => setCompetencyFilter(e.target.value)}
                      placeholder="Qualquer"
                    />
                  </FilterField>
                  <FilterField icon={<Scale className="size-3.5" />} label="Regime tributário" active={regimeFilter !== "all"}>
                    <Select value={regimeFilter} onValueChange={setRegimeFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os regimes</SelectItem>
                        {(Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField icon={<Layers className="size-3.5" />} label="Esfera" active={scopeFilter !== "all"}>
                    <Select value={scopeFilter} onValueChange={setScopeFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="federal">Federal</SelectItem>
                        <SelectItem value="estadual">Estadual</SelectItem>
                        <SelectItem value="municipal">Municipal</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField icon={<PriorityIcon className="size-3.5" />} label="Prioridade" active={priorityFilter !== "all"}>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterField>
                </FilterShell>
              )}

              <BulkActionsBar
                selectedCount={selectedIds.size}
                onClear={clearSelection}
                actions={[
                  { label: "Concluir", icon: <CheckCircle2 className="size-3.5" />, tone: "success", onClick: handleBulkComplete, disabled: bulkLoading },
                  { label: "Em andamento", icon: <PlayCircle className="size-3.5" />, onClick: handleBulkInProgress, disabled: bulkLoading },
                  { label: "Reabrir", icon: <RotateCcw className="size-3.5" />, onClick: handleBulkReopen, disabled: bulkLoading },
                  { label: "Editar", icon: <Pencil className="size-3.5" />, onClick: openBulkEdit, disabled: bulkLoading },
                  { label: "Excluir", icon: <Trash2 className="size-3.5" />, tone: "destructive", onClick: handleBulkDelete, disabled: bulkLoading },
                ]}
              />
              <div className="space-y-4">
                {/* Mobile: cards (até md) */}
                <div className="md:hidden space-y-2">
                  {getFilteredTaxes().length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg py-10 px-4 text-center">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                        <Plus className="size-5 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-sm">Nenhuma guia cadastrada</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-3 max-w-xs mx-auto">
                        Cadastre uma guia ou aplique um template em uma empresa.
                      </p>
                      <Button size="sm" onClick={handleNew}>
                        <Plus className="size-3.5 mr-1.5" /> Nova Guia
                      </Button>
                    </div>
                  ) : (
                    getFilteredTaxes().map((tax) => {
                      const calcDate = calculateDueDateFromCompetency(
                        tax.competencyMonth,
                        tax.dueDay,
                        tax.weekendRule,
                      )
                      return (
                      <div
                        key={tax.id}
                        className={`border rounded-lg p-3 space-y-2 ${
                          selectedIds.has(tax.id) ? "bg-primary/5 border-primary/40" : "bg-card"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selectedIds.has(tax.id)}
                            onCheckedChange={() => toggleSelect(tax.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{tax.name}</span>
                              {tax.scope && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {tax.scope === "federal" ? "Federal" : tax.scope === "estadual" ? "Estadual" : "Municipal"}
                                </Badge>
                              )}
                            </div>
                            {tax.description && (
                              <p className="text-xs text-muted-foreground truncate">{tax.description}</p>
                            )}
                          </div>
                          {getStatusBadge(tax.status, tax.completedAt, calcDate)}
                        </div>

                        <div className="ml-6 grid grid-cols-2 gap-2 text-xs">
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Cliente:</span>{" "}
                            <span className="font-medium">
                              {clients.find((c) => c.id === tax.clientId)?.name || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Vence:</span>{" "}
                            <span className="font-medium">{tax.dueDay ? `Dia ${tax.dueDay}` : "—"}</span>
                          </div>
                          {tax.recurrence && (
                            <div>
                              <Badge variant="secondary" className="text-[10px]">
                                {RECURRENCE_LABELS[tax.recurrence] || tax.recurrence}
                              </Badge>
                            </div>
                          )}
                          {tax.applicableRegimes && tax.applicableRegimes.length > 0 && (
                            <div className="col-span-2 flex flex-wrap gap-1">
                              {tax.applicableRegimes.map((r) => (
                                <span key={r} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TAX_REGIME_COLORS[r]}`}>
                                  {TAX_REGIME_LABELS[r]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="ml-6 flex flex-wrap gap-1.5">
                          {tax.status !== "completed" && (
                            <>
                              {tax.status === "pending" && (
                                <Button size="sm" variant="outline" onClick={() => handleStartTax(tax)} className="h-7 text-xs gap-1">
                                  <PlayCircle className="size-3" /> Iniciar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleCompleteTax(tax)}
                                className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="size-3" /> Concluir
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(tax)} className="h-7 text-xs gap-1">
                            <Pencil className="size-3" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(tax.id)} className="h-7 text-xs gap-1 text-destructive">
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>

                {/* Desktop: tabela (md+) */}
                <div className="border rounded-lg hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              getFilteredTaxes().length > 0 &&
                              getFilteredTaxes().every((t) => selectedIds.has(t.id))
                            }
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedIds(new Set(getFilteredTaxes().map((t) => t.id)))
                              else clearSelection()
                            }}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <ResizableTableHead defaultWidth={280} storageKey="impostos-name">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("name")} className="-ml-3">
                            Imposto <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={260} storageKey="impostos-client">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("client")} className="-ml-3">
                            Cliente <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={160} storageKey="impostos-regimes">Regimes</ResizableTableHead>
                        <ResizableTableHead defaultWidth={180} storageKey="impostos-due">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("dueDate")} className="-ml-3">
                            Vencimento <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={140} storageKey="impostos-status">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("status")} className="-ml-3">
                            Status <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={180} storageKey="impostos-actions">Ações Rápidas</ResizableTableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredTaxes().length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12">
                            <div className="flex flex-col items-center justify-center text-center gap-2">
                              <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-1">
                                <Plus className="size-5 text-muted-foreground" />
                              </div>
                              <p className="font-medium">Nenhuma guia cadastrada</p>
                              <p className="text-sm text-muted-foreground max-w-md">
                                Cadastre uma guia individual ou aplique um template em uma empresa.
                              </p>
                              <Button onClick={handleNew} className="mt-2 gap-2">
                                <Plus className="size-4" /> Nova Guia
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        getFilteredTaxes().map((tax) => {
                          const calculatedDueDate = calculateDueDateFromCompetency(
                            tax.competencyMonth,
                            tax.dueDay,
                            tax.weekendRule,
                          )
                          const isTaxOverdue =
                            calculatedDueDate &&
                            tax.status !== "completed" &&
                            isOverdue(calculatedDueDate)
                          return (
                          <TableRow
                            key={tax.id}
                            data-state={selectedIds.has(tax.id) ? "selected" : undefined}
                            className={
                              selectedIds.has(tax.id)
                                ? "bg-primary/5"
                                : isTaxOverdue
                                  ? "bg-red-50/50 dark:bg-red-950/10"
                                  : ""
                            }
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(tax.id)}
                                onCheckedChange={() => toggleSelect(tax.id)}
                                aria-label={`Selecionar ${tax.name}`}
                              />
                            </TableCell>
                            <TableCell className="max-w-[280px]">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="font-medium truncate">{tax.name}</div>
                                  {tax.priority && tax.priority !== "medium" && (
                                    <Badge
                                      variant="outline"
                                      className={
                                        tax.priority === "urgent"
                                          ? "border-red-500 text-red-700 dark:text-red-400"
                                          : tax.priority === "high"
                                            ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                            : "border-blue-500 text-blue-700 dark:text-blue-400"
                                      }
                                    >
                                      {tax.priority === "urgent"
                                        ? "Urgente"
                                        : tax.priority === "high"
                                          ? "Alta"
                                          : "Baixa"}
                                    </Badge>
                                  )}
                                  {tax.scope && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                      {tax.scope === "federal" ? "Federal" : tax.scope === "estadual" ? "Estadual" : "Municipal"}
                                    </Badge>
                                  )}
                                </div>
                                {tax.description && (
                                  <div className="text-sm text-muted-foreground line-clamp-1">{tax.description}</div>
                                )}
                                {tax.assignedTo && (
                                  <div className="text-xs text-muted-foreground">Responsável: {tax.assignedTo}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {clients.find((c) => c.id === tax.clientId)?.name || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {tax.applicableRegimes && tax.applicableRegimes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {tax.applicableRegimes.map((r) => (
                                    <span
                                      key={r}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TAX_REGIME_COLORS[r]}`}
                                    >
                                      {TAX_REGIME_LABELS[r]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Tag className="size-3" /> Todos
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {calculatedDueDate ? (
                                  <>
                                    <div className="font-mono text-sm font-medium">
                                      {formatDate(calculatedDueDate)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {getRelativeDate(calculatedDueDate)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="font-mono text-sm font-medium">
                                    {tax.dueDay ? `Dia ${tax.dueDay}` : "—"}
                                  </div>
                                )}
                                {tax.competencyMonth && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Competência: <span className="font-mono">{tax.competencyMonth}</span>
                                  </div>
                                )}
                                {tax.recurrence && (
                                  <Badge variant="secondary" className="text-xs">
                                    {RECURRENCE_LABELS[tax.recurrence] || tax.recurrence}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(tax.status, tax.completedAt, calculatedDueDate)}</TableCell>
                            <TableCell>
                              {tax.status !== "completed" && (
                                <div className="flex gap-1">
                                  {tax.status === "pending" && (
                                    <Button size="sm" variant="outline" onClick={() => handleStartTax(tax)} className="h-7 text-xs">
                                      <PlayCircle className="size-3 mr-1" />
                                      Iniciar
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleCompleteTax(tax)}
                                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Concluir
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(tax)}>
                                    <Pencil className="size-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(tax.id)} className="text-destructive">
                                    <Trash2 className="size-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

      <TaxForm tax={editingTax} clients={clients} open={isFormOpen} onOpenChange={setIsFormOpen} onSave={handleSave} />
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        clients={clients}
        taxes={taxes}
        obligations={obligations}
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.size} impostos em lote</DialogTitle>
            <DialogDescription>
              Preencha apenas os campos que deseja alterar. Os demais ficam como estão.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="bulk-tax-due-day">Dia do vencimento (1-31)</Label>
              <Input
                id="bulk-tax-due-day"
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 20 (deixe em branco para manter)"
                value={bulkDueDay}
                onChange={(e) => setBulkDueDay(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Dia 31 em meses sem 31 será ajustado para o último dia automaticamente.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <Select
                value={bulkPriority || "__keep__"}
                onValueChange={(v) => setBulkPriority(v === "__keep__" ? "" : (v as typeof bulkPriority))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">(não alterar)</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-tax-assigned">Responsável</Label>
              <Input
                id="bulk-tax-assigned"
                placeholder="Ex: João Silva (deixe em branco para manter)"
                value={bulkAssignedTo}
                onChange={(e) => setBulkAssignedTo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={bulkLoading}>
              Cancelar
            </Button>
            <Button onClick={handleBulkEditApply} disabled={bulkLoading}>
              Aplicar em {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending": return "Pendente"
    case "in_progress": return "Em andamento"
    case "completed": return "Concluído"
    case "overdue": return "Atrasado"
    default: return s
  }
}

function priorityLabel(p: string): string {
  switch (p) {
    case "urgent": return "Urgente"
    case "high": return "Alta"
    case "medium": return "Média"
    case "low": return "Baixa"
    default: return p
  }
}
