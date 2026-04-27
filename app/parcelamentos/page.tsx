"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResizableTableHead } from "@/components/ui/resizable-table-head"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ExportButton } from "@/components/export-button"
import type { ExportColumn } from "@/lib/export-utils"
import { useUrlState } from "@/hooks/use-url-state"
import { InstallmentForm } from "@/features/installments/components/installment-form"
import { InstallmentDetails } from "@/features/installments/components/installment-details"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { GlobalSearch } from "@/components/global-search"
import { saveInstallment, deleteInstallment } from "@/lib/supabase/database"
import { matchesText } from "@/lib/utils"
import type { Installment } from "@/lib/types"
import { Plus, Search, Pencil, Trash2, Play, CheckCircle2, AlertCircle, Clock, PlayCircle, AlertTriangle, Filter, RotateCcw, Calendar as CalendarIcon, MoreVertical, CreditCard, Building2, AlertCircle as PriorityIcon, Eye } from "lucide-react"
import { FilterBar, FilterPill } from "@/components/filter-panel"
import { formatDate, adjustForWeekend, buildSafeDate } from "@/lib/date-utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { toast } from "sonner"

export default function ParcelamentosPage() {
  const { installments, clients, taxes, obligations: rawObligations, obligationsWithDetails, isLoading: loading, refreshData } = useData()
  const { isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()
  const [statusFilter, setStatusFilter] = useUrlState("tab")
  const [clientFilter, setClientFilter] = useUrlState("client")
  const [priorityFilter, setPriorityFilter] = useUrlState("priority")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewingInstallment, setViewingInstallment] = useState<Installment | undefined>()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkFirstDueDate, setBulkFirstDueDate] = useState("")
  const [bulkDueDay, setBulkDueDay] = useState("")
  const [bulkPriority, setBulkPriority] = useState<"" | "low" | "medium" | "high" | "urgent">("")
  const [bulkWeekendRule, setBulkWeekendRule] = useState<"" | "postpone" | "anticipate" | "keep">("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (clientFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0)

  const obligationsForSearch = obligationsWithDetails

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

  const loadData = async () => {
    await refreshData()
  }

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || "Cliente não encontrado"
  }

  const getTaxName = (taxId?: string) => {
    if (!taxId) return "-"
    return taxes.find((t) => t.id === taxId)?.name || "-"
  }

  const calculateDueDate = (installment: Installment): Date => {
    const firstDue = new Date(installment.firstDueDate)
    const monthsToAdd = installment.currentInstallment - 1
    const dueDate = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, installment.dueDay)
    return adjustForWeekend(dueDate, installment.weekendRule)
  }

  const getStatus = (installment: Installment): "pending" | "in_progress" | "completed" | "overdue" => {
    if (installment.status === "completed") return "completed"
    const dueDate = calculateDueDate(installment)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dueDate < today) return "overdue"
    return installment.status
  }

  const filteredInstallments = useMemo(() => {
    const q = searchTerm.trim()
    return installments.filter((installment) => {
      if (q) {
        const textHit =
          matchesText(installment.name, q) ||
          matchesText(getClientName(installment.clientId), q) ||
          matchesText(getTaxName(installment.taxId), q) ||
          matchesText(installment.description, q) ||
          matchesText(installment.protocol, q) ||
          matchesText(installment.notes, q) ||
          (installment.tags ?? []).some((t) => matchesText(t, q))
        if (!textHit) return false
      }

      const status = getStatus(installment)
      if (statusFilter !== "all" && status !== statusFilter) return false
      if (clientFilter !== "all" && installment.clientId !== clientFilter) return false
      if (priorityFilter !== "all" && installment.priority !== priorityFilter) return false
      // Filtro global por período (PeriodSwitcher) — pelo vencimento da parcela atual
      const dueDate = calculateDueDate(installment)
      if (!isInPeriod(dueDate)) return false
      return true
    })
  }, [installments, searchTerm, statusFilter, clientFilter, priorityFilter, clients, taxes, isInPeriod])

  const installmentExportColumns: ExportColumn<Installment>[] = [
    { header: "Nome", width: 28, accessor: (i) => i.name },
    { header: "Cliente", width: 28, accessor: (i) => getClientName(i.clientId) },
    { header: "Imposto", width: 18, accessor: (i) => getTaxName(i.taxId) },
    { header: "Parcela", width: 12, accessor: (i) => `${i.currentInstallment}/${i.installmentCount}` },
    { header: "1º vencimento", width: 14, accessor: (i) => new Date(i.firstDueDate) },
    { header: "Próx. venc.", width: 14, accessor: (i) => calculateDueDate(i) },
    { header: "Status", width: 12, accessor: (i) => statusLabel(getStatus(i)) },
    { header: "Prioridade", width: 10, accessor: (i) => priorityLabel(i.priority) },
  ]

  const statusCounts = useMemo(() => {
    // Respeita o filtro global de período (PeriodSwitcher) — igual a filteredInstallments
    const inPeriod = installments.filter((inst) => isInPeriod(calculateDueDate(inst)))

    const counts = {
      all: inPeriod.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    }

    inPeriod.forEach((installment) => {
      const status = getStatus(installment)
      counts[status]++
    })

    return counts
  }, [installments, isInPeriod])

  const handleEdit = (installment: Installment) => {
    setSelectedInstallment(installment)
    setIsFormOpen(true)
  }

  const handleView = (installment: Installment) => {
    setViewingInstallment(installment)
    setIsDetailsOpen(true)
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir parcelamento",
      description: "Tem certeza que deseja excluir este parcelamento? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteInstallment(id)
          await loadData()
        } catch (error) {
          console.error("[parcelamentos] Error deleting installment:", error)
          toast.error("Erro ao excluir parcelamento. Tente novamente.")
        }
      },
    })
  }

  const handleStartInstallment = async (installment: Installment) => {
    try {
      const updated = { ...installment, status: "in_progress" as const }
      await saveInstallment(updated)
      await loadData()
    } catch (error) {
      console.error("[v0] Error starting installment:", error)
    }
  }

  const handleCompleteInstallment = async (installment: Installment) => {
    try {
      const updated = {
        ...installment,
        status: "completed" as const,
        completedAt: new Date().toISOString(),
      }
      await saveInstallment(updated)
      await loadData()
    } catch (error) {
      console.error("[v0] Error completing installment:", error)
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
      title: `Concluir ${selectedIds.size} parcelamentos`,
      description: `Marcar ${selectedIds.size} parcelamentos como concluídos?`,
      confirmLabel: "Concluir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          await Promise.all(
            installments
              .filter((i) => selectedIds.has(i.id) && i.status !== "completed")
              .map((i) => saveInstallment({ ...i, status: "completed", completedAt: now })),
          )
          toast.success(`${selectedIds.size} parcelamentos concluídos`)
          clearSelection()
          await loadData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Excluir ${selectedIds.size} parcelamentos`,
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await Promise.all(Array.from(selectedIds).map((id) => deleteInstallment(id)))
          toast.success(`${selectedIds.size} parcelamentos excluídos`)
          clearSelection()
          await loadData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkInProgress = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Iniciar ${selectedIds.size} parcelamentos`,
      description: `Marcar ${selectedIds.size} parcelamentos como "Em andamento"?`,
      confirmLabel: "Iniciar",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = installments.filter((i) => selectedIds.has(i.id) && i.status !== "in_progress")
          await Promise.all(targets.map((i) => saveInstallment({ ...i, status: "in_progress" })))
          toast.success(`${targets.length} parcelamentos em andamento`)
          clearSelection()
          await loadData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkReopen = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Reabrir ${selectedIds.size} parcelamentos`,
      description: `Volta para "Pendente" e limpa a data de conclusão.`,
      confirmLabel: "Reabrir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = installments.filter((i) => selectedIds.has(i.id) && i.status === "completed")
          await Promise.all(
            targets.map((i) =>
              saveInstallment({ ...i, status: "pending", completedAt: undefined, completedBy: undefined }),
            ),
          )
          toast.success(`${targets.length} parcelamentos reabertos`)
          clearSelection()
          await loadData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const openBulkEdit = () => {
    setBulkFirstDueDate("")
    setBulkDueDay("")
    setBulkPriority("")
    setBulkWeekendRule("")
    setBulkEditOpen(true)
  }

  const handleBulkEditApply = async () => {
    if (selectedIds.size === 0) return
    const dueDayNum = bulkDueDay ? Number(bulkDueDay) : null
    if (dueDayNum !== null && (Number.isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      toast.error("Dia do vencimento deve estar entre 1 e 31")
      return
    }
    if (bulkFirstDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(bulkFirstDueDate)) {
      toast.error("Data inválida")
      return
    }
    if (!dueDayNum && !bulkFirstDueDate && !bulkPriority && !bulkWeekendRule) {
      toast.info("Preencha pelo menos um campo para aplicar")
      return
    }
    setBulkLoading(true)
    try {
      const targets = installments.filter((i) => selectedIds.has(i.id))
      await Promise.all(
        targets.map((i) => {
          const updated = { ...i }
          if (bulkFirstDueDate) updated.firstDueDate = bulkFirstDueDate
          if (dueDayNum) updated.dueDay = dueDayNum
          if (bulkPriority) updated.priority = bulkPriority
          if (bulkWeekendRule) updated.weekendRule = bulkWeekendRule
          return saveInstallment(updated)
        }),
      )
      toast.success(`${targets.length} parcelamentos atualizados`)
      setBulkEditOpen(false)
      clearSelection()
      await loadData()
    } finally {
      setBulkLoading(false)
    }
  }

  const getStatusBadge = (installment: Installment) => {
    const status = getStatus(installment)
    const dueDate = calculateDueDate(installment)

    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Concluída {installment.completedAt && `em ${formatDate(installment.completedAt)}`}
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="default" className="bg-info text-info-foreground">
            <Play className="mr-1 h-3 w-3" />
            Em Andamento
          </Badge>
        )
      case "overdue":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Atrasada
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="mr-1 h-3 w-3" />
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
              <h1 className="text-2xl font-bold tracking-tight">Parcelamentos</h1>
              {isFiltering && periodLabel && (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <CalendarIcon className="size-3" />
                  {periodLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Gerencie parcelamentos de impostos e obrigações</p>
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
                filenamePrefix="parcelamentos"
                pdfTitle="Relatório de Parcelamentos"
                sheetName="Parcelamentos"
                columns={installmentExportColumns}
                rows={filteredInstallments}
              />
              <Button
                onClick={() => {
                  setSelectedInstallment(undefined)
                  setIsFormOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Parcelamento
              </Button>
            </div>
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
                <span className="text-sm font-medium">Todas</span>
                <Badge variant="secondary" className="text-xs">{statusCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span className="text-sm font-medium">Pendentes</span>
                </div>
                <Badge variant="secondary" className="text-xs">{statusCounts.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <PlayCircle className="size-3.5" />
                  <span className="text-sm font-medium">Em Andamento</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{statusCounts.in_progress}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-sm font-medium">Concluídas</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">{statusCounts.completed}</Badge>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-sm font-medium">Atrasadas</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{statusCounts.overdue}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome, cliente, imposto, descrição, protocolo, referência, tags…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Filtros estilo pill */}
          <FilterBar
            activeCount={activeFilterCount}
            onClearAll={() => {
              setClientFilter("all")
              setPriorityFilter("all")
            }}
          >
            <FilterPill
              icon={<Building2 className="size-3.5" />}
              label="Cliente"
              value={clientFilter}
              onChange={setClientFilter}
              searchable
              searchPlaceholder="Buscar cliente…"
              options={[
                { value: "all", label: "Todos os clientes" },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <FilterPill
              icon={<PriorityIcon className="size-3.5" />}
              label="Prioridade"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: "all", label: "Todas as prioridades" },
                { value: "urgent", label: "Urgente" },
                { value: "high", label: "Alta" },
                { value: "medium", label: "Média" },
                { value: "low", label: "Baixa" },
              ]}
            />
          </FilterBar>

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

          {/* Mobile: cards (até md) */}
          <div className="md:hidden space-y-2">
            {filteredInstallments.length === 0 ? (
              <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
                Nenhum parcelamento encontrado
              </div>
            ) : (
              filteredInstallments.map((installment) => {
                const status = getStatus(installment)
                const dueDate = calculateDueDate(installment)
                return (
                  <div
                    key={installment.id}
                    className={`rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                      selectedIds.has(installment.id)
                        ? "bg-primary/5 border-primary/40"
                        : status === "overdue"
                          ? "bg-destructive/5 border-destructive/30"
                          : "bg-card"
                    }`}
                    onClick={() => handleView(installment)}
                  >
                    <div className="flex items-start gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(installment.id)}
                          onCheckedChange={() => toggleSelect(installment.id)}
                          className="mt-0.5"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{installment.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getClientName(installment.clientId)}
                        </p>
                      </div>
                      {getStatusBadge(installment)}
                    </div>

                    <div className="ml-6 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Parcela:</span>{" "}
                        <span className="font-medium">{installment.currentInstallment}/{installment.installmentCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vence:</span>{" "}
                        <span className="font-mono font-medium">{formatDate(dueDate)}</span>
                      </div>
                    </div>

                    <div className="ml-6 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => handleStartInstallment(installment)} className="h-7 text-xs gap-1">
                          <Play className="h-3 w-3" /> Iniciar
                        </Button>
                      )}
                      {(status === "pending" || status === "in_progress") && (
                        <Button size="sm" variant="outline" onClick={() => handleCompleteInstallment(installment)} className="h-7 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Concluir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(installment)} className="h-7 text-xs gap-1">
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(installment.id)} className="h-7 text-xs gap-1 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop: tabela (md+) */}
          <div className="rounded-lg border bg-card hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      filteredInstallments.length > 0 &&
                      filteredInstallments.every((i) => selectedIds.has(i.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds(new Set(filteredInstallments.map((i) => i.id)))
                      else clearSelection()
                    }}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <ResizableTableHead defaultWidth={240} storageKey="parc-name">Parcelamento</ResizableTableHead>
                <ResizableTableHead defaultWidth={240} storageKey="parc-client">Cliente</ResizableTableHead>
                <ResizableTableHead defaultWidth={140} storageKey="parc-tax">Imposto</ResizableTableHead>
                <ResizableTableHead defaultWidth={100} storageKey="parc-num">Parcela</ResizableTableHead>
                <ResizableTableHead defaultWidth={180} storageKey="parc-due">Vencimento</ResizableTableHead>
                <ResizableTableHead defaultWidth={140} storageKey="parc-status">Status</ResizableTableHead>
                <ResizableTableHead defaultWidth={180} storageKey="parc-actions">Ações Rápidas</ResizableTableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstallments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-2">
                      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-1">
                        <CreditCard className="size-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">Nenhum parcelamento encontrado</p>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Cadastre parcelamentos de impostos (REFIS, parcelamentos especiais, etc).
                      </p>
                      <Button
                        onClick={() => {
                          setSelectedInstallment(undefined)
                          setIsFormOpen(true)
                        }}
                        className="mt-2 gap-2"
                      >
                        Novo Parcelamento
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInstallments.map((installment) => {
                  const status = getStatus(installment)
                  const dueDate = calculateDueDate(installment)
                  return (
                    <TableRow
                      key={installment.id}
                      data-state={selectedIds.has(installment.id) ? "selected" : undefined}
                      className={`cursor-pointer ${
                        selectedIds.has(installment.id)
                          ? "bg-primary/5"
                          : status === "overdue"
                            ? "bg-destructive/5"
                            : ""
                      }`}
                      onClick={() => handleView(installment)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(installment.id)}
                          onCheckedChange={() => toggleSelect(installment.id)}
                          aria-label={`Selecionar ${installment.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium hover:underline">{installment.name}</div>
                          {installment.priority && installment.priority !== "medium" && (
                            <Badge
                              variant="outline"
                              className={
                                installment.priority === "urgent"
                                  ? "border-red-500 text-red-700 dark:text-red-400"
                                  : installment.priority === "high"
                                    ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                    : "border-blue-500 text-blue-700 dark:text-blue-400"
                              }
                            >
                              {installment.priority === "urgent"
                                ? "Urgente"
                                : installment.priority === "high"
                                  ? "Alta"
                                  : "Baixa"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getClientName(installment.clientId)}</TableCell>
                      <TableCell>{getTaxName(installment.taxId)}</TableCell>
                      <TableCell>
                        {installment.currentInstallment}/{installment.installmentCount}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">{formatDate(dueDate)}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(installment)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {status !== "completed" && (
                          <div className="flex gap-1">
                            {status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartInstallment(installment)}
                                className="h-7 text-xs"
                              >
                                <PlayCircle className="size-3 mr-1" />
                                Iniciar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCompleteInstallment(installment)}
                              className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="size-3 mr-1" />
                              Concluir
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(installment)}>
                              <Eye className="size-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(installment)}>
                              <Pencil className="size-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(installment.id)}
                              className="text-destructive"
                            >
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

      <InstallmentForm
        installment={selectedInstallment}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={loadData}
      />

      {viewingInstallment && (
        <InstallmentDetails
          installment={viewingInstallment}
          clients={clients}
          taxes={taxes}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onEdit={handleEdit}
        />
      )}

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        clients={clients}
        taxes={taxes}
        obligations={obligationsForSearch}
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.size} parcelamentos em lote</DialogTitle>
            <DialogDescription>
              Preencha apenas os campos que deseja alterar. Os demais ficam como estão.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datas de vencimento</p>
              <div className="grid gap-2">
                <Label htmlFor="bulk-inst-first-due">Primeiro vencimento (data completa)</Label>
                <Input
                  id="bulk-inst-first-due"
                  type="date"
                  value={bulkFirstDueDate}
                  onChange={(e) => setBulkFirstDueDate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Define a data da primeira parcela. As demais são calculadas mensalmente a partir dela.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-inst-due-day">Dia do vencimento (1-31)</Label>
                <Input
                  id="bulk-inst-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 15 (deixe em branco para manter)"
                  value={bulkDueDay}
                  onChange={(e) => setBulkDueDay(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Aplicado em cada parcela mensal. Dia 31 em meses sem 31 vai pro último dia automaticamente.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Se cair em fim de semana / feriado</Label>
              <Select
                value={bulkWeekendRule || "__keep__"}
                onValueChange={(v) => setBulkWeekendRule(v === "__keep__" ? "" : (v as typeof bulkWeekendRule))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">(não alterar)</SelectItem>
                  <SelectItem value="postpone">Postergar p/ próximo útil</SelectItem>
                  <SelectItem value="anticipate">Antecipar p/ útil anterior</SelectItem>
                  <SelectItem value="keep">Manter na data</SelectItem>
                </SelectContent>
              </Select>
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
