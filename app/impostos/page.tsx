"use client"

import { usePagination } from "@/hooks/use-pagination"
import { useListSelection } from "@/hooks/use-list-selection"
import { runBulk } from "@/lib/bulk-actions"
import { notifyBulk } from "@/lib/notify-bulk"
import { countByStatus, filterByStatusTab } from "@/lib/obligation-status"
import { ListPagination } from "@/components/list-pagination"
import { useEffect, useMemo, useState } from "react"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { useUrlState } from "@/hooks/use-url-state"
import { TaxForm } from "@/features/taxes/components/tax-form"
import { TaxDetails } from "@/features/taxes/components/tax-details"
import { GlobalSearch } from "@/components/global-search"
import { StatFilterBar } from "@/components/stat-filter-bar"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
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
import { buildRecurringTaxes } from "@/lib/recurrence-generate"
import { saveNewOccurrences, describeOccurrencePlan } from "@/lib/recurrence-sync"
import { calculateDueDateFromCompetency, formatDate, isOverdue } from "@/lib/date-utils"
import { checkAndGenerateRecurrences } from "@/lib/auto-recurrence"
import { matchesText , errorMessage} from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
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
  Eye,
  Receipt,
  Lock,
} from "lucide-react"
import { FilterBar, FilterPill, FilterPillMonth } from "@/components/filter-panel"
import type { Tax, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { statusLabel, priorityLabel } from "@/lib/labels"

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
  const { userName } = useAuth()
  const { taxes, clients, obligationsWithDetails, refreshData, isPeriodLocked } = useData()
  const { isInPeriodOrOverdue, period, periodLabel, isFiltering } = useSelectedPeriod()
  const isLocked = (t: Tax) => isPeriodLocked(t.competencyMonth)
  const LOCKED_HINT = "Competência fechada — reabra a competência para alterar"
  const [editingTax, setEditingTax] = useState<Tax | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewingTax, setViewingTax] = useState<Tax | undefined>()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [activeTab, setActiveTab] = useUrlState("tab")
  const [regimeFilter, setRegimeFilter] = useUrlState("regime")
  const [scopeFilter, setScopeFilter] = useUrlState("scope")
  const [priorityFilter, setPriorityFilter] = useUrlState("priority")
  const [clientFilter, setClientFilter] = useUrlState("clientId")
  const [competencyFilter, setCompetencyFilter] = useUrlState("competency", "")
  const [searchOpen, setSearchOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkDueDay, setBulkDueDay] = useState("")
  const [bulkPriority, setBulkPriority] = useState<"" | "low" | "medium" | "high" | "urgent">("")
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

  const obligations = obligationsWithDetails

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
      // Ids que já existiam ANTES de salvar: competências da série que já
      // existem (pagas, com protocolo…) nunca são sobrescritas.
      const existingIds = new Set(taxes.map((t) => t.id))
      await saveTax(tax)

      // Geração antecipada: com "Gerar Automaticamente" ligado + "Gerar até",
      // cria as competências que ainda faltam até a data final (ids
      // determinísticos → o motor diário não duplica). Competência fechada é
      // pulada em vez de interromper a série no meio.
      const series = tax.autoGenerate
        ? await saveNewOccurrences(
            buildRecurringTaxes(tax),
            { existingIds, periodOf: (t) => t.competencyMonth, isPeriodLocked },
            saveTax,
          )
        : null

      const extra = series ? describeOccurrencePlan(series, { one: "competência", many: "competências" }) : ""
      if (series && series.failed.length > 0) {
        toast.warning(
          `Guia salva, mas ${series.failed.length} competência(s) falharam: ${errorMessage(series.failed[0].error, "erro")}`,
        )
      } else {
        toast.success(extra ? `Guia salva · ${extra}` : "Guia salva com sucesso")
      }
      await updateData()
      setEditingTax(undefined)
      setIsFormOpen(false)
    } catch (error) {
      console.error("[impostos] Erro ao salvar guia:", error)
      toast.error(errorMessage(error, "Erro ao salvar a guia. Tente novamente."))
      // Mantém o formulário aberto (o form só fecha se onSave resolver)
      throw error
    }
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir guia",
      description: "Tem certeza que deseja excluir esta guia? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteTax(id)
          toast.success("Guia excluída")
          await updateData()
        } catch (error) {
          console.error("[impostos] Erro ao excluir imposto:", error)
          toast.error(errorMessage(error, "Erro ao excluir imposto. Tente novamente."))
        }
      },
    })
  }

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax)
    setIsFormOpen(true)
  }

  const handleView = (tax: Tax) => {
    setViewingTax(tax)
    setIsDetailsOpen(true)
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
      console.error("[impostos] Error starting tax:", error)
      toast.error(errorMessage(error, "Erro ao iniciar a guia. Tente novamente."))
    }
  }

  const handleCompleteTax = async (tax: Tax) => {
    try {
      const updatedTax = {
        ...tax,
        status: "completed" as const,
        completedAt: new Date().toISOString(),
        completedBy: userName,
      }
      await saveTax(updatedTax)
      // Gera próxima instância da recorrência imediatamente (em vez de
      // esperar 24h). Falha silenciosa: tax já está salva.
      checkAndGenerateRecurrences(true).catch((e) =>
        console.warn("[impostos] auto-regen pós-conclusão falhou:", e),
      )
      await updateData()
    } catch (error) {
      console.error("[impostos] Error completing tax:", error)
      toast.error(errorMessage(error, "Erro ao concluir a guia. Tente novamente."))
    }
  }


  /** Ação em lote: ignora competência fechada (com aviso), relata falhas e
   *  SEMPRE recarrega a lista. */
  const runTaxBulk = async (
    targets: Tax[],
    action: (t: Tax) => Promise<unknown>,
    done: { one: string; many: string },
  ) => {
    setBulkLoading(true)
    try {
      const { toast: t, result } = await runBulk(targets, action, { done, isLocked })
      notifyBulk(t)
      return result
    } finally {
      clearSelection()
      await updateData()
      setBulkLoading(false)
    }
  }

  const handleBulkComplete = () => {
    if (selectedTaxes.length === 0) return
    setConfirmState({
      title: `Concluir ${selectedTaxes.length} guias`,
      description: `Marcar ${selectedTaxes.length} guias como concluídas? Itens de competência fechada são ignorados.`,
      confirmLabel: "Concluir",
      onConfirm: async () => {
        const now = new Date().toISOString()
        const result = await runTaxBulk(
          selectedTaxes.filter((t) => t.status !== "completed"),
          (t) => saveTax({ ...t, status: "completed", completedAt: now, completedBy: userName }),
          { one: "guia concluída", many: "guias concluídas" },
        )
        if (result.succeeded.length > 0) {
          checkAndGenerateRecurrences(true).catch((e) =>
            console.warn("[impostos] auto-regen pós-bulk falhou:", e),
          )
        }
      },
    })
  }

  const handleBulkInProgress = () => {
    if (selectedTaxes.length === 0) return
    setConfirmState({
      title: `Iniciar ${selectedTaxes.length} guias`,
      description: `Marcar ${selectedTaxes.length} guias como "Em andamento"?`,
      confirmLabel: "Iniciar",
      onConfirm: async () => {
        await runTaxBulk(
          selectedTaxes.filter((t) => t.status !== "in_progress"),
          (t) => saveTax({ ...t, status: "in_progress", completedAt: undefined, completedBy: undefined }),
          { one: "guia em andamento", many: "guias em andamento" },
        )
      },
    })
  }

  const handleBulkReopen = () => {
    if (selectedTaxes.length === 0) return
    setConfirmState({
      title: `Reabrir ${selectedTaxes.length} guias`,
      description: `Volta para "Pendente" e limpa a data de entrega.`,
      confirmLabel: "Reabrir",
      onConfirm: async () => {
        await runTaxBulk(
          selectedTaxes.filter((t) => t.status === "completed"),
          (t) => saveTax({ ...t, status: "pending", completedAt: undefined, completedBy: undefined }),
          { one: "guia reaberta", many: "guias reabertas" },
        )
      },
    })
  }

  const handleBulkDelete = () => {
    if (selectedTaxes.length === 0) return
    setConfirmState({
      title: `Excluir ${selectedTaxes.length} guias`,
      description: "Esta ação não pode ser desfeita. Itens de competência fechada são ignorados.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        await runTaxBulk(selectedTaxes, (t) => deleteTax(t.id), { one: "guia excluída", many: "guias excluídas" })
      },
    })
  }

  const openBulkEdit = () => {
    setBulkDueDay("")
    setBulkPriority("")
    setBulkEditOpen(true)
  }

  const handleBulkEditApply = async () => {
    if (selectedTaxes.length === 0) return
    const dueDayNum = bulkDueDay ? Number(bulkDueDay) : null
    if (dueDayNum !== null && (Number.isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      toast.error("Dia do vencimento deve estar entre 1 e 31")
      return
    }
    if (!dueDayNum && !bulkPriority) {
      toast.info("Preencha pelo menos um campo para aplicar")
      return
    }
    await runTaxBulk(
      selectedTaxes,
      (t) => {
        const updated = { ...t }
        if (dueDayNum) updated.dueDay = dueDayNum
        if (bulkPriority) updated.priority = bulkPriority
        return saveTax(updated)
      },
      { one: "guia atualizada", many: "guias atualizadas" },
    )
    setBulkEditOpen(false)
  }

  const searchedTaxes = useMemo(() => {
    const q = taxSearch.trim()
    return taxes.filter((t) => {
      if (q) {
        const textHit =
          matchesText(t.name, q) ||
          matchesText(t.description, q) ||
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
      // No mês atual, guias atrasadas de meses anteriores continuam aparecendo.
      const calcDate = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      const matchesGlobalPeriod = isInPeriodOrOverdue(calcDate, t.status)
      return matchesRegime && matchesScope && matchesPriority && matchesClient && matchesCompetency && matchesGlobalPeriod
    })
  }, [taxes, taxSearch, regimeFilter, scopeFilter, priorityFilter, clientFilter, competencyFilter, isInPeriodOrOverdue])

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
        const ad = calculateDueDateFromCompetency(a.competencyMonth, a.dueDay, a.weekendRule, a.dueMonth)
        const bd = calculateDueDateFromCompetency(b.competencyMonth, b.dueDay, b.weekendRule, b.dueMonth)
        const at = ad ? ad.getTime() : Number.MAX_SAFE_INTEGER
        const bt = bd ? bd.getTime() : Number.MAX_SAFE_INTEGER
        cmp = at - bt
      }
      return sortOrder === "asc" ? cmp : -cmp
    })
    return arr
  }, [searchedTaxes, sortBy, sortOrder, clients])

  // Status efetivo (mesma regra do dashboard/obrigações): pendente OU em
  // andamento com vencimento passado = atrasada; cada guia cai em UM cartão.
  const withDue = (t: Tax) => ({
    ...t,
    calculatedDueDate: calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth) ?? undefined,
  })
  const statusCounts = countByStatus(sortedTaxes.map(withDue))

  const taxExportColumns: ExportColumn<Tax>[] = [
    { header: "Nome", width: 24, accessor: (t) => t.name },
    { header: "Cliente", width: 22, accessor: (t) => clients.find((c) => c.id === t.clientId)?.name ?? "" },
    { header: "Esfera", width: 12, accessor: (t) => t.scope ?? "" },
    { header: "Competência", width: 12, accessor: (t) => t.competencyMonth ?? "" },
    { header: "Dia venc.", width: 10, accessor: (t) => t.dueDay ?? "" },
    { header: "Regimes", width: 28, accessor: (t) => (t.applicableRegimes ?? []).map((r) => TAX_REGIME_LABELS[r as TaxRegime]).join(", ") },
    { header: "Status", width: 12, accessor: (t) => statusLabel(t.status) },
    { header: "Prioridade", width: 10, accessor: (t) => priorityLabel(t.priority) },
    { header: "Concluído em", width: 14, accessor: (t) => (t.completedAt ? new Date(t.completedAt) : "") },
  ]

  const tabTaxes = useMemo(() => {
    const ids = new Set(filterByStatusTab(sortedTaxes.map(withDue), activeTab).map((t) => t.id))
    return sortedTaxes.filter((t) => ids.has(t.id))
  }, [sortedTaxes, activeTab])
  const getFilteredTaxes = () => tabTaxes

  const getStatusBadge = (status: Tax["status"], completedAt?: string, calculatedDueDate?: Date | null) => {
    // Marca como atrasada dinamicamente se a data calculada já passou
    const isCalculatedOverdue =
      status !== "completed" &&
      calculatedDueDate &&
      isOverdue(calculatedDueDate)

    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-success/10 text-success border-success/25">
            <CheckCircle2 className="size-3 mr-1" />
            Entregue {completedAt && `em ${new Date(completedAt).toLocaleDateString("pt-BR")}`}
          </Badge>
        )
      case "in_progress":
        if (isCalculatedOverdue) {
          return (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/25">
              <AlertTriangle className="size-3 mr-1" />
              Atrasada
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="bg-info/10 text-info border-info/25">
            <PlayCircle className="size-3 mr-1" />
            Em Andamento
          </Badge>
        )
      case "overdue":
        return (
          <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/25">
            <AlertTriangle className="size-3 mr-1" />
            Atrasada
          </Badge>
        )
      default:
        if (isCalculatedOverdue) {
          return (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/25">
              <AlertTriangle className="size-3 mr-1" />
              Atrasada
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400">
            <Clock className="size-3 mr-1" />
            Pendente
          </Badge>
        )
    }
  }

  // Paginação: renderiza 50 linhas por vez (listas com centenas de itens travavam)
  const pagination = usePagination(tabTaxes)
  const visibleIds = pagination.items.map((t) => t.id)
  // Seleção some ao trocar aba/filtro/busca/período/página
  const selection = useListSelection(
    [activeTab, regimeFilter, scopeFilter, priorityFilter, clientFilter, competencyFilter, taxSearch, period, pagination.page].join("|"),
  )
  const { selectedIds, toggle: toggleSelect, clear: clearSelection } = selection
  const selectedTaxes = pagination.items.filter((t) => selectedIds.has(t.id))

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            icon={Receipt}
            title="Guias de Imposto"
            description="Guias de pagamento (DARF, GPS, GARE, DAS, GNRE…) por cliente"
            badge={
              isFiltering && periodLabel ? (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <CalendarIcon className="size-3" />
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

          {/* Cartões de status = resumo + filtro (estilo Dashboard). */}
          <StatFilterBar
            value={activeTab || "all"}
            onChange={setActiveTab}
            items={[
              { value: "all", label: "Todas", count: statusCounts.all, icon: Receipt, tone: "neutral" },
              { value: "pending", label: "Pendentes", count: statusCounts.pending, icon: Clock, tone: "warning" },
              { value: "in_progress", label: "Em Andamento", count: statusCounts.in_progress, icon: PlayCircle, tone: "info" },
              { value: "completed", label: "Concluídas", count: statusCounts.completed, icon: CheckCircle2, tone: "success" },
              { value: "overdue", label: "Atrasadas", count: statusCounts.overdue, icon: AlertTriangle, tone: "danger" },
            ]}
          />

          {/* Conteúdo fora de <TabsContent value={dinâmico}> — esse padrão
              travava o clique dos triggers em alguns navegadores. */}
          <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, descrição, esfera, protocolo, competência, tags…"
                    value={taxSearch}
                    onChange={(e) => setTaxSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filtros estilo pill */}
              <FilterBar
                activeCount={activeFilterCount}
                onClearAll={() => {
                  setClientFilter("all")
                  setCompetencyFilter("")
                  setRegimeFilter("all")
                  setScopeFilter("all")
                  setPriorityFilter("all")
                }}
              >
                <FilterPill
                  icon={<Building2 className="size-3.5" />}
                  label="Cliente"
                  value={clientFilter || "all"}
                  onChange={setClientFilter}
                  searchable
                  searchPlaceholder="Buscar cliente…"
                  options={[
                    { value: "all", label: "Todos os clientes" },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <FilterPill
                  icon={<Scale className="size-3.5" />}
                  label="Regime"
                  value={regimeFilter}
                  onChange={setRegimeFilter}
                  options={[
                    { value: "all", label: "Todos os regimes" },
                    ...(Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][]).map(([v, l]) => ({ value: v, label: l })),
                  ]}
                />
                <FilterPill
                  icon={<Layers className="size-3.5" />}
                  label="Esfera"
                  value={scopeFilter}
                  onChange={setScopeFilter}
                  options={[
                    { value: "all", label: "Todas as esferas" },
                    { value: "federal", label: "Federal" },
                    { value: "estadual", label: "Estadual" },
                    { value: "municipal", label: "Municipal" },
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
                <FilterPillMonth
                  icon={<CalendarDays className="size-3.5" />}
                  label="Competência"
                  value={competencyFilter || ""}
                  onChange={setCompetencyFilter}
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
                    pagination.items.map((tax) => {
                      const calcDate = calculateDueDateFromCompetency(
                        tax.competencyMonth,
                        tax.dueDay,
                        tax.weekendRule,
                        tax.dueMonth,
                      )
                      return (
                      <div
                        key={tax.id}
                        className={`border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                          selectedIds.has(tax.id) ? "bg-primary/5 border-primary/40" : "bg-card"
                        }`}
                        onClick={() => handleView(tax)}
                      >
                        <div className="flex items-start gap-2">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(tax.id)}
                              onCheckedChange={() => toggleSelect(tax.id)}
                              className="mt-0.5"
                            />
                          </div>
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

                        <div className="ml-6 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isLocked(tax) && (
                            <span title={LOCKED_HINT} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="size-3" /> Competência fechada
                            </span>
                          )}
                          {tax.status !== "completed" && !isLocked(tax) && (
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
                                className="h-7 text-xs gap-1 bg-success text-success-foreground hover:bg-success/90"
                              >
                                <CheckCircle2 className="size-3" /> Concluir
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(tax)} disabled={isLocked(tax)} title={isLocked(tax) ? LOCKED_HINT : undefined} className="h-7 text-xs gap-1">
                            <Pencil className="size-3" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(tax.id)} disabled={isLocked(tax)} title={isLocked(tax) ? LOCKED_HINT : undefined} className="h-7 text-xs gap-1 text-destructive">
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
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selection.isAllVisibleSelected(visibleIds)}
                            onCheckedChange={(checked) => selection.setAllVisible(visibleIds, !!checked)}
                            aria-label={`Selecionar as ${visibleIds.length} guias desta página`}
                            title={`Selecionar as ${visibleIds.length} guias desta página`}
                          />
                        </TableHead>
                        <ResizableTableHead defaultWidth={220} storageKey="impostos-name">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("name")} className="-ml-3">
                            Imposto <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={200} storageKey="impostos-client">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("client")} className="-ml-3">
                            Cliente <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={150} storageKey="impostos-regimes" className="max-xl:hidden">Regimes</ResizableTableHead>
                        <ResizableTableHead defaultWidth={170} storageKey="impostos-due">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("dueDate")} className="-ml-3">
                            Vencimento <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={130} storageKey="impostos-status">
                          <Button variant="ghost" size="sm" onClick={() => toggleSort("status")} className="-ml-3">
                            Status <ArrowUpDown className="ml-2 size-3" />
                          </Button>
                        </ResizableTableHead>
                        <ResizableTableHead defaultWidth={200} storageKey="impostos-actions" className="max-xl:hidden">Ações Rápidas</ResizableTableHead>
                        <TableHead className="w-[50px] sticky right-0 z-20 bg-background shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]"></TableHead>
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
                        pagination.items.map((tax) => {
                          const calculatedDueDate = calculateDueDateFromCompetency(
                            tax.competencyMonth,
                            tax.dueDay,
                            tax.weekendRule,
                            tax.dueMonth,
                          )
                          const isTaxOverdue =
                            calculatedDueDate &&
                            tax.status !== "completed" &&
                            isOverdue(calculatedDueDate)
                          return (
                          <TableRow
                            key={tax.id}
                            data-state={selectedIds.has(tax.id) ? "selected" : undefined}
                            className={`group cursor-pointer ${
                              selectedIds.has(tax.id)
                                ? "bg-primary/5"
                                : isTaxOverdue
                                  ? "bg-destructive/5"
                                  : ""
                            }`}
                            onClick={() => handleView(tax)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(tax.id)}
                                onCheckedChange={() => toggleSelect(tax.id)}
                                aria-label={`Selecionar ${tax.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="font-medium truncate hover:underline">{tax.name}</div>
                                  {isLocked(tax) && (
                                    <span title={LOCKED_HINT} aria-label={LOCKED_HINT} className="inline-flex text-muted-foreground">
                                      <Lock className="size-3.5" />
                                    </span>
                                  )}
                                  {tax.priority && tax.priority !== "medium" && (
                                    <Badge
                                      variant="outline"
                                      className={
                                        tax.priority === "urgent"
                                          ? "border-destructive text-destructive"
                                          : tax.priority === "high"
                                            ? "border-warning text-warning"
                                            : "border-info text-info"
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
                              </div>
                            </TableCell>
                            <TableCell className="text-sm truncate">
                              {clients.find((c) => c.id === tax.clientId)?.name || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="max-xl:hidden">
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
                            <TableCell onClick={(e) => e.stopPropagation()} className="max-xl:hidden">
                              {isLocked(tax) && tax.status !== "completed" && (
                                <span title={LOCKED_HINT} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Lock className="size-3" /> Fechada
                                </span>
                              )}
                              {tax.status !== "completed" && !isLocked(tax) && (
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
                                    className="h-7 text-xs bg-success text-success-foreground hover:bg-success/90"
                                  >
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Concluir
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-background group-hover:bg-muted/50 transition-colors shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]"
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Mais ações">
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {tax.status !== "completed" && !isLocked(tax) && (
                                    <>
                                      {tax.status === "pending" && (
                                        <DropdownMenuItem onClick={() => handleStartTax(tax)}>
                                          <PlayCircle className="size-4 mr-2" />
                                          Iniciar
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => handleCompleteTax(tax)}>
                                        <CheckCircle2 className="size-4 mr-2" />
                                        Concluir
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => handleView(tax)}>
                                    <Eye className="size-4 mr-2" />
                                    Ver detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEdit(tax)} disabled={isLocked(tax)} title={isLocked(tax) ? LOCKED_HINT : undefined}>
                                    <Pencil className="size-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(tax.id)} className="text-destructive" disabled={isLocked(tax)} title={isLocked(tax) ? LOCKED_HINT : undefined}>
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
                <ListPagination pagination={pagination} />
              </div>
          </div>
        </div>

      <TaxForm tax={editingTax} clients={clients} open={isFormOpen} onOpenChange={setIsFormOpen} onSave={handleSave} />
      {viewingTax && (
        <TaxDetails
          tax={viewingTax}
          clients={clients}
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
