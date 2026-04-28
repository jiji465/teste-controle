"use client"

/**
 * Página de Parcelamentos — segue o mesmo padrão de Impostos e Obrigações.
 *
 * Modelo:
 *   1 parcelamento = 1 registro com contador interno (currentInstallment).
 *   "Iniciar" marca status = in_progress (igual aos outros).
 *   "Concluir" marca a parcela atual como paga, avança +1, e se for a
 *   última, marca o parcelamento todo como concluído.
 *
 *   O histórico de pagamentos por parcela (paidInstallments[]) continua
 *   sendo registrado em background — aparece no card de detalhes mostrando
 *   datas exatas de cada parcela paga.
 */

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResizableTableHead } from "@/components/ui/resizable-table-head"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ExportButton } from "@/components/export-button"
import type { ExportColumn } from "@/lib/export-utils"
import { InstallmentForm } from "@/features/installments/components/installment-form"
import { InstallmentDetails } from "@/features/installments/components/installment-details"
import { GlobalSearch } from "@/components/global-search"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { FilterBar, FilterPill } from "@/components/filter-panel"
import {
  payCurrentInstallment,
  markCurrentInstallmentAsSent,
  confirmInstallmentPayment,
  undoLastSent,
} from "@/features/installments/actions"
import { saveInstallment, deleteInstallment } from "@/lib/supabase/database"
import { matchesText } from "@/lib/utils"
import type { Installment } from "@/lib/types"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlayCircle,
  Eye,
  MoreVertical,
  CreditCard,
  ArrowUpDown,
  RotateCcw,
  Calendar as CalendarIcon,
  Building2,
  AlertCircle as PriorityIcon,
} from "lucide-react"
import {
  formatDate,
  adjustForWeekend,
  buildSafeDate,
  isOverdue,
} from "@/lib/date-utils"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { useUrlState } from "@/hooks/use-url-state"
import { statusLabel, priorityLabel } from "@/lib/labels"
import { toast } from "sonner"

export default function ParcelamentosPage() {
  // ─── Dados ───────────────────────────────────────────────────────────────
  const {
    installments,
    clients,
    taxes,
    obligationsWithDetails,
    refreshData,
  } = useData()
  const { isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()

  // ─── Estado de filtro / ordenação / UI ───────────────────────────────────
  // Filtros persistidos no URL pra permitir compartilhar links com filtros
  // aplicados e que o histórico do navegador (voltar/avançar) preserve estado.
  // Igual ao padrão de /impostos.
  const [statusFilter, setStatusFilter] = useUrlState("tab")
  const [clientFilter, setClientFilter] = useUrlState("client")
  const [priorityFilter, setPriorityFilter] = useUrlState("priority")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "client" | "dueDate" | "status">("dueDate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const [editing, setEditing] = useState<Installment | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewing, setViewing] = useState<Installment | undefined>()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (clientFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0)

  // ─── Helpers de cálculo ──────────────────────────────────────────────────

  const getClientName = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.name || "Cliente não encontrado"

  const getTaxName = (taxId?: string) => {
    if (!taxId) return "-"
    return taxes.find((t) => t.id === taxId)?.name || "-"
  }

  /** Vencimento da parcela ATUAL. */
  const calculateDueDate = (i: Installment): Date => {
    const firstDue = new Date(i.firstDueDate)
    const monthsToAdd = i.currentInstallment - 1
    const date = buildSafeDate(
      firstDue.getFullYear(),
      firstDue.getMonth() + monthsToAdd,
      i.dueDay,
    )
    return adjustForWeekend(date, i.weekendRule)
  }

  /** Status efetivo — segue mesmo padrão de Impostos:
   *   - completed: status no banco === completed
   *   - overdue: data atual da parcela passou e não está concluído
   *   - in_progress / pending: como está no banco */
  const getStatus = (i: Installment): "pending" | "in_progress" | "completed" | "overdue" => {
    if (i.status === "completed") return "completed"
    const due = calculateDueDate(i)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (due < today) return "overdue"
    return i.status
  }

  // ─── Listas computadas ───────────────────────────────────────────────────

  const filteredInstallments = useMemo(() => {
    const q = searchTerm.trim()
    return installments.filter((i) => {
      if (q) {
        const hit =
          matchesText(i.name, q) ||
          matchesText(getClientName(i.clientId), q) ||
          matchesText(getTaxName(i.taxId), q) ||
          matchesText(i.description, q) ||
          matchesText(i.protocol, q) ||
          matchesText(i.notes, q) ||
          (i.tags ?? []).some((t) => matchesText(t, q))
        if (!hit) return false
      }
      if (clientFilter !== "all" && i.clientId !== clientFilter) return false
      if (priorityFilter !== "all" && i.priority !== priorityFilter) return false
      // Filtro global por período (PeriodSwitcher do topo)
      if (!isInPeriod(calculateDueDate(i))) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, searchTerm, clientFilter, priorityFilter, clients, taxes, isInPeriod])

  const sortedInstallments = useMemo(() => {
    const arr = [...filteredInstallments]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortBy === "name") cmp = a.name.localeCompare(b.name, "pt-BR")
      else if (sortBy === "client")
        cmp = getClientName(a.clientId).localeCompare(getClientName(b.clientId), "pt-BR")
      else if (sortBy === "dueDate")
        cmp = calculateDueDate(a).getTime() - calculateDueDate(b).getTime()
      else if (sortBy === "status") {
        const order = { overdue: 0, pending: 1, in_progress: 2, completed: 3 } as const
        cmp = (order[getStatus(a)] ?? 9) - (order[getStatus(b)] ?? 9)
      }
      return sortOrder === "asc" ? cmp : -cmp
    })
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredInstallments, sortBy, sortOrder, clients, taxes])

  // Stats por status — respeita PeriodSwitcher (igual aos outros)
  const statusCounts = useMemo(() => {
    const inPeriod = installments.filter((i) => isInPeriod(calculateDueDate(i)))
    const counts = { all: inPeriod.length, pending: 0, in_progress: 0, completed: 0, overdue: 0 }
    inPeriod.forEach((i) => {
      counts[getStatus(i)]++
    })
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, isInPeriod])

  // Lista exibida varia por aba ativa
  const getFilteredByTab = () => {
    if (statusFilter === "all") return sortedInstallments
    return sortedInstallments.filter((i) => getStatus(i) === statusFilter)
  }
  const visibleInstallments = getFilteredByTab()

  // ─── Ações ───────────────────────────────────────────────────────────────

  const handleStart = async (i: Installment) => {
    try {
      await saveInstallment({ ...i, status: "in_progress" })
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] start error:", e)
      toast.error("Erro ao iniciar parcelamento")
    }
  }

  const handleComplete = async (i: Installment) => {
    try {
      const result = payCurrentInstallment(i)
      await saveInstallment(result.updated)
      toast.success(
        result.isFinalPayment
          ? `Parcela ${result.paidNumber}/${i.installmentCount} paga — parcelamento concluído!`
          : `Parcela ${result.paidNumber}/${i.installmentCount} paga. Próxima: ${result.paidNumber + 1}/${i.installmentCount}`,
      )
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] complete error:", e)
      // Mensagem do erro vem do guard de actions.ts quando registro tá
      // inconsistente. Senão usa fallback genérico.
      toast.error(e instanceof Error ? e.message : "Erro ao concluir parcela")
    }
  }

  const handleReopen = async (i: Installment) => {
    try {
      // Se está concluído ou tem parcelas pagas, desfaz o último envio.
      // Se nem chegou a iniciar, só volta status pra pending.
      const records = i.paidInstallments ?? []
      if (records.length > 0) {
        await saveInstallment(undoLastSent(i))
      } else {
        await saveInstallment({
          ...i,
          status: "pending",
          completedAt: undefined,
          completedBy: undefined,
        })
      }
      toast.success("Parcelamento reaberto")
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] reopen error:", e)
      toast.error("Erro ao reabrir")
    }
  }

  const handleEdit = (i: Installment) => {
    setEditing(i)
    setIsFormOpen(true)
  }

  const handleNew = () => {
    setEditing(undefined)
    setIsFormOpen(true)
  }

  const handleView = (i: Installment) => {
    setViewing(i)
    setIsDetailsOpen(true)
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir parcelamento",
      description: "Tem certeza? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteInstallment(id)
          toast.success("Parcelamento excluído")
          await refreshData()
        } catch (e) {
          console.error("[parcelamentos] delete error:", e)
          toast.error("Erro ao excluir")
        }
      },
    })
  }

  // ─── Bulk actions ───────────────────────────────────────────────────────

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
      title: `Concluir parcela atual de ${selectedIds.size} parcelamentos`,
      description:
        "Marca a parcela atual de cada parcelamento selecionado como paga. Se for a última, finaliza o parcelamento.",
      confirmLabel: "Concluir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          // Filtra também por currentInstallment válido pra evitar erro
          // do guard em registros inconsistentes (silencia em vez de
          // explodir o lote inteiro). Reportamos quantos foram pulados.
          const all = installments.filter((i) => selectedIds.has(i.id) && i.status !== "completed")
          const targets = all.filter(
            (i) => i.currentInstallment >= 1 && i.currentInstallment <= i.installmentCount,
          )
          const skipped = all.length - targets.length
          await Promise.all(
            targets.map((i) => {
              const result = payCurrentInstallment(i)
              return saveInstallment(result.updated)
            }),
          )
          toast.success(
            skipped > 0
              ? `${targets.length} parcelas pagas · ${skipped} ignorada${skipped > 1 ? "s" : ""} (registro inconsistente)`
              : `${targets.length} parcelas pagas`,
          )
          clearSelection()
          await refreshData()
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
      description: `Marcar como "Em Andamento"?`,
      confirmLabel: "Iniciar",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = installments.filter(
            (i) => selectedIds.has(i.id) && i.status !== "in_progress",
          )
          await Promise.all(
            targets.map((i) => saveInstallment({ ...i, status: "in_progress" })),
          )
          toast.success(`${targets.length} parcelamentos em andamento`)
          clearSelection()
          await refreshData()
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
      description: `Volta para "Pendente" e desfaz o último pagamento, se houver.`,
      confirmLabel: "Reabrir",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = installments.filter((i) => selectedIds.has(i.id))
          await Promise.all(
            targets.map((i) => {
              const records = i.paidInstallments ?? []
              if (records.length > 0) {
                return saveInstallment(undoLastSent(i))
              }
              return saveInstallment({
                ...i,
                status: "pending",
                completedAt: undefined,
                completedBy: undefined,
              })
            }),
          )
          toast.success(`${targets.length} parcelamentos reabertos`)
          clearSelection()
          await refreshData()
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
          await refreshData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  // ─── Sort ────────────────────────────────────────────────────────────────

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Mantém viewing sincronizado quando installments muda (após pagar)
  useEffect(() => {
    if (!viewing) return
    const fresh = installments.find((i) => i.id === viewing.id)
    if (fresh && fresh !== viewing) setViewing(fresh)
  }, [installments, viewing])

  // ⌘K busca global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // ─── Status badge (mesmo estilo de Impostos) ─────────────────────────────

  const getStatusBadge = (i: Installment) => {
    const status = getStatus(i)
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="size-3 mr-1" />
            Concluído {i.completedAt && `em ${formatDate(i.completedAt)}`}
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
            Atrasado
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

  // ─── Export ─────────────────────────────────────────────────────────────

  const exportColumns: ExportColumn<Installment>[] = [
    { header: "Nome", width: 28, accessor: (i) => i.name },
    { header: "Cliente", width: 28, accessor: (i) => getClientName(i.clientId) },
    { header: "Imposto", width: 18, accessor: (i) => getTaxName(i.taxId) },
    { header: "Parcela", width: 12, accessor: (i) => `${i.currentInstallment}/${i.installmentCount}` },
    { header: "1º vencimento", width: 14, accessor: (i) => new Date(i.firstDueDate) },
    { header: "Próx. venc.", width: 14, accessor: (i) => calculateDueDate(i) },
    { header: "Status", width: 14, accessor: (i) => statusLabel(getStatus(i)) },
    { header: "Prioridade", width: 12, accessor: (i) => priorityLabel(i.priority) },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      <div className="space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
            <p className="text-sm text-muted-foreground">
              Gerencie parcelamentos de impostos e obrigações
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
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
              columns={exportColumns}
              rows={filteredInstallments}
            />
            <Button onClick={handleNew}>
              <Plus className="size-4 mr-2" />
              Novo Parcelamento
            </Button>
          </div>
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
              <span className="text-sm font-medium">Todos</span>
              <Badge variant="secondary" className="text-xs">
                {statusCounts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {statusCounts.pending}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <PlayCircle className="size-3.5" />
                <span className="text-sm font-medium">Em Andamento</span>
              </div>
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {statusCounts.in_progress}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span className="text-sm font-medium">Concluídos</span>
              </div>
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                {statusCounts.completed}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                <span className="text-sm font-medium">Atrasados</span>
              </div>
              <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                {statusCounts.overdue}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-6 space-y-4">
            {/* Busca */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, cliente, imposto, descrição, protocolo, tags…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtros pílula */}
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
                {
                  label: "Concluir",
                  icon: <CheckCircle2 className="size-3.5" />,
                  tone: "success",
                  onClick: handleBulkComplete,
                  disabled: bulkLoading,
                },
                {
                  label: "Em andamento",
                  icon: <PlayCircle className="size-3.5" />,
                  onClick: handleBulkInProgress,
                  disabled: bulkLoading,
                },
                {
                  label: "Reabrir",
                  icon: <RotateCcw className="size-3.5" />,
                  onClick: handleBulkReopen,
                  disabled: bulkLoading,
                },
                {
                  label: "Excluir",
                  icon: <Trash2 className="size-3.5" />,
                  tone: "destructive",
                  onClick: handleBulkDelete,
                  disabled: bulkLoading,
                },
              ]}
            />

            {/* Mobile: cards (até md) — mesmo padrão de /impostos.
                Em telas pequenas a tabela horizontal fica difícil de ler;
                cards com hierarquia vertical funcionam melhor. */}
            <div className="md:hidden space-y-2">
              {visibleInstallments.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg py-10 px-4 text-center">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                    <CreditCard className="size-5 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-sm">
                    {installments.length === 0
                      ? "Nenhum parcelamento cadastrado"
                      : "Nenhum parcelamento neste filtro"}
                  </p>
                  {installments.length === 0 && (
                    <Button size="sm" onClick={handleNew} className="mt-3">
                      <Plus className="size-3.5 mr-1.5" /> Novo Parcelamento
                    </Button>
                  )}
                </div>
              ) : (
                visibleInstallments.map((i) => {
                  const status = getStatus(i)
                  const dueDate = calculateDueDate(i)
                  const isSelected = selectedIds.has(i.id)
                  return (
                    <div
                      key={i.id}
                      className={`border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                        isSelected
                          ? "bg-primary/5 border-primary/40"
                          : status === "overdue"
                            ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900"
                            : "bg-card"
                      }`}
                      onClick={() => handleView(i)}
                    >
                      <div className="flex items-start gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(i.id)}
                            className="mt-0.5"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{i.name}</span>
                            {i.priority && i.priority !== "medium" && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 px-1.5 ${
                                  i.priority === "urgent"
                                    ? "border-red-500 text-red-700 dark:text-red-400"
                                    : i.priority === "high"
                                      ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                      : "border-blue-500 text-blue-700 dark:text-blue-400"
                                }`}
                              >
                                {i.priority === "urgent" ? "Urgente" : i.priority === "high" ? "Alta" : "Baixa"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(i)}
                      </div>

                      <div className="ml-6 grid grid-cols-2 gap-2 text-xs">
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Cliente:</span>{" "}
                          <span className="font-medium">{getClientName(i.clientId)}</span>
                        </div>
                        {i.taxId && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Imposto:</span>{" "}
                            <span className="font-medium">{getTaxName(i.taxId)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Parcela:</span>{" "}
                          <span className="font-mono font-medium tabular-nums">
                            {i.currentInstallment}/{i.installmentCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vence:</span>{" "}
                          <span className="font-mono font-medium">{formatDate(dueDate)}</span>
                        </div>
                      </div>

                      <div className="ml-6 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {status !== "completed" && (
                          <>
                            {status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStart(i)}
                                className="h-7 text-xs gap-1"
                              >
                                <PlayCircle className="size-3" /> Iniciar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleComplete(i)}
                              className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="size-3" /> Concluir
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(i)}
                          className="h-7 text-xs gap-1"
                        >
                          <Pencil className="size-3" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(i.id)}
                          className="h-7 text-xs gap-1 text-destructive"
                        >
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
                          visibleInstallments.length > 0 &&
                          visibleInstallments.every((i) => selectedIds.has(i.id))
                        }
                        onCheckedChange={(checked) => {
                          if (checked)
                            setSelectedIds(new Set(visibleInstallments.map((i) => i.id)))
                          else clearSelection()
                        }}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <ResizableTableHead defaultWidth={240} storageKey="parc-name">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("name")} className="-ml-3">
                        Parcelamento <ArrowUpDown className="ml-2 size-3" />
                      </Button>
                    </ResizableTableHead>
                    <ResizableTableHead defaultWidth={240} storageKey="parc-client">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("client")} className="-ml-3">
                        Cliente <ArrowUpDown className="ml-2 size-3" />
                      </Button>
                    </ResizableTableHead>
                    <ResizableTableHead defaultWidth={140} storageKey="parc-tax">Imposto</ResizableTableHead>
                    <ResizableTableHead defaultWidth={100} storageKey="parc-num">Parcela</ResizableTableHead>
                    <ResizableTableHead defaultWidth={180} storageKey="parc-due">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("dueDate")} className="-ml-3">
                        Vencimento <ArrowUpDown className="ml-2 size-3" />
                      </Button>
                    </ResizableTableHead>
                    <ResizableTableHead defaultWidth={140} storageKey="parc-status">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort("status")} className="-ml-3">
                        Status <ArrowUpDown className="ml-2 size-3" />
                      </Button>
                    </ResizableTableHead>
                    <ResizableTableHead defaultWidth={180} storageKey="parc-actions">Ações Rápidas</ResizableTableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleInstallments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center gap-2">
                          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-1">
                            <CreditCard className="size-6 text-muted-foreground" />
                          </div>
                          <p className="font-medium">Nenhum parcelamento encontrado</p>
                          <p className="text-sm text-muted-foreground max-w-md">
                            {installments.length === 0
                              ? "Cadastre parcelamentos de impostos (REFIS, parcelamentos especiais, etc)."
                              : statusFilter !== "all"
                                ? `Nenhum parcelamento neste filtro. Total cadastrado: ${installments.length}.`
                                : "Tente ajustar a busca ou os filtros."}
                          </p>
                          {installments.length === 0 && (
                            <Button onClick={handleNew} className="mt-2 gap-2">
                              <Plus className="size-4" /> Novo Parcelamento
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleInstallments.map((i) => {
                      const status = getStatus(i)
                      const dueDate = calculateDueDate(i)
                      const isSelected = selectedIds.has(i.id)
                      return (
                        <TableRow
                          key={i.id}
                          data-state={isSelected ? "selected" : undefined}
                          className={`cursor-pointer ${
                            isSelected
                              ? "bg-primary/5"
                              : status === "overdue"
                                ? "bg-red-50/50 dark:bg-red-950/10"
                                : ""
                          }`}
                          onClick={() => handleView(i)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(i.id)}
                              aria-label={`Selecionar ${i.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium hover:underline">{i.name}</div>
                              {i.priority && i.priority !== "medium" && (
                                <Badge
                                  variant="outline"
                                  className={
                                    i.priority === "urgent"
                                      ? "border-red-500 text-red-700 dark:text-red-400"
                                      : i.priority === "high"
                                        ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                        : "border-blue-500 text-blue-700 dark:text-blue-400"
                                  }
                                >
                                  {i.priority === "urgent" ? "Urgente" : i.priority === "high" ? "Alta" : "Baixa"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getClientName(i.clientId)}</TableCell>
                          <TableCell>{getTaxName(i.taxId)}</TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {i.currentInstallment}/{i.installmentCount}
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm font-medium">{formatDate(dueDate)}</div>
                          </TableCell>
                          <TableCell>{getStatusBadge(i)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {status !== "completed" && (
                              <div className="flex gap-1">
                                {status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStart(i)}
                                    className="h-7 text-xs"
                                  >
                                    <PlayCircle className="size-3 mr-1" />
                                    Iniciar
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleComplete(i)}
                                  className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                  title={`Marcar parcela ${i.currentInstallment}/${i.installmentCount} como paga`}
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
                                <DropdownMenuItem onClick={() => handleView(i)}>
                                  <Eye className="size-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(i)}>
                                  <Pencil className="size-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                {(i.paidInstallments?.length ?? 0) > 0 && (
                                  <DropdownMenuItem onClick={() => handleReopen(i)}>
                                    <RotateCcw className="size-4 mr-2" />
                                    Reabrir
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDelete(i.id)}
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
          </TabsContent>
        </Tabs>
      </div>

      <InstallmentForm
        installment={editing}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={async () => {
          await refreshData()
          setIsFormOpen(false)
        }}
      />

      {viewing && (
        <InstallmentDetails
          installment={viewing}
          clients={clients}
          taxes={taxes}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onEdit={handleEdit}
          onPay={handleComplete}
          onMarkAsSent={async (i) => {
            try {
              const result = markCurrentInstallmentAsSent(i)
              await saveInstallment(result.updated)
              toast.success(`Parcela ${result.sentNumber}/${i.installmentCount} marcada como enviada`)
              await refreshData()
            } catch (e) {
              console.error(e)
              toast.error(e instanceof Error ? e.message : "Erro ao marcar como enviada")
            }
          }}
          onConfirmPayment={async (i, n) => {
            try {
              const result = confirmInstallmentPayment(i, n)
              await saveInstallment(result.updated)
              toast.success(`Pagamento da parcela ${n}/${i.installmentCount} confirmado`)
              await refreshData()
            } catch (e) {
              console.error(e)
              toast.error("Erro ao confirmar pagamento")
            }
          }}
          onUndoLastPayment={async (i) => {
            try {
              await saveInstallment(undoLastSent(i))
              toast.success("Última ação desfeita")
              await refreshData()
            } catch (e) {
              console.error(e)
              toast.error("Erro ao desfazer")
            }
          }}
        />
      )}

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        clients={clients}
        taxes={taxes}
        obligations={obligationsWithDetails}
      />
    </div>
  )
}

