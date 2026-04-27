"use client"

import { forwardRef, useImperativeHandle, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResizableTableHead } from "@/components/ui/resizable-table-head"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterBar, FilterPill, FilterPillMonth } from "@/components/filter-panel"
import { Building2, AlertCircle as PriorityIcon, CalendarDays, Layers, Scale } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ObligationForm } from "./obligation-form"
import { ObligationDetails } from "./obligation-details"
import {
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  PlayCircle,
  Eye,
  Filter,
  AlertTriangle,
  ArrowUpDown,
  Clock,
  RotateCcw,
  Copy,
  FileText,
} from "lucide-react"
import type { ObligationWithDetails, Client, Tax, Priority, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { saveObligation, deleteObligation } from "@/features/obligations/services"
import { formatDate, isOverdue, calculateDueDateInfoFromCompetency } from "@/lib/date-utils"
import { effectiveStatus } from "@/lib/obligation-status"
import { getRecurrenceDescription } from "@/lib/recurrence-utils"
import { matchesText } from "@/lib/utils"
import { toast } from "sonner"

type ObligationListProps = {
  obligations: ObligationWithDetails[]
  clients: Client[]
  taxes: Tax[]
  onUpdate: () => void
}

export type ObligationListHandle = {
  openNewForm: () => void
}

type BulkEditForm = {
  priority: "" | Priority
  status: "" | "pending" | "in_progress" | "completed"
  dueDay: string
  weekendRule: "" | "postpone" | "anticipate" | "keep"
  competencyMonth: string
  scope: "" | "federal" | "estadual" | "municipal"
}

const EMPTY_BULK_FORM: BulkEditForm = {
  priority: "",
  status: "",
  dueDay: "",
  weekendRule: "",
  competencyMonth: "",
  scope: "",
}

export const ObligationList = forwardRef<ObligationListHandle, ObligationListProps>(function ObligationList(
  { obligations, clients, taxes, onUpdate }: ObligationListProps,
  ref,
) {
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [competencyFilter, setCompetencyFilter] = useState<string>("")
  const [scopeFilter, setScopeFilter] = useState<string>("all")
  const [regimeFilter, setRegimeFilter] = useState<string>("all")
  const [editingObligation, setEditingObligation] = useState<ObligationWithDetails | undefined>()
  const [viewingObligation, setViewingObligation] = useState<ObligationWithDetails | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [sortBy, setSortBy] = useState<"dueDate" | "client" | "status">("dueDate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState<BulkEditForm>(EMPTY_BULK_FORM)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (clientFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (competencyFilter ? 1 : 0) +
    (scopeFilter !== "all" ? 1 : 0) +
    (regimeFilter !== "all" ? 1 : 0)

  const filteredObligations = useMemo(
    () =>
      obligations.filter((obl) => {
        if (search.trim()) {
          const q = search.trim()
          const textHit =
            matchesText(obl.name, q) ||
            matchesText(obl.client.name, q) ||
            matchesText(obl.client.tradeName, q) ||
            matchesText(obl.tax?.name, q) ||
            matchesText(obl.description, q) ||
            matchesText(obl.protocol, q) ||
            matchesText(obl.notes, q) ||
            matchesText(obl.competencyMonth, q) ||
            (obl.tags ?? []).some((t) => matchesText(t, q))
          if (!textHit) return false
        }
        if (clientFilter !== "all" && obl.clientId !== clientFilter) return false
        if (priorityFilter !== "all" && obl.priority !== priorityFilter) return false
        if (competencyFilter && obl.competencyMonth !== competencyFilter) return false
        if (scopeFilter !== "all" && obl.scope !== scopeFilter) return false
        if (regimeFilter !== "all") {
          // Match por regime aplicável OU regime do cliente
          const matchesByApplicable = obl.applicableRegimes?.includes(regimeFilter as TaxRegime) ?? false
          const matchesByClient = obl.client.taxRegime === regimeFilter
          if (!matchesByApplicable && !matchesByClient) return false
        }
        return true
      }),
    [obligations, search, clientFilter, priorityFilter, competencyFilter, scopeFilter, regimeFilter],
  )

  const sortedObligations = useMemo(() => {
    return [...filteredObligations].sort((a, b) => {
      let comparison = 0
      if (sortBy === "dueDate") {
        comparison = new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime()
      } else if (sortBy === "client") {
        comparison = a.client.name.localeCompare(b.client.name)
      } else if (sortBy === "status") {
        // Usa effectiveStatus pra que pendentes vencidas (que são overdue na realidade)
        // sejam ordenadas como overdue, não como pending.
        const statusOrder = { overdue: 0, pending: 1, in_progress: 2, completed: 3 } as const
        const sa = effectiveStatus(a) as keyof typeof statusOrder
        const sb = effectiveStatus(b) as keyof typeof statusOrder
        comparison = (statusOrder[sa] ?? 99) - (statusOrder[sb] ?? 99)
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [filteredObligations, sortBy, sortOrder])

  const handleSave = (obligation: any) => {
    saveObligation(obligation)
    toast.success("Obrigação salva com sucesso")
    onUpdate()
    setEditingObligation(undefined)
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir obrigação",
      description: "Tem certeza que deseja excluir esta obrigação? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteObligation(id)
          toast.success("Obrigação excluída")
          onUpdate()
        } catch (error) {
          toast.error("Erro ao excluir obrigação")
          console.error("[obligations] delete error:", error)
        }
      },
    })
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

  const selectedList = useMemo(
    () => obligations.filter((o) => selectedIds.has(o.id)),
    [obligations, selectedIds],
  )

  const handleBulkComplete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Concluir ${selectedIds.size} obrigações`,
      description: `Marcar ${selectedIds.size} obrigações como concluídas?`,
      confirmLabel: "Concluir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          await Promise.all(
            selectedList
              .filter((o) => o.status !== "completed")
              .map((o) =>
                saveObligation({
                  ...o,
                  status: "completed",
                  completedAt: now,
                  completedBy: "Contador",
                  history: [
                    ...(o.history || []),
                    { id: crypto.randomUUID(), action: "completed", description: "Concluída via ação em lote", timestamp: now },
                  ],
                }),
              ),
          )
          toast.success(`${selectedIds.size} obrigações concluídas`)
          clearSelection()
          onUpdate()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkReopen = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Reabrir ${selectedIds.size} obrigações`,
      description: `Volta para "Pendente" e limpa a data de conclusão.`,
      confirmLabel: "Reabrir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          const targets = selectedList.filter((o) => o.status === "completed")
          await Promise.all(
            targets.map((o) =>
              saveObligation({
                ...o,
                status: "pending",
                completedAt: undefined,
                completedBy: undefined,
                realizationDate: undefined,
                history: [
                  ...(o.history || []),
                  { id: crypto.randomUUID(), action: "status_changed", description: "Reaberta via ação em lote", timestamp: now },
                ],
              }),
            ),
          )
          toast.success(`${targets.length} obrigações reabertas`)
          clearSelection()
          onUpdate()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkInProgress = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Iniciar ${selectedIds.size} obrigações`,
      description: `Marcar ${selectedIds.size} obrigações como "Em andamento"?`,
      confirmLabel: "Iniciar",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          const targets = selectedList.filter((o) => o.status !== "in_progress")
          await Promise.all(
            targets.map((o) =>
              saveObligation({
                ...o,
                status: "in_progress",
                completedAt: undefined,
                completedBy: undefined,
                history: [
                  ...(o.history || []),
                  { id: crypto.randomUUID(), action: "status_changed", description: "Marcada como em andamento via lote", timestamp: now },
                ],
              }),
            ),
          )
          toast.success(`${targets.length} obrigações em andamento`)
          clearSelection()
          onUpdate()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Excluir ${selectedIds.size} obrigações`,
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await Promise.all(Array.from(selectedIds).map((id) => deleteObligation(id)))
          toast.success(`${selectedIds.size} obrigações excluídas`)
          clearSelection()
          onUpdate()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const openBulkEdit = () => {
    setBulkForm(EMPTY_BULK_FORM)
    setBulkEditOpen(true)
  }

  const handleBulkEditApply = async () => {
    if (selectedIds.size === 0) return
    const { priority, status, dueDay, weekendRule, competencyMonth, scope } = bulkForm
    const dueDayNum = dueDay ? Number(dueDay) : null
    if (dueDayNum !== null && (Number.isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      toast.error("Dia do vencimento deve estar entre 1 e 31")
      return
    }
    if (competencyMonth && !/^\d{4}-\d{2}$/.test(competencyMonth)) {
      toast.error("Mês de competência inválido (use formato AAAA-MM)")
      return
    }
    if (!priority && !status && !dueDayNum && !weekendRule && !competencyMonth && !scope) {
      toast.info("Preencha pelo menos um campo para aplicar")
      return
    }
    setBulkLoading(true)
    try {
      const now = new Date().toISOString()
      const changes: string[] = []
      if (priority) changes.push(`prioridade: ${priority}`)
      if (status) changes.push(`status: ${status}`)
      if (dueDayNum) changes.push(`dia do vencimento: ${dueDayNum}`)
      if (weekendRule) changes.push(`regra fim de semana: ${weekendRule}`)
      if (competencyMonth) changes.push(`competência: ${competencyMonth}`)
      if (scope) changes.push(`esfera: ${scope}`)
      const description = `Edição em lote — ${changes.join(", ")}`

      await Promise.all(
        selectedList.map((o) => {
          const updated: ObligationWithDetails = { ...o }
          if (priority) updated.priority = priority as Priority
          if (status) updated.status = status
          if (dueDayNum) updated.dueDay = dueDayNum
          if (weekendRule) updated.weekendRule = weekendRule
          if (competencyMonth) updated.competencyMonth = competencyMonth
          if (scope) updated.scope = scope as "federal" | "estadual" | "municipal"
          updated.history = [
            ...(o.history || []),
            {
              id: crypto.randomUUID(),
              action: "updated",
              description,
              timestamp: now,
            },
          ]
          return saveObligation(updated)
        }),
      )
      toast.success(`${selectedIds.size} obrigações atualizadas`)
      setBulkEditOpen(false)
      clearSelection()
      onUpdate()
    } finally {
      setBulkLoading(false)
    }
  }

  const handleComplete = async (obligation: ObligationWithDetails) => {
    const history = obligation.history || []
    const completedDate = new Date().toISOString()
    const updated = {
      ...obligation,
      status: "completed" as const,
      completedAt: completedDate,
      completedBy: "Contador",
      history: [
        ...history,
        {
          id: crypto.randomUUID(),
          action: "completed" as const,
          description: `Obrigação concluída em ${formatDate(completedDate.split("T")[0])}`,
          timestamp: completedDate,
        },
      ],
    }
    try {
      await saveObligation(updated)
      onUpdate()
    } catch (error) {
      console.error("[obligations] complete error:", error)
      toast.error("Erro ao concluir obrigação")
    }
  }

  const handleInProgress = async (obligation: ObligationWithDetails) => {
    const history = obligation.history || []
    const updated = {
      ...obligation,
      status: "in_progress" as const,
      history: [
        ...history,
        {
          id: crypto.randomUUID(),
          action: "status_changed" as const,
          description: "Status alterado para Em Andamento",
          timestamp: new Date().toISOString(),
        },
      ],
    }
    try {
      await saveObligation(updated)
      onUpdate()
    } catch (error) {
      console.error("[obligations] start error:", error)
      toast.error("Erro ao iniciar obrigação")
    }
  }

  const handleEdit = (obligation: ObligationWithDetails) => {
    setEditingObligation(obligation)
    setIsFormOpen(true)
  }

  const handleDuplicate = async (obligation: ObligationWithDetails) => {
    const now = new Date().toISOString()
    const duplicated = {
      ...obligation,
      id: crypto.randomUUID(),
      status: "pending" as const,
      completedAt: undefined,
      completedBy: undefined,
      protocol: undefined,
      createdAt: now,
      history: [
        {
          id: crypto.randomUUID(),
          action: "created" as const,
          description: `Duplicada de "${obligation.name}"`,
          timestamp: now,
        },
      ],
    }
    try {
      await saveObligation(duplicated)
      toast.success("Obrigação duplicada")
      onUpdate()
    } catch (error) {
      console.error("[obligations] duplicate error:", error)
      toast.error("Erro ao duplicar obrigação")
    }
  }

  const handleView = (obligation: ObligationWithDetails) => {
    setViewingObligation(obligation)
    setIsDetailsOpen(true)
  }

  const handleNew = () => {
    setEditingObligation(undefined)
    setIsFormOpen(true)
  }

  useImperativeHandle(ref, () => ({ openNewForm: handleNew }), [])

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)

    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Hoje"
    if (diffDays === 1) return "Amanhã"
    if (diffDays === -1) return "Ontem"
    if (diffDays < 0) return `${Math.abs(diffDays)} dias atrás`
    return `Em ${diffDays} dias`
  }

  const getStatusBadge = (obligation: ObligationWithDetails) => {
    if (obligation.status === "completed") {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="size-3 mr-1" />
            Concluída
          </Badge>
          {obligation.completedAt && (
            <span className="text-xs text-muted-foreground">{formatDate(obligation.completedAt)}</span>
          )}
        </div>
      )
    }
    if (obligation.status === "in_progress") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
          <PlayCircle className="size-3 mr-1" />
          Em Andamento
        </Badge>
      )
    }
    if (obligation.status === "overdue" || isOverdue(obligation.calculatedDueDate)) {
      return (
        <Badge variant="destructive" className="bg-red-600 text-white">
          <AlertTriangle className="size-3 mr-1" />
          Atrasada
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <Clock className="size-3 mr-1" />
        Pendente
      </Badge>
    )
  }

  const toggleSort = (field: "dueDate" | "client" | "status") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const QuickActionButtons = ({ obligation }: { obligation: ObligationWithDetails }) => {
    if (obligation.status === "completed") {
      return null
    }

    return (
      <div className="flex gap-1">
        {obligation.status === "pending" && (
          <Button size="sm" variant="outline" onClick={() => handleInProgress(obligation)} className="h-7 text-xs">
            <PlayCircle className="size-3 mr-1" />
            Iniciar
          </Button>
        )}
        <Button
          size="sm"
          variant="default"
          onClick={() => handleComplete(obligation)}
          className="h-7 text-xs bg-green-600 hover:bg-green-700"
        >
          <CheckCircle2 className="size-3 mr-1" />
          Concluir
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Nome, cliente, imposto, descrição, protocolo, competência, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filtros estilo pill — sempre visíveis */}
      <FilterBar
        activeCount={activeFilterCount}
        onClearAll={() => {
          setClientFilter("all")
          setPriorityFilter("all")
          setCompetencyFilter("")
          setScopeFilter("all")
          setRegimeFilter("all")
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
          value={competencyFilter}
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


      {/* Mobile: cards (até md) */}
      <div className="md:hidden space-y-2">
        {sortedObligations.length === 0 ? (
          <div className="border rounded-lg py-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma obrigação encontrada</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || clientFilter !== "all" || priorityFilter !== "all"
                ? "Ajuste a busca ou os filtros."
                : "Cadastre a primeira pelo botão acima."}
            </p>
          </div>
        ) : (
          sortedObligations.map((obligation) => {
            const overdue = isOverdue(obligation.calculatedDueDate) && obligation.status !== "completed"
            return (
              <div
                key={obligation.id}
                className={`border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                  selectedIds.has(obligation.id)
                    ? "bg-primary/5 border-primary/40"
                    : overdue ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900" : "bg-card"
                }`}
                onClick={() => handleView(obligation)}
              >
                <div className="flex items-start gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(obligation.id)}
                      onCheckedChange={() => toggleSelect(obligation.id)}
                      className="mt-0.5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{obligation.name}</span>
                      {obligation.priority && obligation.priority !== "medium" && (
                        <Badge variant="outline" className={
                          obligation.priority === "urgent" ? "border-red-500 text-red-700 text-[10px]"
                          : obligation.priority === "high" ? "border-orange-500 text-orange-700 text-[10px]"
                          : "border-blue-500 text-blue-700 text-[10px]"
                        }>
                          {obligation.priority === "urgent" ? "Urgente" : obligation.priority === "high" ? "Alta" : "Baixa"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{obligation.client.name}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(obligation)}>
                          <Eye className="size-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(obligation)}>
                          <Pencil className="size-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(obligation)}>
                          <Copy className="size-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(obligation.id)} className="text-destructive">
                          <Trash2 className="size-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 ml-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(obligation)}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-medium">{formatDate(obligation.calculatedDueDate)}</div>
                    <div className="text-[10px] text-muted-foreground">{getRelativeDate(obligation.calculatedDueDate)}</div>
                  </div>
                </div>

                <div className="ml-6" onClick={(e) => e.stopPropagation()}>
                  <QuickActionButtons obligation={obligation} />
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
                    sortedObligations.length > 0 &&
                    sortedObligations.every((o) => selectedIds.has(o.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(sortedObligations.map((o) => o.id)))
                    } else {
                      clearSelection()
                    }
                  }}
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <ResizableTableHead defaultWidth={280} storageKey="obrigacoes-name">Obrigação</ResizableTableHead>
              <ResizableTableHead defaultWidth={260} storageKey="obrigacoes-client">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("client")} className="-ml-3">
                  Cliente
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={160} storageKey="obrigacoes-regimes">Regimes</ResizableTableHead>
              <ResizableTableHead defaultWidth={180} storageKey="obrigacoes-due">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("dueDate")} className="-ml-3">
                  Vencimento
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={140} storageKey="obrigacoes-status">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("status")} className="-ml-3">
                  Status
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={180} storageKey="obrigacoes-actions">Ações Rápidas</ResizableTableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedObligations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-1">
                      <FileText className="size-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium">Nenhuma obrigação encontrada</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {search || clientFilter !== "all" || priorityFilter !== "all"
                        ? "Tente ajustar a busca ou os filtros."
                        : "Cadastre a primeira obrigação clicando no botão abaixo."}
                    </p>
                    {!search && clientFilter === "all" && priorityFilter === "all" && (
                      <Button onClick={handleNew} className="mt-2 gap-2">
                        Nova Obrigação
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedObligations.map((obligation) => (
                <TableRow
                  key={obligation.id}
                  data-state={selectedIds.has(obligation.id) ? "selected" : undefined}
                  className={`cursor-pointer ${
                    selectedIds.has(obligation.id)
                      ? "bg-primary/5"
                      : isOverdue(obligation.calculatedDueDate) && obligation.status !== "completed"
                        ? "bg-red-50/50 dark:bg-red-950/10"
                        : ""
                  }`}
                  onClick={() => handleView(obligation)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(obligation.id)}
                      onCheckedChange={() => toggleSelect(obligation.id)}
                      aria-label={`Selecionar ${obligation.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium hover:underline">{obligation.name}</div>
                        {obligation.scope && (
                          <Badge
                            variant="outline"
                            className={
                              obligation.scope === "federal"
                                ? "border-violet-500 text-violet-700 dark:text-violet-400"
                                : obligation.scope === "estadual"
                                  ? "border-amber-500 text-amber-700 dark:text-amber-400"
                                  : "border-teal-500 text-teal-700 dark:text-teal-400"
                            }
                          >
                            {obligation.scope === "federal"
                              ? "Federal"
                              : obligation.scope === "estadual"
                                ? "Estadual"
                                : "Municipal"}
                          </Badge>
                        )}
                        {obligation.priority && obligation.priority !== "medium" && (
                          <Badge
                            variant="outline"
                            className={
                              obligation.priority === "urgent"
                                ? "border-red-500 text-red-700 dark:text-red-400"
                                : obligation.priority === "high"
                                  ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                  : "border-blue-500 text-blue-700 dark:text-blue-400"
                            }
                          >
                            {obligation.priority === "urgent"
                              ? "Urgente"
                              : obligation.priority === "high"
                                ? "Alta"
                                : "Baixa"}
                          </Badge>
                        )}
                      </div>
                      {obligation.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">{obligation.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{obligation.client.name}</div>
                  </TableCell>
                  <TableCell>
                    {obligation.applicableRegimes && obligation.applicableRegimes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {obligation.applicableRegimes.map((r) => (
                          <span
                            key={r}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TAX_REGIME_COLORS[r as TaxRegime]}`}
                          >
                            {TAX_REGIME_LABELS[r as TaxRegime]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Todos</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-mono text-sm font-medium">{formatDate(obligation.calculatedDueDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        {getRelativeDate(obligation.calculatedDueDate)}
                      </div>
                      {/* Indicador de ajuste por feriado/fim-de-semana */}
                      {(() => {
                        const info = calculateDueDateInfoFromCompetency(
                          obligation.competencyMonth,
                          obligation.dueDay,
                          obligation.weekendRule,
                          obligation.dueMonth,
                        )
                        if (!info?.wasAdjusted) return null
                        const arrow = info.direction === "anticipate" ? "←" : "→"
                        return (
                          <div
                            className="text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1"
                            title={`${info.reason} — vencimento original: ${formatDate(info.originalDate)}`}
                          >
                            <span>🎉</span>
                            <span className="truncate">
                              {arrow} {info.reason}
                            </span>
                          </div>
                        )
                      })()}
                      {obligation.competencyMonth && (
                        <div className="text-[10px] text-muted-foreground">
                          Competência: <span className="font-mono">{obligation.competencyMonth}</span>
                        </div>
                      )}
                      {obligation.recurrence && (
                        <Badge variant="secondary" className="text-xs">
                          {getRecurrenceDescription(obligation)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(obligation)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <QuickActionButtons obligation={obligation} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(obligation)}>
                          <Eye className="size-4 mr-2" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(obligation)}>
                          <Pencil className="size-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(obligation.id)} className="text-destructive">
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

      <ObligationForm
        obligation={editingObligation}
        clients={clients}
        taxes={taxes}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave}
      />

      {viewingObligation && (
        <ObligationDetails
          obligation={viewingObligation}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onEdit={handleEdit}
        />
      )}

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.size} obrigações em lote</DialogTitle>
            <DialogDescription>
              Preencha apenas os campos que deseja alterar. Os demais ficam como estão.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <Select
                value={bulkForm.priority || "keep"}
                onValueChange={(v) => setBulkForm((f) => ({ ...f, priority: v === "keep" ? "" : (v as Priority) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">(não alterar)</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={bulkForm.status || "keep"}
                onValueChange={(v) =>
                  setBulkForm((f) => ({ ...f, status: v === "keep" ? "" : (v as BulkEditForm["status"]) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">(não alterar)</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vencimento e competência</p>
              <div className="grid gap-2">
                <Label htmlFor="bulk-competency">Mês de competência</Label>
                <Input
                  id="bulk-competency"
                  type="month"
                  value={bulkForm.competencyMonth}
                  onChange={(e) => setBulkForm((f) => ({ ...f, competencyMonth: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Move as obrigações para outro mês/ano de competência. Ex: <strong>2026-02</strong> = fevereiro/2026.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-due-day">Dia do vencimento (1-31)</Label>
                <Input
                  id="bulk-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 20 (deixe em branco para manter)"
                  value={bulkForm.dueDay}
                  onChange={(e) => setBulkForm((f) => ({ ...f, dueDay: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Dia 31 em meses sem 31 será ajustado para o último dia automaticamente.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Esfera</Label>
              <Select
                value={bulkForm.scope || "__keep__"}
                onValueChange={(v) =>
                  setBulkForm((f) => ({
                    ...f,
                    scope: v === "__keep__" ? "" : (v as BulkEditForm["scope"]),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">(não alterar)</SelectItem>
                  <SelectItem value="federal">Federal</SelectItem>
                  <SelectItem value="estadual">Estadual</SelectItem>
                  <SelectItem value="municipal">Municipal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Se cair em fim de semana / feriado</Label>
              <Select
                value={bulkForm.weekendRule || "__keep__"}
                onValueChange={(v) =>
                  setBulkForm((f) => ({
                    ...f,
                    weekendRule: v === "__keep__" ? "" : (v as BulkEditForm["weekendRule"]),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">(não alterar)</SelectItem>
                  <SelectItem value="postpone">Postergar p/ próximo útil</SelectItem>
                  <SelectItem value="anticipate">Antecipar p/ útil anterior</SelectItem>
                  <SelectItem value="keep">Manter na data</SelectItem>
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
})
