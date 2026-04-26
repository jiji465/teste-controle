"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Calendar as CalendarIcon,
  Receipt,
  FileText,
  CreditCard,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Eye,
  EyeOff,
} from "lucide-react"
import type { Client, Tax, ObligationWithDetails, InstallmentWithDetails } from "@/lib/types"
import { buildSafeDate, isHoliday, isWeekend, calculateDueDateFromCompetency, getHolidayName } from "@/lib/date-utils"
import { useSelectedPeriod } from "@/hooks/use-selected-period"

type CalendarItemKind = "obligation" | "tax" | "installment"

type CalendarItem = {
  id: string
  kind: CalendarItemKind
  name: string
  clientId?: string
  clientName: string
  dueDate: Date
  status: "pending" | "in_progress" | "completed" | "overdue"
  description?: string
  meta?: string
  priority?: "low" | "medium" | "high" | "urgent"
}

type Props = {
  obligations: ObligationWithDetails[]
  taxes?: Tax[]
  installments?: InstallmentWithDetails[]
  clients?: Client[]
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

const KIND_LABEL: Record<CalendarItemKind, string> = {
  obligation: "Obrigação",
  tax: "Imposto",
  installment: "Parcela",
}

const KIND_ICON: Record<CalendarItemKind, React.ReactNode> = {
  obligation: <FileText className="size-3" />,
  tax: <Receipt className="size-3" />,
  installment: <CreditCard className="size-3" />,
}

const KIND_COLOR: Record<CalendarItemKind, string> = {
  obligation: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  tax: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
  installment: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  completed: "bg-green-600 hover:bg-green-700",
  in_progress: "bg-blue-600 hover:bg-blue-700",
  overdue: "bg-red-600 hover:bg-red-700",
  pending: "bg-yellow-500 hover:bg-yellow-600 text-white",
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  overdue: "Atrasada",
}

const formatDate = (d: Date) => d.toLocaleDateString("pt-BR")

export function FiscalCalendar({ obligations, taxes = [], installments = [], clients = [] }: Props) {
  // Calendário lê o período do PeriodSwitcher do topo (?period=YYYY-MM).
  // Sem filtro/all → mostra mês atual.
  const { period, showAll } = useSelectedPeriod()
  const currentDate = useMemo(() => {
    if (period && !showAll) {
      const m = period.match(/^(\d{4})-(\d{2})$/)
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1)
    }
    return new Date()
  }, [period, showAll])

  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [kindFilter, setKindFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showCompleted, setShowCompleted] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Agrega tudo em CalendarItem[]
  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = []

    for (const o of obligations) {
      items.push({
        id: o.id,
        kind: "obligation",
        name: o.name,
        clientId: o.clientId,
        clientName: o.client.name,
        dueDate: new Date(o.calculatedDueDate),
        status: o.status,
        description: o.description,
        meta: o.tax?.name,
        priority: o.priority,
      })
    }

    // Guias de imposto: se tem competência cadastrada, mostra na data exata
    // calculada (competência + 1 mês). Sem competência (modelo genérico),
    // ignoramos no calendário pra não poluir todo mês.
    for (const t of taxes) {
      if (!t.dueDay) continue
      const calc = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule)
      if (!calc) continue
      // Só inclui se cair no mês visualizado
      if (calc.getFullYear() !== year || calc.getMonth() !== month) continue
      items.push({
        id: `tax-${t.id}`,
        kind: "tax",
        name: t.name,
        clientName: "Guia de Imposto",
        dueDate: calc,
        status: t.status,
        description: t.description,
        meta: t.scope ? t.scope.charAt(0).toUpperCase() + t.scope.slice(1) : undefined,
        priority: t.priority,
      })
    }

    for (const i of installments) {
      const firstDue = new Date(i.firstDueDate)
      const monthsToAdd = i.currentInstallment - 1
      const date = buildSafeDate(
        firstDue.getFullYear(),
        firstDue.getMonth() + monthsToAdd,
        i.dueDay,
      )
      items.push({
        id: i.id,
        kind: "installment",
        name: i.name,
        clientId: i.clientId,
        clientName: i.client.name,
        dueDate: date,
        status: i.status,
        description: i.description,
        meta: `Parcela ${i.currentInstallment}/${i.installmentCount}`,
        priority: i.priority,
      })
    }

    return items
  }, [obligations, taxes, installments, year, month])

  // Aplica filtros
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // "Esconder concluídas" só vale quando não há filtro explícito de status
      if (!showCompleted && statusFilter === "all" && item.status === "completed") return false
      if (clientFilter !== "all" && item.clientId !== clientFilter) return false
      if (kindFilter !== "all" && item.kind !== kindFilter) return false
      if (statusFilter !== "all" && item.status !== statusFilter) return false
      return true
    })
  }, [allItems, clientFilter, kindFilter, statusFilter, showCompleted])

  // Agrupa por dia
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const it of filteredItems) {
      const k = dayKey(it.dueDate)
      const arr = map.get(k) ?? []
      arr.push(it)
      map.set(k, arr)
    }
    // Ordena dentro de cada dia: atrasada > pendente > em andamento > concluída; depois por prioridade
    const statusOrder: Record<string, number> = { overdue: 0, pending: 1, in_progress: 2, completed: 3 }
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    map.forEach((arr) => {
      arr.sort((a, b) => {
        const s = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
        if (s !== 0) return s
        return (priorityOrder[a.priority ?? "medium"] ?? 9) - (priorityOrder[b.priority ?? "medium"] ?? 9)
      })
    })
    return map
  }, [filteredItems])

  // Grade do mês (com offset de domingo)
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const list: Array<Date | null> = []
    for (let i = 0; i < firstDay.getDay(); i++) list.push(null)
    for (let i = 1; i <= lastDay.getDate(); i++) list.push(new Date(year, month, i))
    return list
  }, [year, month])

  const monthName = currentDate.toLocaleString("pt-BR", { month: "long" })
  const today = new Date()

  const totalThisMonth = useMemo(
    () => filteredItems.filter((i) => i.dueDate.getMonth() === month && i.dueDate.getFullYear() === year).length,
    [filteredItems, month, year],
  )
  const overdueThisMonth = useMemo(
    () =>
      filteredItems.filter(
        (i) =>
          i.dueDate.getMonth() === month &&
          i.dueDate.getFullYear() === year &&
          i.status !== "completed" &&
          i.dueDate < today,
      ).length,
    [filteredItems, month, year, today],
  )

  const selectedDayItems = selectedDay ? itemsByDay.get(dayKey(selectedDay)) ?? [] : []

  // Para cada item, monta o link de detalhes na página correspondente.
  const detailsHref = (it: CalendarItem): string => {
    if (it.kind === "obligation") {
      const params = new URLSearchParams()
      if (it.clientId) params.set("clientId", it.clientId)
      const qs = params.toString()
      return `/obrigacoes${qs ? `?${qs}` : ""}`
    }
    if (it.kind === "installment") {
      const params = new URLSearchParams()
      if (it.clientId) params.set("clientId", it.clientId)
      const qs = params.toString()
      return `/parcelamentos${qs ? `?${qs}` : ""}`
    }
    return "/impostos"
  }

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar: navegação + filtros + hoje */}
        <Card className="border-none shadow-none bg-muted/30">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="px-3 min-w-[160px]">
                <p className="text-sm font-bold capitalize">{monthName} {year}</p>
                <p className="text-[11px] text-muted-foreground">
                  {totalThisMonth} vencimento{totalThisMonth !== 1 ? "s" : ""}
                  {overdueThisMonth > 0 && <span className="text-red-600"> · {overdueThisMonth} atrasado(s)</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 ml-auto">
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="obligation">Obrigações</SelectItem>
                  <SelectItem value="tax">Impostos</SelectItem>
                  <SelectItem value="installment">Parcelamentos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="overdue">Atrasada</SelectItem>
                </SelectContent>
              </Select>

              {clients.length > 0 && (
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-9 w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.tradeName ?? c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant={showCompleted ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCompleted((s) => !s)}
                className="h-9 gap-2"
                title={showCompleted ? "Concluídas estão visíveis — clique para esconder" : "Concluídas estão escondidas — clique para mostrar"}
              >
                {showCompleted ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {showCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Grid do calendário */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="size-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base capitalize">{monthName} {year}</CardTitle>
                <CardDescription className="text-xs">Clique em um dia para ver todos os vencimentos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
                <div key={d} className={`py-2 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground ${i === 0 || i === 6 ? "bg-muted/40" : ""}`}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-border/50">
              {days.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="bg-muted/10 min-h-[110px]" />

                const items = itemsByDay.get(dayKey(day)) ?? []
                const isToday = sameDay(today, day)
                const weekend = isWeekend(day)
                const holiday = isHoliday(day)
                const dayHasOverdue = items.some((i) => i.status !== "completed" && i.dueDate < today)

                return (
                  <button
                    type="button"
                    key={dayKey(day)}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[110px] p-2 text-left transition-colors hover:bg-primary/5 group cursor-pointer
                      ${isToday ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}
                      ${weekend && !isToday ? "bg-muted/20" : ""}
                      ${holiday && !isToday ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-sm font-bold size-6 flex items-center justify-center rounded-full
                          ${isToday ? "bg-primary text-primary-foreground" : holiday ? "text-orange-600 dark:text-orange-400" : weekend ? "text-muted-foreground" : "text-foreground"}
                        `}
                      >
                        {day.getDate()}
                      </span>
                      <div className="flex items-center gap-1">
                        {dayHasOverdue && <AlertTriangle className="size-3 text-red-600" />}
                        {items.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1.5">
                            {items.length}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {holiday && (
                      <p
                        className="text-[10px] text-orange-600 dark:text-orange-400 font-medium truncate"
                        title={getHolidayName(day) ?? "Feriado"}
                      >
                        🎉 {getHolidayName(day)}
                      </p>
                    )}

                    <div className="space-y-1">
                      {items.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 truncate
                            ${it.status === "completed" ? "opacity-60" : ""}
                            ${KIND_COLOR[it.kind]}
                          `}
                        >
                          {KIND_ICON[it.kind]}
                          <span className="truncate font-medium">{it.name}</span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-center text-muted-foreground font-medium">
                          + {items.length - 3} mais (clique)
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Legenda */}
        <Card className="border-dashed">
          <CardContent className="p-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Legenda</span>
            <span className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded border ${KIND_COLOR.obligation} flex items-center gap-1`}>
                {KIND_ICON.obligation} Obrigação
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded border ${KIND_COLOR.tax} flex items-center gap-1`}>
                {KIND_ICON.tax} Imposto
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded border ${KIND_COLOR.installment} flex items-center gap-1`}>
                {KIND_ICON.installment} Parcela
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-3 rounded bg-muted/40 inline-block" /> Fim de semana
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-3 rounded bg-orange-50 border border-orange-200 inline-block" /> Feriado
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="size-3 text-red-600" /> Dia com atraso
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Dialog do dia */}
      <Dialog open={selectedDay !== null} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <div className="px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarCheck className="size-5 text-primary" />
                {selectedDay && formatDate(selectedDay)}
                {selectedDay && isHoliday(selectedDay) && (
                  <Badge
                    variant="outline"
                    className="text-orange-600 border-orange-200 dark:border-orange-900"
                  >
                    🎉 {getHolidayName(selectedDay)}
                  </Badge>
                )}
                {selectedDay && isWeekend(selectedDay) && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {selectedDay.getDay() === 0 ? "Domingo" : "Sábado"}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedDayItems.length === 0
                  ? "Nenhum vencimento neste dia"
                  : `${selectedDayItems.length} vencimento${selectedDayItems.length > 1 ? "s" : ""} no dia`}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            {(["obligation", "tax", "installment"] as CalendarItemKind[]).map((kind) => {
              const group = selectedDayItems.filter((i) => i.kind === kind)
              if (group.length === 0) return null
              return (
                <section key={kind} className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    {KIND_ICON[kind]} {KIND_LABEL[kind]}s ({group.length})
                  </h4>
                  <div className="space-y-2">
                    {group.map((it) => (
                      <Link
                        key={it.id}
                        href={detailsHref(it)}
                        onClick={() => setSelectedDay(null)}
                        className="block border rounded-lg p-3 hover:border-primary/60 hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-semibold text-sm group-hover:text-primary transition-colors">{it.name}</h5>
                              {it.priority && it.priority !== "medium" && (
                                <Badge variant="outline" className="text-[10px] h-4 py-0 px-1.5">
                                  {it.priority === "urgent" ? "Urgente" : it.priority === "high" ? "Alta" : "Baixa"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{it.clientName}</p>
                            {it.meta && <p className="text-xs text-muted-foreground">{it.meta}</p>}
                            {it.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-1.5 group-hover:text-primary transition-colors">
                              Ver detalhes →
                            </p>
                          </div>
                          <Badge className={STATUS_BADGE_CLASS[it.status] ?? ""}>
                            {it.status === "completed" && <CheckCircle2 className="size-3 mr-1" />}
                            {it.status === "in_progress" && <PlayCircle className="size-3 mr-1" />}
                            {it.status === "overdue" && <AlertTriangle className="size-3 mr-1" />}
                            {it.status === "pending" && <Clock className="size-3 mr-1" />}
                            {STATUS_LABEL[it.status]}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
