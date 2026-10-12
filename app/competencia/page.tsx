"use client"

/**
 * Painel da competência — o "check-list do mês" do escritório.
 *
 * Linhas = empresas; colunas = obrigações e guias da competência selecionada
 * no topo. Cada célula mostra o status (concluída / em andamento / pendente /
 * atrasada) e, com um clique, conclui o item. É a visão que responde "o que
 * falta pra fechar o mês?" — e alimenta o fechamento de competência.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2, Clock, PlayCircle, AlertTriangle, Grid3x3, Lock, Search, Minus } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatFilterBar } from "@/components/stat-filter-bar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/contexts/data-context"
import { useAuth } from "@/contexts/auth-context"
import { useSelectedPeriod } from "@/contexts/period-context"
import { saveObligation, saveTax } from "@/lib/supabase/database"
import { checkAndGenerateRecurrences } from "@/lib/auto-recurrence"
import { calculateDueDateFromCompetency, formatDate } from "@/lib/date-utils"
import { effectiveStatus } from "@/lib/obligation-status"
import { getCurrentPeriod } from "@/lib/recurrence-engine"
import { cn, errorMessage, matchesText } from "@/lib/utils"
import type { ObligationWithDetails, Tax } from "@/lib/types"

type CellStatus = "completed" | "in_progress" | "pending" | "overdue"

type Cell = {
  key: string
  kind: "obligation" | "tax"
  name: string
  status: CellStatus
  dueDate?: string
  obligation?: ObligationWithDetails
  tax?: Tax
}

type Row = { clientId: string; clientName: string; cells: Map<string, Cell[]>; done: number; total: number }

const STATUS_META: Record<CellStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  completed: { icon: CheckCircle2, className: "bg-success/10 text-success border-success/30", label: "Concluída" },
  in_progress: { icon: PlayCircle, className: "bg-info/10 text-info border-info/30", label: "Em andamento" },
  pending: { icon: Clock, className: "bg-warning/10 text-warning border-warning/30", label: "Pendente" },
  overdue: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/30", label: "Atrasada" },
}

type Filter = "all" | "open" | "overdue" | "done"

export default function CompetenciaPage() {
  const { obligationsWithDetails, taxes, clients, isLoading, refreshData, isPeriodLocked } = useData()
  const { isViewer, userName } = useAuth()
  const { period, showAll, periodLabel } = useSelectedPeriod()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // "Todos os meses" não faz sentido numa matriz mensal → usa o mês atual.
  const comp = showAll || !/^\d{4}-\d{2}$/.test(period) ? getCurrentPeriod() : period
  const locked = isPeriodLocked(comp)
  const canEdit = !isViewer && !locked

  const { rows, columns, totals } = useMemo(() => {
    const clientName = new Map(clients.map((c) => [c.id, c.name]))
    const cells: Cell[] = []

    for (const o of obligationsWithDetails) {
      if ((o.competencyMonth ?? "").slice(0, 7) !== comp) continue
      cells.push({
        key: `o-${o.id}`,
        kind: "obligation",
        name: o.name,
        status: effectiveStatus(o) as CellStatus,
        dueDate: o.calculatedDueDate,
        obligation: o,
      })
    }
    for (const t of taxes) {
      if ((t.competencyMonth ?? "").slice(0, 7) !== comp || !t.clientId) continue
      const due = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      cells.push({
        key: `t-${t.id}`,
        kind: "tax",
        name: t.name,
        status: effectiveStatus({ status: t.status, calculatedDueDate: due ?? undefined }) as CellStatus,
        dueDate: due?.toISOString(),
        tax: t,
      })
    }

    const byClient = new Map<string, Row>()
    const colCount = new Map<string, number>()
    for (const c of cells) {
      const clientId = c.obligation?.clientId ?? c.tax?.clientId ?? ""
      if (!clientId) continue
      let row = byClient.get(clientId)
      if (!row) {
        row = { clientId, clientName: clientName.get(clientId) ?? "—", cells: new Map(), done: 0, total: 0 }
        byClient.set(clientId, row)
      }
      const list = row.cells.get(c.name) ?? []
      list.push(c)
      row.cells.set(c.name, list)
      row.total++
      if (c.status === "completed") row.done++
      colCount.set(c.name, (colCount.get(c.name) ?? 0) + 1)
    }

    // Colunas mais comuns primeiro (DAS, PGDAS-D… antes das raras)
    const columns = [...colCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n)
    const rows = [...byClient.values()].sort((a, b) => a.clientName.localeCompare(b.clientName))
    const totals = {
      all: cells.length,
      done: cells.filter((c) => c.status === "completed").length,
      overdue: cells.filter((c) => c.status === "overdue").length,
    }
    return { rows, columns, totals }
  }, [obligationsWithDetails, taxes, clients, comp])

  const visibleRows = useMemo(
    () =>
      rows.filter((r) => {
        if (search && !matchesText(r.clientName, search)) return false
        const statuses = [...r.cells.values()].flat().map((c) => c.status)
        if (filter === "open") return statuses.some((s) => s !== "completed")
        if (filter === "overdue") return statuses.includes("overdue")
        if (filter === "done") return statuses.length > 0 && statuses.every((s) => s === "completed")
        return true
      }),
    [rows, search, filter],
  )

  const completeCell = async (cell: Cell) => {
    if (!canEdit || cell.status === "completed") return
    setBusyKey(cell.key)
    const now = new Date().toISOString()
    try {
      if (cell.obligation) {
        const o = cell.obligation
        await saveObligation({
          ...o,
          status: "completed",
          completedAt: now,
          completedBy: userName,
          history: [
            ...(o.history || []),
            { id: crypto.randomUUID(), action: "completed", description: "Concluída pelo Painel do mês", timestamp: now, user: userName },
          ],
        })
      } else if (cell.tax) {
        await saveTax({ ...cell.tax, status: "completed", completedAt: now, completedBy: userName })
      }
      checkAndGenerateRecurrences(true).catch(() => {})
      toast.success(`${cell.name} concluída`)
      await refreshData()
    } catch (e) {
      toast.error(errorMessage(e, "Erro ao concluir"))
    } finally {
      setBusyKey(null)
    }
  }

  const pct = totals.all ? Math.round((totals.done / totals.all) * 100) : 0
  const openRows = rows.filter((r) => r.done < r.total).length

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={Grid3x3}
          title="Painel do mês"
          description={`Check-list da competência — ${pct}% concluído. Clique numa célula pendente para concluir.`}
          badge={
            <Badge variant="outline" className="gap-1 capitalize">
              {locked && <Lock className="size-3" />}
              {showAll ? "Mês atual" : periodLabel ?? comp}
            </Badge>
          }
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa…"
            className="pl-8"
            aria-label="Buscar empresa"
          />
        </div>
      </div>

      <StatFilterBar
        value={filter}
        onChange={(v) => setFilter((v || "all") as Filter)}
        items={[
          { value: "all", label: "Itens do mês", count: totals.all, icon: Grid3x3, tone: "neutral" },
          { value: "open", label: "Com pendência", count: openRows, icon: Clock, tone: "warning" },
          { value: "overdue", label: "Atrasados", count: totals.overdue, icon: AlertTriangle, tone: "danger" },
          { value: "done", label: "Empresas em dia", count: rows.length - openRows, icon: CheckCircle2, tone: "success" },
        ]}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma obrigação ou guia com competência {periodLabel ?? comp}.{" "}
          <Link href="/templates" className="underline underline-offset-2 hover:text-foreground">
            Aplique um template
          </Link>{" "}
          às empresas para gerar o check-list do mês.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-[200px] border-b bg-card px-3 py-2 text-left text-xs font-semibold">
                    Empresa
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="sticky top-0 z-10 border-b bg-card px-2 py-2 text-center text-[11px] font-semibold whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 border-b bg-card px-3 py-2 text-right text-xs font-semibold">Progresso</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.clientId} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[260px] truncate border-b bg-card px-3 py-1.5 text-left font-medium group-hover:bg-muted"
                    >
                      <Link href={`/obrigacoes?clientId=${row.clientId}`} className="hover:underline">
                        {row.clientName}
                      </Link>
                    </th>
                    {columns.map((col) => {
                      const list = row.cells.get(col)
                      return (
                        <td key={col} className="border-b px-1 py-1 text-center group-hover:bg-muted/40">
                          {!list ? (
                            <Minus className="mx-auto size-3 text-muted-foreground/40" aria-label="Não se aplica" />
                          ) : (
                            <div className="flex justify-center gap-1">
                              {list.map((cell) => {
                                const meta = STATUS_META[cell.status]
                                const Icon = meta.icon
                                const clickable = canEdit && cell.status !== "completed"
                                return (
                                  <Tooltip key={cell.key}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={!clickable || busyKey === cell.key}
                                        onClick={() => completeCell(cell)}
                                        aria-label={`${row.clientName} — ${cell.name}: ${meta.label}${clickable ? ". Clique para concluir" : ""}`}
                                        className={cn(
                                          "grid size-7 place-items-center rounded-md border transition-colors",
                                          meta.className,
                                          clickable ? "cursor-pointer hover:ring-2 hover:ring-gold/60" : "cursor-default",
                                          busyKey === cell.key && "animate-pulse",
                                        )}
                                      >
                                        <Icon className="size-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="font-medium">{cell.name}</p>
                                      <p className="text-xs opacity-80">
                                        {meta.label}
                                        {cell.dueDate ? ` · vence ${formatDate(cell.dueDate)}` : ""}
                                      </p>
                                      {clickable && <p className="text-xs opacity-80">Clique para concluir</p>}
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              })}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground group-hover:bg-muted/40">
                      {row.done}/{row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
