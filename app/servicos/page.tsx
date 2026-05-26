"use client"

/**
 * Página /servicos — 4º tipo de tarefa do app.
 *
 * Lista de serviços avulsos prestados aos clientes (NF-e, consultoria,
 * outros). Mesmo padrão visual de /impostos com tabs por status, busca,
 * filtros por cliente/categoria e ações rápidas.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useUrlState } from "@/hooks/use-url-state"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ServiceForm } from "@/features/services/components/service-form"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FilterBar, FilterPill } from "@/components/filter-panel"
import {
  Briefcase,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Building2,
  CalendarDays as CalendarIcon,
  Tag,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { saveService, deleteService } from "@/features/services/services"
import { formatDate, isOverdue } from "@/lib/date-utils"
import { matchesText } from "@/lib/utils"
import type { Service, ServiceCategory } from "@/lib/types"
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_COLORS } from "@/lib/types"

function getEffectiveServiceStatus(s: Service): Service["status"] {
  if (s.status === "completed") return "completed"
  if (s.status === "in_progress") return "in_progress"
  return isOverdue(s.dueDate) ? "overdue" : "pending"
}

export default function ServicosPage() {
  const { services, clients, refreshData } = useData()
  const { isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()
  const [editing, setEditing] = useState<Service | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useUrlState("tab")
  const [clientFilter, setClientFilter] = useUrlState("clientId")
  const [categoryFilter, setCategoryFilter] = useUrlState("category")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (clientFilter && clientFilter !== "all" ? 1 : 0) +
    (categoryFilter && categoryFilter !== "all" ? 1 : 0)

  const handleSave = async (svc: Service) => {
    try {
      await saveService(svc)
      toast.success("Serviço salvo")
      await refreshData()
      setEditing(undefined)
      setIsFormOpen(false)
    } catch (e) {
      console.error("[servicos] save error:", e)
      toast.error("Erro ao salvar serviço")
    }
  }

  const handleNew = () => {
    setEditing(undefined)
    setIsFormOpen(true)
  }

  const handleEdit = (s: Service) => {
    setEditing(s)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir serviço",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteService(id)
          toast.success("Serviço excluído")
          await refreshData()
        } catch (e) {
          console.error("[servicos] delete error:", e)
          toast.error("Erro ao excluir serviço")
        }
      },
    })
  }

  const handleComplete = async (s: Service) => {
    try {
      const now = new Date().toISOString()
      await saveService({
        ...s,
        status: "completed",
        completedAt: now,
        completedBy: "Contador",
      })
      toast.success(`${s.name} concluído`)
      await refreshData()
    } catch (e) {
      console.error("[servicos] complete error:", e)
      toast.error("Erro ao concluir serviço")
    }
  }

  const handleStart = async (s: Service) => {
    try {
      await saveService({ ...s, status: "in_progress" })
      await refreshData()
    } catch (e) {
      console.error("[servicos] start error:", e)
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

  // Filtrar + buscar
  const filteredServices = useMemo(() => {
    const q = search.trim()
    return services.filter((s) => {
      if (q) {
        const hit =
          matchesText(s.name, q) ||
          matchesText(s.description, q) ||
          matchesText(s.notes, q) ||
          (s.tags ?? []).some((t) => matchesText(t, q))
        if (!hit) return false
      }
      if (clientFilter && clientFilter !== "all" && s.clientId !== clientFilter) return false
      if (categoryFilter && categoryFilter !== "all" && s.category !== categoryFilter) return false
      if (!isInPeriod(s.dueDate)) return false
      return true
    })
  }, [services, search, clientFilter, categoryFilter, isInPeriod])

  const sortedServices = useMemo(
    () =>
      [...filteredServices].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
    [filteredServices],
  )

  const pendingServices = sortedServices.filter((s) => getEffectiveServiceStatus(s) === "pending")
  const inProgressServices = sortedServices.filter((s) => s.status === "in_progress")
  const completedServices = sortedServices.filter((s) => s.status === "completed")
  const overdueServices = sortedServices.filter((s) => getEffectiveServiceStatus(s) === "overdue")

  const visible = (() => {
    switch (activeTab) {
      case "pending":
        return pendingServices
      case "in_progress":
        return inProgressServices
      case "completed":
        return completedServices
      case "overdue":
        return overdueServices
      default:
        return sortedServices
    }
  })()

  const getClientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—"

  const getStatusBadge = (s: Service) => {
    const eff = getEffectiveServiceStatus(s)
    if (eff === "completed") {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          <CheckCircle2 className="size-3 mr-1" /> Concluído
        </Badge>
      )
    }
    if (eff === "in_progress") {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <PlayCircle className="size-3 mr-1" /> Em Andamento
        </Badge>
      )
    }
    if (eff === "overdue") {
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="size-3 mr-1" /> Atrasado
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
        <Clock className="size-3 mr-1" /> Pendente
      </Badge>
    )
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Briefcase className="size-6 text-primary" />
                Serviços Avulsos
              </h1>
              {isFiltering && periodLabel && (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <CalendarIcon className="size-3" />
                  {periodLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              NF-e, consultoria e outros serviços prestados aos clientes
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="size-4 mr-2" />
            Novo Serviço
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
              <span className="text-sm font-medium">Todos</span>
              <Badge variant="secondary" className="text-xs">
                {sortedServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {pendingServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <PlayCircle className="size-3.5" />
                <span className="text-sm font-medium">Em Andamento</span>
              </div>
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {inProgressServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span className="text-sm font-medium">Concluídos</span>
              </div>
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                {completedServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                <span className="text-sm font-medium">Atrasados</span>
              </div>
              <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                {overdueServices.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-6 space-y-4">
          {/* Busca + filtros */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Nome, descrição, observações, tags…"
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
              icon={<Tag className="size-3.5" />}
              label="Categoria"
              value={categoryFilter || "all"}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "Todas" },
                ...Object.entries(SERVICE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l })),
              ]}
            />
          </FilterBar>

          {/* Lista — tabela desktop / cards mobile */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center gap-2">
                        <Briefcase className="size-8 text-muted-foreground/40" />
                        <p className="font-medium">Nenhum serviço cadastrado</p>
                        <p className="text-sm text-muted-foreground">
                          Cadastre serviços avulsos (NF-e, consultoria, etc.) prestados aos seus clientes.
                        </p>
                        <Button onClick={handleNew} className="mt-2 gap-2">
                          <Plus className="size-4" /> Novo Serviço
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((s) => {
                    const isSelected = selectedIds.has(s.id)
                    return (
                      <TableRow
                        key={s.id}
                        data-state={isSelected ? "selected" : undefined}
                        className={`${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(s.id)}
                            aria-label={`Selecionar ${s.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getClientName(s.clientId)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${SERVICE_CATEGORY_COLORS[s.category]}`}
                          >
                            {SERVICE_CATEGORY_LABELS[s.category]}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{formatDate(s.dueDate)}</TableCell>
                        <TableCell>{getStatusBadge(s)}</TableCell>
                        <TableCell>
                          {s.status !== "completed" && (
                            <div className="flex gap-1">
                              {s.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStart(s)}
                                  className="h-7 text-xs"
                                >
                                  <PlayCircle className="size-3 mr-1" /> Iniciar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleComplete(s)}
                                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="size-3 mr-1" /> Concluir
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
                              <DropdownMenuItem onClick={() => handleEdit(s)}>
                                <Pencil className="size-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(s.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="size-4 mr-2" /> Excluir
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
      </div>

      <ServiceForm
        service={editing}
        clients={clients}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={() => {
          refreshData()
        }}
      />
    </div>
  )
}
