"use client"

/**
 * Página de Parcelamentos — reescrita do zero (commit pós-bugs acumulados).
 *
 * Modelo conceitual:
 *   1 parcelamento = 1 registro no banco com contador interno.
 *   Cada parcela individual passa por 2 eventos independentes:
 *     - sentAt: você gerou a guia e mandou ao cliente
 *     - paidAt: cliente confirmou o pagamento
 *   Status do parcelamento como um todo é DERIVADO automaticamente
 *   dos records (paidInstallments[]). O usuário não precisa setar
 *   "in_progress" manualmente — quem tem parcela enviada esperando
 *   pagamento já é "Aguardando pagamento".
 *
 *   currentInstallment = próxima parcela A ENVIAR.
 *
 *   As datas das demais parcelas são fixas (firstDueDate + N meses).
 *   Cliente atrasar uma parcela NÃO empurra cronograma — Cenário A.
 *
 * Decisões de UX que diferem das versões anteriores:
 *   - Filtro de status feito com botões puros (não Radix Tabs) — Radix
 *     com TabsList "isolada" sem TabsContent não disparava onValueChange
 *     em alguns navegadores.
 *   - Sem split mobile/desktop — tabela responsiva única.
 *   - Sem ações em lote complexas (edição em lote, "iniciar", etc.) —
 *     foco no fluxo "marcar enviada" + "confirmar pagamento" + excluir.
 */

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ExportButton } from "@/components/export-button"
import type { ExportColumn } from "@/lib/export-utils"
import { InstallmentForm } from "@/features/installments/components/installment-form"
import { InstallmentDetails } from "@/features/installments/components/installment-details"
import { GlobalSearch } from "@/components/global-search"
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
  Send,
  Eye,
  MoreVertical,
  CreditCard,
  ArrowUpDown,
  RotateCcw,
  Calendar as CalendarIcon,
  Building2,
  X,
} from "lucide-react"
import { formatDate, adjustForWeekend, buildSafeDate } from "@/lib/date-utils"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { toast } from "sonner"

type FilterStatus = "all" | "pending" | "sent" | "overdue" | "completed"

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: "Todos",
  pending: "Pendentes",
  sent: "Aguardando pgto",
  overdue: "Atrasados",
  completed: "Concluídos",
}

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
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "client" | "dueDate">("dueDate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const [editing, setEditing] = useState<Installment | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewing, setViewing] = useState<Installment | undefined>()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  // ─── Helpers de cálculo ──────────────────────────────────────────────────

  /** Vencimento de uma parcela específica (1..N). */
  const dueDateFor = (inst: Installment, n: number): Date => {
    const firstDue = new Date(inst.firstDueDate)
    const date = buildSafeDate(
      firstDue.getFullYear(),
      firstDue.getMonth() + (n - 1),
      inst.dueDay,
    )
    return adjustForWeekend(date, inst.weekendRule)
  }

  /** Vencimento da parcela atual (próxima a enviar). */
  const currentDueDate = (inst: Installment): Date =>
    dueDateFor(inst, inst.currentInstallment)

  /** Status efetivo do parcelamento como um todo, derivado dos records. */
  const computeStatus = (inst: Installment): FilterStatus => {
    const records = inst.paidInstallments ?? []
    const allPaid =
      records.length === inst.installmentCount &&
      records.every((r) => !!r.paidAt)
    if (inst.status === "completed" || allPaid) return "completed"

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Tem alguma parcela enviada vencida sem pagamento → atrasada
    for (const r of records) {
      if (r.sentAt && !r.paidAt) {
        const due = dueDateFor(inst, r.number)
        if (due < today) return "overdue"
      }
    }

    // Tem alguma enviada aguardando pagamento → "sent" (em andamento)
    if (records.some((r) => r.sentAt && !r.paidAt)) return "sent"

    return "pending"
  }

  // ─── Listas computadas ───────────────────────────────────────────────────

  /** Cada parcelamento + seu status + sua próxima data — calculado uma vez. */
  const enriched = useMemo(() => {
    return installments.map((inst) => ({
      inst,
      status: computeStatus(inst),
      dueDate: currentDueDate(inst),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments])

  /** Stats por status (filtrado pelo período global do PeriodSwitcher). */
  const statusCounts = useMemo(() => {
    const inPeriod = enriched.filter(({ dueDate }) => isInPeriod(dueDate))
    return {
      all: inPeriod.length,
      pending: inPeriod.filter((x) => x.status === "pending").length,
      sent: inPeriod.filter((x) => x.status === "sent").length,
      overdue: inPeriod.filter((x) => x.status === "overdue").length,
      completed: inPeriod.filter((x) => x.status === "completed").length,
    }
  }, [enriched, isInPeriod])

  /** Lista filtrada e ordenada que vai pra tabela. */
  const filtered = useMemo(() => {
    const result = enriched.filter(({ inst, dueDate, status }) => {
      // Período global (PeriodSwitcher do topo)
      if (!isInPeriod(dueDate)) return false
      // Status
      if (statusFilter !== "all" && status !== statusFilter) return false
      // Cliente
      if (clientFilter !== "all" && inst.clientId !== clientFilter) return false
      // Busca textual
      const q = searchTerm.trim()
      if (q) {
        const clientName =
          clients.find((c) => c.id === inst.clientId)?.name ?? ""
        const taxName = inst.taxId
          ? taxes.find((t) => t.id === inst.taxId)?.name ?? ""
          : ""
        const hit =
          matchesText(inst.name, q) ||
          matchesText(clientName, q) ||
          matchesText(taxName, q) ||
          matchesText(inst.description, q) ||
          matchesText(inst.protocol, q) ||
          matchesText(inst.notes, q) ||
          (inst.tags ?? []).some((t) => matchesText(t, q))
        if (!hit) return false
      }
      return true
    })

    result.sort((a, b) => {
      let cmp = 0
      if (sortBy === "name") {
        cmp = a.inst.name.localeCompare(b.inst.name, "pt-BR")
      } else if (sortBy === "client") {
        const an = clients.find((c) => c.id === a.inst.clientId)?.name ?? ""
        const bn = clients.find((c) => c.id === b.inst.clientId)?.name ?? ""
        cmp = an.localeCompare(bn, "pt-BR")
      } else if (sortBy === "dueDate") {
        cmp = a.dueDate.getTime() - b.dueDate.getTime()
      }
      return sortOrder === "asc" ? cmp : -cmp
    })

    return result
  }, [
    enriched,
    statusFilter,
    clientFilter,
    searchTerm,
    sortBy,
    sortOrder,
    clients,
    taxes,
    isInPeriod,
  ])

  // ─── Ações de pagamento ──────────────────────────────────────────────────

  const handleMarkAsSent = async (inst: Installment) => {
    try {
      const result = markCurrentInstallmentAsSent(inst)
      await saveInstallment(result.updated)
      toast.success(
        `Parcela ${result.sentNumber}/${inst.installmentCount} marcada como enviada`,
      )
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] mark-as-sent error:", e)
      toast.error("Erro ao marcar como enviada")
    }
  }

  const handleConfirmPayment = async (inst: Installment, parcelNumber: number) => {
    try {
      const result = confirmInstallmentPayment(inst, parcelNumber)
      await saveInstallment(result.updated)
      toast.success(
        result.isFullyPaid
          ? `Parcela ${parcelNumber}/${inst.installmentCount} paga — parcelamento concluído!`
          : `Pagamento da parcela ${parcelNumber}/${inst.installmentCount} confirmado`,
      )
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] confirm-payment error:", e)
      toast.error("Erro ao confirmar pagamento")
    }
  }

  /** Atalho 1-clique: marca enviada + paga. Pra quem confia que cliente já pagou. */
  const handlePay = async (inst: Installment) => {
    try {
      const result = payCurrentInstallment(inst)
      await saveInstallment(result.updated)
      toast.success(
        result.isFinalPayment
          ? `Parcela ${result.paidNumber}/${inst.installmentCount} paga — parcelamento concluído!`
          : `Parcela ${result.paidNumber}/${inst.installmentCount} paga (atalho)`,
      )
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] pay error:", e)
      toast.error("Erro ao registrar pagamento")
    }
  }

  const handleUndo = async (inst: Installment) => {
    try {
      const updated = undoLastSent(inst)
      await saveInstallment(updated)
      toast.success("Última ação desfeita")
      await refreshData()
    } catch (e) {
      console.error("[parcelamentos] undo error:", e)
      toast.error("Erro ao desfazer")
    }
  }

  // ─── Ações de CRUD ───────────────────────────────────────────────────────

  const handleEdit = (inst: Installment) => {
    setEditing(inst)
    setIsFormOpen(true)
  }

  const handleNew = () => {
    setEditing(undefined)
    setIsFormOpen(true)
  }

  const handleView = (inst: Installment) => {
    setViewing(inst)
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

  // ─── Ações em lote ──────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

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
          await Promise.all(
            Array.from(selectedIds).map((id) => deleteInstallment(id)),
          )
          toast.success(`${selectedIds.size} parcelamentos excluídos`)
          clearSelection()
          await refreshData()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkMarkAsSent = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Marcar ${selectedIds.size} parcelas como enviadas`,
      description:
        "Marca a parcela atual de cada parcelamento selecionado como enviada ao cliente.",
      confirmLabel: "Marcar enviadas",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = installments.filter(
            (i) =>
              selectedIds.has(i.id) &&
              i.status !== "completed" &&
              i.currentInstallment <= i.installmentCount,
          )
          await Promise.all(
            targets.map((i) => {
              const result = markCurrentInstallmentAsSent(i)
              return saveInstallment(result.updated)
            }),
          )
          toast.success(`${targets.length} parcelas marcadas como enviadas`)
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
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Mantém o card de detalhes sincronizado quando a lista atualiza (após
  // pagar parcela, marcar enviada, etc.) — o usuário pode pagar várias em
  // sequência sem precisar fechar/reabrir o card.
  useEffect(() => {
    if (!viewing) return
    const fresh = installments.find((i) => i.id === viewing.id)
    if (fresh && fresh !== viewing) setViewing(fresh)
  }, [installments, viewing])

  // Atalho ⌘K pra busca global
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

  // ─── Export ─────────────────────────────────────────────────────────────

  const exportColumns: ExportColumn<Installment>[] = [
    { header: "Nome", width: 28, accessor: (i) => i.name },
    {
      header: "Cliente",
      width: 28,
      accessor: (i) => clients.find((c) => c.id === i.clientId)?.name ?? "",
    },
    {
      header: "Imposto",
      width: 18,
      accessor: (i) =>
        i.taxId ? taxes.find((t) => t.id === i.taxId)?.name ?? "" : "",
    },
    {
      header: "Parcela",
      width: 12,
      accessor: (i) => `${i.currentInstallment}/${i.installmentCount}`,
    },
    {
      header: "1º vencimento",
      width: 14,
      accessor: (i) => new Date(i.firstDueDate),
    },
    { header: "Próx. venc.", width: 14, accessor: (i) => currentDueDate(i) },
    {
      header: "Status",
      width: 14,
      accessor: (i) => STATUS_LABELS[computeStatus(i)],
    },
  ]

  const hasActiveFilters =
    statusFilter !== "all" || clientFilter !== "all" || searchTerm.trim().length > 0

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
              Gerencie parcelamentos de impostos. Cada parcela tem 2 etapas: marcar
              como enviada e confirmar pagamento.
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
              rows={filtered.map((x) => x.inst)}
            />
            <Button onClick={handleNew}>
              <Plus className="size-4 mr-2" />
              Novo Parcelamento
            </Button>
          </div>
        </div>

        {/* Filtros de status — botões puros, sem Radix */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(["all", "pending", "sent", "overdue", "completed"] as const).map((s) => {
            const isActive = statusFilter === s
            const count = statusCounts[s]
            const icon =
              s === "pending" ? <Clock className="size-3.5" />
              : s === "sent" ? <Send className="size-3.5" />
              : s === "overdue" ? <AlertTriangle className="size-3.5" />
              : s === "completed" ? <CheckCircle2 className="size-3.5" />
              : null
            const inactiveColor =
              s === "overdue" && count > 0 ? "text-red-700 dark:text-red-400"
              : s === "sent" && count > 0 ? "text-blue-700 dark:text-blue-400"
              : s === "completed" && count > 0 ? "text-green-700 dark:text-green-400"
              : ""
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : `bg-card hover:bg-muted ${inactiveColor}`
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {icon}
                  <span className="truncate">{STATUS_LABELS[s]}</span>
                </span>
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className="tabular-nums shrink-0"
                >
                  {count}
                </Badge>
              </button>
            )
          })}
        </div>

        {/* Busca + filtro de cliente */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Nome, cliente, imposto, descrição, protocolo, tags…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
                aria-label="Limpar busca"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[220px]">
              <Building2 className="size-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all")
                setClientFilter("all")
                setSearchTerm("")
              }}
              className="gap-1"
            >
              <X className="size-3.5" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Bulk bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/30 rounded-lg flex-wrap">
            <span className="text-sm font-medium">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Limpar seleção
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkMarkAsSent}
              disabled={bulkLoading}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Marcar enviadas
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Excluir
            </Button>
          </div>
        )}

        {/* Tabela */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      filtered.length > 0 &&
                      filtered.every((x) => selectedIds.has(x.inst.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked)
                        setSelectedIds(new Set(filtered.map((x) => x.inst.id)))
                      else clearSelection()
                    }}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("name")}
                    className="-ml-3"
                  >
                    Parcelamento
                    <ArrowUpDown className="ml-2 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("client")}
                    className="-ml-3"
                  >
                    Cliente
                    <ArrowUpDown className="ml-2 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-[100px] text-center">Parcela</TableHead>
                <TableHead className="w-[140px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("dueDate")}
                    className="-ml-3"
                  >
                    Vencimento
                    <ArrowUpDown className="ml-2 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
                <TableHead className="min-w-[280px]">Ações rápidas</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    {installments.length === 0 ? (
                      <EmptyState
                        title="Nenhum parcelamento cadastrado"
                        description="Cadastre parcelamentos de impostos (REFIS, parcelamentos especiais, etc)."
                        action={
                          <Button onClick={handleNew} className="mt-2 gap-2">
                            <Plus className="size-4" /> Novo Parcelamento
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        title={
                          statusFilter !== "all"
                            ? `Nenhum parcelamento ${
                                statusFilter === "pending" ? "pendente" :
                                statusFilter === "sent" ? "aguardando pagamento" :
                                statusFilter === "completed" ? "concluído" :
                                statusFilter === "overdue" ? "atrasado" : ""
                              } neste filtro`
                            : "Nenhum resultado pra esses filtros"
                        }
                        description={`Total cadastrado: ${installments.length}.`}
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStatusFilter("all")
                              setClientFilter("all")
                              setSearchTerm("")
                            }}
                          >
                            Ver todos
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(({ inst, status, dueDate }) => {
                  const client = clients.find((c) => c.id === inst.clientId)
                  const isSelected = selectedIds.has(inst.id)
                  const records = inst.paidInstallments ?? []
                  const oldestUnpaid = [...records]
                    .filter((r) => r.sentAt && !r.paidAt)
                    .sort((a, b) => a.number - b.number)[0]
                  const currentRecord = records.find(
                    (r) => r.number === inst.currentInstallment,
                  )
                  const canSendNext =
                    status !== "completed" &&
                    inst.currentInstallment <= inst.installmentCount &&
                    !currentRecord?.sentAt

                  return (
                    <TableRow
                      key={inst.id}
                      data-state={isSelected ? "selected" : undefined}
                      className={`cursor-pointer ${
                        isSelected
                          ? "bg-primary/5"
                          : status === "overdue"
                            ? "bg-red-50/50 dark:bg-red-950/10"
                            : ""
                      }`}
                      onClick={() => handleView(inst)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(inst.id)}
                          aria-label={`Selecionar ${inst.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium hover:underline">
                          {inst.name}
                        </div>
                        {inst.priority && inst.priority !== "medium" && (
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[10px] ${
                              inst.priority === "urgent"
                                ? "border-red-500 text-red-700 dark:text-red-400"
                                : inst.priority === "high"
                                  ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                  : "border-blue-500 text-blue-700 dark:text-blue-400"
                            }`}
                          >
                            {inst.priority === "urgent"
                              ? "Urgente"
                              : inst.priority === "high"
                                ? "Alta"
                                : "Baixa"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {client?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums">
                        {inst.currentInstallment}/{inst.installmentCount}
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {formatDate(dueDate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {oldestUnpaid && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                handleConfirmPayment(inst, oldestUnpaid.number)
                              }
                              className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                              title={`Confirmar pagamento da parcela ${oldestUnpaid.number}/${inst.installmentCount}`}
                            >
                              <CheckCircle2 className="size-3" />
                              Confirmar pgto {oldestUnpaid.number}/{inst.installmentCount}
                            </Button>
                          )}
                          {canSendNext && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsSent(inst)}
                              className="h-7 text-xs gap-1 border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                              title={`Marcar parcela ${inst.currentInstallment}/${inst.installmentCount} como enviada`}
                            >
                              <Send className="size-3" />
                              Marcar {inst.currentInstallment}/{inst.installmentCount} enviada
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(inst)}>
                              <Eye className="size-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(inst)}>
                              <Pencil className="size-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {records.length > 0 && (
                              <DropdownMenuItem onClick={() => handleUndo(inst)}>
                                <RotateCcw className="size-4 mr-2" />
                                Desfazer último envio
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(inst.id)}
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
          onPay={handlePay}
          onMarkAsSent={handleMarkAsSent}
          onConfirmPayment={handleConfirmPayment}
          onUndoLastPayment={handleUndo}
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

// ─── Subcomponentes ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FilterStatus }) {
  if (status === "completed")
    return (
      <Badge className="bg-green-600 hover:bg-green-700 text-white">
        <CheckCircle2 className="size-3 mr-1" /> Concluído
      </Badge>
    )
  if (status === "overdue")
    return (
      <Badge variant="destructive">
        <AlertTriangle className="size-3 mr-1" /> Atrasado
      </Badge>
    )
  if (status === "sent")
    return (
      <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
        <Send className="size-3 mr-1" /> Aguardando pgto
      </Badge>
    )
  return (
    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
      <Clock className="size-3 mr-1" /> Pendente
    </Badge>
  )
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <CreditCard className="size-12 text-muted-foreground/40" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      {action}
    </div>
  )
}
