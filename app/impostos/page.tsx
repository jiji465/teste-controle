"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { useUrlState } from "@/hooks/use-url-state"
import { TaxForm } from "@/features/taxes/components/tax-form"
import { GlobalSearch } from "@/components/global-search"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { saveTax, deleteTax } from "@/lib/supabase/database"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
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
} from "lucide-react"
import type { Tax, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { useData } from "@/contexts/data-context"

export default function ImpostosPage() {
  const { taxes, clients, obligations: rawObligations, refreshData } = useData()
  const [editingTax, setEditingTax] = useState<Tax | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useUrlState("tab")
  const [regimeFilter, setRegimeFilter] = useUrlState("regime")
  const [scopeFilter, setScopeFilter] = useUrlState("scope")
  const [priorityFilter, setPriorityFilter] = useUrlState("priority")
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkDueDay, setBulkDueDay] = useState("")
  const [bulkPriority, setBulkPriority] = useState<"" | "low" | "medium" | "high" | "urgent">("")
  const [bulkAssignedTo, setBulkAssignedTo] = useState("")
  const [taxSearch, setTaxSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (regimeFilter !== "all" ? 1 : 0) +
    (scopeFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0)

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
          matchesText(t.federalTaxCode, q) ||
          matchesText(t.assignedTo, q) ||
          matchesText(t.protocol, q) ||
          matchesText(t.notes, q) ||
          (t.tags ?? []).some((tag) => matchesText(tag, q)) ||
          (t.scope ? matchesText(t.scope, q) : false)
        if (!textHit) return false
      }
      const matchesRegime =
        regimeFilter === "all" ||
        !t.applicableRegimes ||
        t.applicableRegimes.length === 0 ||
        t.applicableRegimes.includes(regimeFilter as TaxRegime)
      const matchesScope = scopeFilter === "all" || t.scope === scopeFilter
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter
      return matchesRegime && matchesScope && matchesPriority
    })
  }, [taxes, taxSearch, regimeFilter, scopeFilter, priorityFilter])

  const pendingTaxes = searchedTaxes.filter((t) => t.status === "pending")
  const inProgressTaxes = searchedTaxes.filter((t) => t.status === "in_progress")
  const completedTaxes = searchedTaxes.filter((t) => t.status === "completed")
  const overdueTaxes = searchedTaxes.filter((t) => t.status === "overdue")

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
        return searchedTaxes
    }
  }

  const getStatusBadge = (status: Tax["status"], completedAt?: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="size-3 mr-1" />
            Concluída {completedAt && `em ${new Date(completedAt).toLocaleDateString("pt-BR")}`}
          </Badge>
        )
      case "in_progress":
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
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
            <Clock className="size-3 mr-1" />
            Pendente
          </Badge>
        )
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
              <h1 className="text-4xl font-bold tracking-tight text-balance">Impostos</h1>
              <p className="text-lg text-muted-foreground">Gerencie todos os impostos e seus vencimentos</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="size-4" />
                Buscar
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <Button onClick={handleNew}>
                <Plus className="size-4 mr-2" />
                Novo Imposto
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
                    placeholder="Nome, descrição, código DARF, esfera, responsável, protocolo, tags…"
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

              {showFilters && (
                <div className="grid sm:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Regime tributário</label>
                    <Select value={regimeFilter} onValueChange={setRegimeFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os regimes</SelectItem>
                        {(Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Esfera</label>
                    <Select value={scopeFilter} onValueChange={setScopeFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="federal">Federal</SelectItem>
                        <SelectItem value="estadual">Estadual</SelectItem>
                        <SelectItem value="municipal">Municipal</SelectItem>
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
                  { label: "Editar", icon: <Pencil className="size-3.5" />, onClick: openBulkEdit, disabled: bulkLoading },
                  { label: "Excluir", icon: <Trash2 className="size-3.5" />, tone: "destructive", onClick: handleBulkDelete, disabled: bulkLoading },
                ]}
              />
              <Card className="p-6">
                <div className="border rounded-lg">
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
                        <TableHead>Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Regimes</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações Rápidas</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredTaxes().length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum imposto encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        getFilteredTaxes().map((tax) => (
                          <TableRow
                            key={tax.id}
                            data-state={selectedIds.has(tax.id) ? "selected" : undefined}
                            className={selectedIds.has(tax.id) ? "bg-primary/5" : ""}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(tax.id)}
                                onCheckedChange={() => toggleSelect(tax.id)}
                                aria-label={`Selecionar ${tax.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{tax.name}</div>
                              {tax.scope && (
                                <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1.5">
                                  {tax.scope === "federal" ? "Federal" : tax.scope === "estadual" ? "Estadual" : "Municipal"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{tax.description || "—"}</TableCell>
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
                            <TableCell>{tax.dueDay ? `Dia ${tax.dueDay}` : "—"}</TableCell>
                            <TableCell>{getStatusBadge(tax.status, tax.completedAt)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {tax.status === "pending" && (
                                  <Button size="sm" variant="outline" onClick={() => handleStartTax(tax)}>
                                    <PlayCircle className="size-3 mr-1" />
                                    Iniciar
                                  </Button>
                                )}
                                {tax.status === "in_progress" && (
                                  <Button size="sm" variant="outline" onClick={() => handleCompleteTax(tax)}>
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Concluir
                                  </Button>
                                )}
                              </div>
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <TaxForm tax={editingTax} open={isFormOpen} onOpenChange={setIsFormOpen} onSave={handleSave} />
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
