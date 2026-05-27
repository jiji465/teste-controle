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
import { FilterBar, FilterPill } from "@/components/filter-panel"
import { Building2, AlertCircle as PriorityIcon, Tag } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ServiceForm } from "./service-form"
import {
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  ArrowUpDown,
  Clock,
  RotateCcw,
  Copy,
  Briefcase,
} from "lucide-react"
import type { Service, Client, Priority, ServiceCategory, WeekendRule } from "@/lib/types"
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_COLORS } from "@/lib/types"
import { saveService, deleteService } from "@/features/services/services"
import { adjustForWeekend, buildSafeDate, formatDate, isOverdue } from "@/lib/date-utils"
import { matchesText } from "@/lib/utils"
import { toast } from "sonner"

type ServiceListProps = {
  services: Service[]
  clients: Client[]
  onUpdate: () => void
}

export type ServiceListHandle = {
  openNewForm: () => void
}

type BulkEditForm = {
  priority: "" | Priority
  status: "" | "pending" | "in_progress" | "completed"
  category: "" | ServiceCategory
  weekendRule: "" | WeekendRule
}

const EMPTY_BULK_FORM: BulkEditForm = {
  priority: "",
  status: "",
  category: "",
  weekendRule: "",
}

/** Aplica a regra de fim de semana numa string "AAAA-MM-DD" sem mexer em
 *  timezone — buildSafeDate evita o pulo de dia. */
function applyWeekendRuleToYmd(ymd: string, rule: WeekendRule): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || rule === "keep") return ymd
  const [y, m, d] = ymd.split("-").map(Number)
  const adjusted = adjustForWeekend(buildSafeDate(y, m - 1, d), rule)
  return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, "0")}-${String(adjusted.getDate()).padStart(2, "0")}`
}

function effectiveServiceStatus(s: Service): Service["status"] {
  if (s.status === "completed") return "completed"
  if (s.status === "in_progress") return "in_progress"
  return isOverdue(s.dueDate) ? "overdue" : "pending"
}

export const ServiceList = forwardRef<ServiceListHandle, ServiceListProps>(function ServiceList(
  { services, clients, onUpdate }: ServiceListProps,
  ref,
) {
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [editing, setEditing] = useState<Service | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [sortBy, setSortBy] = useState<"dueDate" | "client" | "status" | "name">("dueDate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState<BulkEditForm>(EMPTY_BULK_FORM)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (clientFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0)

  const getClient = (id: string) => clients.find((c) => c.id === id)

  const filteredServices = useMemo(
    () =>
      services.filter((s) => {
        if (search.trim()) {
          const q = search.trim()
          const client = getClient(s.clientId)
          const textHit =
            matchesText(s.name, q) ||
            matchesText(client?.name, q) ||
            matchesText(client?.tradeName, q) ||
            matchesText(s.description, q) ||
            matchesText(s.notes, q) ||
            (s.tags ?? []).some((t) => matchesText(t, q))
          if (!textHit) return false
        }
        if (clientFilter !== "all" && s.clientId !== clientFilter) return false
        if (categoryFilter !== "all" && s.category !== categoryFilter) return false
        if (priorityFilter !== "all" && s.priority !== priorityFilter) return false
        return true
      }),
    [services, search, clientFilter, categoryFilter, priorityFilter, clients],
  )

  const sortedServices = useMemo(() => {
    return [...filteredServices].sort((a, b) => {
      let comparison = 0
      if (sortBy === "dueDate") {
        comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      } else if (sortBy === "client") {
        const an = getClient(a.clientId)?.name ?? ""
        const bn = getClient(b.clientId)?.name ?? ""
        comparison = an.localeCompare(bn, "pt-BR")
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name, "pt-BR")
      } else if (sortBy === "status") {
        const statusOrder = { overdue: 0, pending: 1, in_progress: 2, completed: 3 } as const
        const sa = effectiveServiceStatus(a) as keyof typeof statusOrder
        const sb = effectiveServiceStatus(b) as keyof typeof statusOrder
        comparison = (statusOrder[sa] ?? 99) - (statusOrder[sb] ?? 99)
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [filteredServices, sortBy, sortOrder, clients])

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir serviço",
      description: "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteService(id)
          toast.success("Serviço excluído")
          onUpdate()
        } catch (error) {
          toast.error("Erro ao excluir serviço")
          console.error("[services] delete error:", error)
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
    () => services.filter((s) => selectedIds.has(s.id)),
    [services, selectedIds],
  )

  const handleBulkComplete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Concluir ${selectedIds.size} serviços`,
      description: `Marcar ${selectedIds.size} serviços como concluídos?`,
      confirmLabel: "Concluir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          await Promise.all(
            selectedList
              .filter((s) => s.status !== "completed")
              .map((s) =>
                saveService({
                  ...s,
                  status: "completed",
                  completedAt: now,
                  completedBy: "Contador",
                  history: [
                    ...(s.history || []),
                    { id: crypto.randomUUID(), action: "completed", description: "Concluído via ação em lote", timestamp: now },
                  ],
                }),
              ),
          )
          toast.success(`${selectedIds.size} serviços concluídos`)
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
      title: `Reabrir ${selectedIds.size} serviços`,
      description: `Volta para "Pendente" e limpa a data de conclusão.`,
      confirmLabel: "Reabrir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          const targets = selectedList.filter((s) => s.status === "completed")
          await Promise.all(
            targets.map((s) =>
              saveService({
                ...s,
                status: "pending",
                completedAt: undefined,
                completedBy: undefined,
                history: [
                  ...(s.history || []),
                  { id: crypto.randomUUID(), action: "status_changed", description: "Reaberto via ação em lote", timestamp: now },
                ],
              }),
            ),
          )
          toast.success(`${targets.length} serviços reabertos`)
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
      title: `Iniciar ${selectedIds.size} serviços`,
      description: `Marcar ${selectedIds.size} serviços como "Em andamento"?`,
      confirmLabel: "Iniciar",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const now = new Date().toISOString()
          const targets = selectedList.filter((s) => s.status !== "in_progress")
          await Promise.all(
            targets.map((s) =>
              saveService({
                ...s,
                status: "in_progress",
                completedAt: undefined,
                completedBy: undefined,
                history: [
                  ...(s.history || []),
                  { id: crypto.randomUUID(), action: "status_changed", description: "Marcado como em andamento via lote", timestamp: now },
                ],
              }),
            ),
          )
          toast.success(`${targets.length} serviços em andamento`)
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
      title: `Excluir ${selectedIds.size} serviços`,
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await Promise.all(Array.from(selectedIds).map((id) => deleteService(id)))
          toast.success(`${selectedIds.size} serviços excluídos`)
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
    const { priority, status, category, weekendRule } = bulkForm
    if (!priority && !status && !category && !weekendRule) {
      toast.info("Preencha pelo menos um campo para aplicar")
      return
    }
    setBulkLoading(true)
    try {
      const now = new Date().toISOString()
      const changes: string[] = []
      if (priority) changes.push(`prioridade: ${priority}`)
      if (status) changes.push(`status: ${status}`)
      if (category) changes.push(`categoria: ${category}`)
      if (weekendRule) changes.push(`regra fim de semana: ${weekendRule}`)
      const description = `Edição em lote — ${changes.join(", ")}`

      await Promise.all(
        selectedList.map((s) => {
          const updated: Service = { ...s }
          if (priority) updated.priority = priority as Priority
          if (status) updated.status = status
          if (category) updated.category = category as ServiceCategory
          if (weekendRule) {
            // Aplica a nova regra na data já salva. Importante usar a data
            // ORIGINAL caso o usuário esteja mudando de "postpone" pra
            // "anticipate" — mas como só guardamos a data efetiva, o que dá
            // pra fazer é: se o rule novo for "keep", mantém a data; se for
            // postpone/anticipate, reaplicar a partir da data atual. Em 99%
            // dos casos a data já é dia útil então não muda nada.
            updated.weekendRule = weekendRule as WeekendRule
            updated.dueDate = applyWeekendRuleToYmd(s.dueDate, weekendRule as WeekendRule)
          }
          updated.history = [
            ...(s.history || []),
            {
              id: crypto.randomUUID(),
              action: "updated",
              description,
              timestamp: now,
            },
          ]
          return saveService(updated)
        }),
      )
      toast.success(`${selectedIds.size} serviços atualizados`)
      setBulkEditOpen(false)
      clearSelection()
      onUpdate()
    } finally {
      setBulkLoading(false)
    }
  }

  const handleComplete = async (service: Service) => {
    const completedDate = new Date().toISOString()
    const updated: Service = {
      ...service,
      status: "completed",
      completedAt: completedDate,
      completedBy: "Contador",
      history: [
        ...(service.history || []),
        {
          id: crypto.randomUUID(),
          action: "completed",
          description: `Serviço concluído em ${formatDate(completedDate.split("T")[0])}`,
          timestamp: completedDate,
        },
      ],
    }
    try {
      await saveService(updated)
      toast.success(`${service.name} concluído`)
      onUpdate()
    } catch (error) {
      console.error("[services] complete error:", error)
      toast.error("Erro ao concluir serviço")
    }
  }

  const handleInProgress = async (service: Service) => {
    const updated: Service = {
      ...service,
      status: "in_progress",
      history: [
        ...(service.history || []),
        {
          id: crypto.randomUUID(),
          action: "status_changed",
          description: "Status alterado para Em Andamento",
          timestamp: new Date().toISOString(),
        },
      ],
    }
    try {
      await saveService(updated)
      onUpdate()
    } catch (error) {
      console.error("[services] start error:", error)
      toast.error("Erro ao iniciar serviço")
    }
  }

  const handleEdit = (service: Service) => {
    setEditing(service)
    setIsFormOpen(true)
  }

  const handleDuplicate = async (service: Service) => {
    const now = new Date().toISOString()
    const duplicated: Service = {
      ...service,
      id: crypto.randomUUID(),
      status: "pending",
      completedAt: undefined,
      completedBy: undefined,
      createdAt: now,
      history: [
        {
          id: crypto.randomUUID(),
          action: "created",
          description: `Duplicado de "${service.name}"`,
          timestamp: now,
        },
      ],
    }
    try {
      await saveService(duplicated)
      toast.success("Serviço duplicado")
      onUpdate()
    } catch (error) {
      console.error("[services] duplicate error:", error)
      toast.error("Erro ao duplicar serviço")
    }
  }

  const handleNew = () => {
    setEditing(undefined)
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

  const getStatusBadge = (service: Service) => {
    const eff = effectiveServiceStatus(service)
    if (eff === "completed") {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="size-3 mr-1" />
            Concluído
          </Badge>
          {service.completedAt && (
            <span className="text-xs text-muted-foreground">{formatDate(service.completedAt)}</span>
          )}
        </div>
      )
    }
    if (eff === "in_progress") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
          <PlayCircle className="size-3 mr-1" />
          Em Andamento
        </Badge>
      )
    }
    if (eff === "overdue") {
      return (
        <Badge variant="destructive" className="bg-red-600 text-white">
          <AlertTriangle className="size-3 mr-1" />
          Atrasado
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

  const toggleSort = (field: "dueDate" | "client" | "status" | "name") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const QuickActionButtons = ({ service }: { service: Service }) => {
    if (service.status === "completed") return null
    return (
      <div className="flex gap-1">
        {service.status === "pending" && (
          <Button size="sm" variant="outline" onClick={() => handleInProgress(service)} className="h-7 text-xs">
            <PlayCircle className="size-3 mr-1" />
            Iniciar
          </Button>
        )}
        <Button
          size="sm"
          variant="default"
          onClick={() => handleComplete(service)}
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
            placeholder="Nome, cliente, descrição, observações, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <FilterBar
        activeCount={activeFilterCount}
        onClearAll={() => {
          setClientFilter("all")
          setCategoryFilter("all")
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
          icon={<Tag className="size-3.5" />}
          label="Categoria"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: "all", label: "Todas" },
            ...(Object.entries(SERVICE_CATEGORY_LABELS) as [ServiceCategory, string][]).map(([v, l]) => ({ value: v, label: l })),
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
        {sortedServices.length === 0 ? (
          <div className="border rounded-lg py-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
              <Briefcase className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum serviço encontrado</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || clientFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all"
                ? "Ajuste a busca ou os filtros."
                : "Cadastre o primeiro pelo botão acima."}
            </p>
          </div>
        ) : (
          sortedServices.map((service) => {
            const overdue = isOverdue(service.dueDate) && service.status !== "completed"
            const client = getClient(service.clientId)
            return (
              <div
                key={service.id}
                className={`border rounded-lg p-3 space-y-2 ${
                  selectedIds.has(service.id)
                    ? "bg-primary/5 border-primary/40"
                    : overdue ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900" : "bg-card"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedIds.has(service.id)}
                    onCheckedChange={() => toggleSelect(service.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{service.name}</span>
                      {service.priority && service.priority !== "medium" && (
                        <Badge variant="outline" className={
                          service.priority === "urgent" ? "border-red-500 text-red-700 text-[10px]"
                          : service.priority === "high" ? "border-orange-500 text-orange-700 text-[10px]"
                          : "border-blue-500 text-blue-700 text-[10px]"
                        }>
                          {service.priority === "urgent" ? "Urgente" : service.priority === "high" ? "Alta" : "Baixa"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{client?.name ?? "—"}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-1 ${SERVICE_CATEGORY_COLORS[service.category]}`}>
                      {SERVICE_CATEGORY_LABELS[service.category]}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(service)}>
                        <Pencil className="size-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(service)}>
                        <Copy className="size-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(service.id)} className="text-destructive">
                        <Trash2 className="size-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between gap-2 ml-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(service)}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-medium">{formatDate(service.dueDate)}</div>
                    <div className="text-[10px] text-muted-foreground">{getRelativeDate(service.dueDate)}</div>
                  </div>
                </div>

                <div className="ml-6">
                  <QuickActionButtons service={service} />
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
                    sortedServices.length > 0 &&
                    sortedServices.every((s) => selectedIds.has(s.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(sortedServices.map((s) => s.id)))
                    } else {
                      clearSelection()
                    }
                  }}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <ResizableTableHead defaultWidth={280} storageKey="servicos-name">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("name")} className="-ml-3">
                  Serviço
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={240} storageKey="servicos-client">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("client")} className="-ml-3">
                  Cliente
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={140} storageKey="servicos-category">Categoria</ResizableTableHead>
              <ResizableTableHead defaultWidth={170} storageKey="servicos-due">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("dueDate")} className="-ml-3">
                  Data
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={140} storageKey="servicos-status">
                <Button variant="ghost" size="sm" onClick={() => toggleSort("status")} className="-ml-3">
                  Status
                  <ArrowUpDown className="ml-2 size-3" />
                </Button>
              </ResizableTableHead>
              <ResizableTableHead defaultWidth={180} storageKey="servicos-actions">Ações Rápidas</ResizableTableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedServices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-1">
                      <Briefcase className="size-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium">Nenhum serviço encontrado</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {search || clientFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all"
                        ? "Tente ajustar a busca ou os filtros."
                        : "Cadastre o primeiro serviço clicando no botão abaixo."}
                    </p>
                    {!search && clientFilter === "all" && categoryFilter === "all" && priorityFilter === "all" && (
                      <Button onClick={handleNew} className="mt-2 gap-2">
                        Novo Serviço
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedServices.map((service) => {
                const overdue = isOverdue(service.dueDate) && service.status !== "completed"
                const client = getClient(service.clientId)
                return (
                  <TableRow
                    key={service.id}
                    data-state={selectedIds.has(service.id) ? "selected" : undefined}
                    className={
                      selectedIds.has(service.id)
                        ? "bg-primary/5"
                        : overdue
                          ? "bg-red-50/50 dark:bg-red-950/10"
                          : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(service.id)}
                        onCheckedChange={() => toggleSelect(service.id)}
                        aria-label={`Selecionar ${service.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium">{service.name}</div>
                          {service.priority && service.priority !== "medium" && (
                            <Badge
                              variant="outline"
                              className={
                                service.priority === "urgent"
                                  ? "border-red-500 text-red-700 dark:text-red-400"
                                  : service.priority === "high"
                                    ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                    : "border-blue-500 text-blue-700 dark:text-blue-400"
                              }
                            >
                              {service.priority === "urgent"
                                ? "Urgente"
                                : service.priority === "high"
                                  ? "Alta"
                                  : "Baixa"}
                            </Badge>
                          )}
                        </div>
                        {service.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">{service.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{client?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${SERVICE_CATEGORY_COLORS[service.category]}`}
                      >
                        {SERVICE_CATEGORY_LABELS[service.category]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-mono text-sm font-medium">{formatDate(service.dueDate)}</div>
                        <div className="text-xs text-muted-foreground">{getRelativeDate(service.dueDate)}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(service)}</TableCell>
                    <TableCell>
                      <QuickActionButtons service={service} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(service)}>
                            <Pencil className="size-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(service)}>
                            <Copy className="size-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(service.id)} className="text-destructive">
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

      <ServiceForm
        service={editing}
        clients={clients}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={onUpdate}
      />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.size} serviços em lote</DialogTitle>
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
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select
                value={bulkForm.category || "keep"}
                onValueChange={(v) =>
                  setBulkForm((f) => ({ ...f, category: v === "keep" ? "" : (v as ServiceCategory) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">(não alterar)</SelectItem>
                  {(Object.entries(SERVICE_CATEGORY_LABELS) as [ServiceCategory, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
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
                    weekendRule: v === "__keep__" ? "" : (v as WeekendRule),
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
