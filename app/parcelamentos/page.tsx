"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Navigation } from "@/components/navigation"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { useUrlState } from "@/hooks/use-url-state"
import { InstallmentForm } from "@/features/installments/components/installment-form"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { GlobalSearch } from "@/components/global-search"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { saveInstallment, deleteInstallment } from "@/lib/supabase/database"
import { matchesText } from "@/lib/utils"
import type { Installment } from "@/lib/types"
import { Plus, Search, Pencil, Trash2, Play, CheckCircle2, AlertCircle, Flame, TrendingUp, Zap, Clock, PlayCircle, AlertTriangle, Filter, RotateCcw } from "lucide-react"
import { formatDate, adjustForWeekend } from "@/lib/date-utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"
import { toast } from "sonner"

export default function ParcelamentosPage() {
  const { installments, clients, taxes, obligations: rawObligations, isLoading: loading, refreshData } = useData()
  const [statusFilter, setStatusFilter] = useUrlState("tab")
  const [clientFilter, setClientFilter] = useUrlState("client")
  const [priorityFilter, setPriorityFilter] = useUrlState("priority")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkFirstDueDate, setBulkFirstDueDate] = useState("")
  const [bulkDueDay, setBulkDueDay] = useState("")
  const [bulkPriority, setBulkPriority] = useState<"" | "low" | "medium" | "high" | "urgent">("")
  const [bulkWeekendRule, setBulkWeekendRule] = useState<"" | "postpone" | "anticipate" | "keep">("")
  const [bulkAssignedTo, setBulkAssignedTo] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (clientFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0)

  const obligationsForSearch = useMemo(
    () => getObligationsWithDetails(rawObligations, clients, taxes),
    [rawObligations, clients, taxes],
  )

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
    const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, installment.dueDay)
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
          matchesText(installment.referenceNumber, q) ||
          matchesText(installment.assignedTo, q) ||
          matchesText(installment.paymentMethod, q) ||
          matchesText(installment.notes, q) ||
          (installment.tags ?? []).some((t) => matchesText(t, q))
        if (!textHit) return false
      }

      const status = getStatus(installment)
      if (statusFilter !== "all" && status !== statusFilter) return false
      if (clientFilter !== "all" && installment.clientId !== clientFilter) return false
      if (priorityFilter !== "all" && installment.priority !== priorityFilter) return false
      return true
    })
  }, [installments, searchTerm, statusFilter, clientFilter, priorityFilter, clients, taxes])

  const statusCounts = useMemo(() => {
    const counts = {
      all: installments.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    }

    installments.forEach((installment) => {
      const status = getStatus(installment)
      counts[status]++
    })

    return counts
  }, [installments])

  const handleEdit = (installment: Installment) => {
    setSelectedInstallment(installment)
    setIsFormOpen(true)
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
    if (bulkFirstDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(bulkFirstDueDate)) {
      toast.error("Data inválida")
      return
    }
    if (!dueDayNum && !bulkFirstDueDate && !bulkPriority && !bulkWeekendRule && !bulkAssignedTo) {
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
          if (bulkAssignedTo) updated.assignedTo = bulkAssignedTo
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Zap className="h-4 w-4 text-destructive" />
      case "high":
        return <Flame className="h-4 w-4 text-warning" />
      case "medium":
        return <AlertCircle className="h-4 w-4 text-info" />
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-balance">Parcelamentos</h1>
              <p className="text-lg text-muted-foreground">Gerencie parcelamentos de impostos e obrigações</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="size-4" />
                Buscar
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
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
                placeholder="Nome, cliente, imposto, descrição, protocolo, referência, responsável, tags…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

          {showFilters && (
            <div className="grid sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Cliente</label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Prioridade</label>
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
              </div>
            </div>
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

          <div className="rounded-lg border bg-card">
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
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Imposto</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstallments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Nenhum parcelamento encontrado
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
                      className={
                        selectedIds.has(installment.id)
                          ? "bg-primary/5"
                          : status === "overdue"
                            ? "bg-destructive/5"
                            : ""
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(installment.id)}
                          onCheckedChange={() => toggleSelect(installment.id)}
                          aria-label={`Selecionar ${installment.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{installment.name}</TableCell>
                      <TableCell>{getClientName(installment.clientId)}</TableCell>
                      <TableCell>{getTaxName(installment.taxId)}</TableCell>
                      <TableCell>
                        {installment.currentInstallment}/{installment.installmentCount}
                      </TableCell>
                      <TableCell>
                        {installment.installmentAmount != null
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(installment.installmentAmount)
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDate(dueDate)}</TableCell>
                      <TableCell>{getPriorityIcon(installment.priority)}</TableCell>
                      <TableCell>{getStatusBadge(installment)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => handleStartInstallment(installment)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {(status === "pending" || status === "in_progress") && (
                            <Button size="sm" variant="outline" onClick={() => handleCompleteInstallment(installment)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleEdit(installment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(installment.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </main>

      <InstallmentForm
        installment={selectedInstallment}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={loadData}
      />

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
            <div className="grid gap-2">
              <Label htmlFor="bulk-inst-assigned">Responsável</Label>
              <Input
                id="bulk-inst-assigned"
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
