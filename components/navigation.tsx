"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LayoutDashboard, FileText, Calendar, Receipt, Menu, X, BarChart3, Bell, CreditCard, Building2, Layers, AlertTriangle, Clock, ArrowRight, RefreshCw, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { isOverdue, formatDate, calculateDueDateFromCompetency, buildSafeDate, adjustForWeekend } from "@/lib/date-utils"
import { useData } from "@/contexts/data-context"
import { PeriodSwitcher } from "@/components/period-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import type { ObligationWithDetails } from "@/lib/types"

/** Item de alerta unificado — qualquer um dos 4 tipos de tarefa. */
type AlertItem = {
  id: string
  name: string
  clientName: string
  href: string
  dueDate: string
  kind: "obrigacao" | "guia" | "parcela" | "servico"
}

const ALERT_KIND_LABEL: Record<AlertItem["kind"], string> = {
  obrigacao: "Obrigação",
  guia: "Guia",
  parcela: "Parcela",
  servico: "Serviço",
}

export function Navigation() {
  const pathname = usePathname()
  const { obligations, clients, taxes, installments, services, isLoading, isRefreshing, lastRefreshAt, refreshData } = useData()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const obsWithDetails = useMemo<ObligationWithDetails[]>(() => {
    if (isLoading || !clients.length) return []
    return getObligationsWithDetails(obligations, clients, taxes)
  }, [obligations, clients, taxes, isLoading])

  // Alertas consideram os 4 tipos de tarefa (antes só obrigações): obrigações,
  // guias, parcelamentos e serviços. Cada um vira um AlertItem com a data
  // calculada do jeito certo pro seu tipo.
  const { overdueList, weekList } = useMemo(() => {
    const clientName = (id: string | undefined) => clients.find((c) => c.id === id)?.name ?? "—"
    const items: AlertItem[] = []

    // Obrigações (já têm calculatedDueDate)
    for (const o of obsWithDetails) {
      if (o.status === "completed") continue
      items.push({
        id: `obl-${o.id}`,
        name: o.name,
        clientName: o.client.name,
        href: `/obrigacoes?clientId=${o.clientId}`,
        dueDate: o.calculatedDueDate,
        kind: "obrigacao",
      })
    }
    // Guias de imposto
    for (const t of taxes) {
      if (t.status === "completed") continue
      const d = calculateDueDateFromCompetency(t.competencyMonth, t.dueDay, t.weekendRule, t.dueMonth)
      if (!d) continue
      items.push({
        id: `tax-${t.id}`,
        name: t.name,
        clientName: clientName(t.clientId),
        href: `/impostos?clientId=${t.clientId ?? ""}`,
        dueDate: d.toISOString(),
        kind: "guia",
      })
    }
    // Parcelamentos (data da parcela atual)
    for (const i of installments) {
      if (i.status === "completed") continue
      const firstDue = new Date(i.firstDueDate)
      const due = adjustForWeekend(
        buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (i.currentInstallment - 1), i.dueDay),
        i.weekendRule,
      )
      items.push({
        id: `inst-${i.id}`,
        name: i.name,
        clientName: clientName(i.clientId),
        href: `/parcelamentos?clientId=${i.clientId}`,
        dueDate: due.toISOString(),
        kind: "parcela",
      })
    }
    // Serviços (data única)
    for (const s of services) {
      if (s.status === "completed") continue
      items.push({
        id: `svc-${s.id}`,
        name: s.name,
        clientName: clientName(s.clientId),
        href: `/servicos?clientId=${s.clientId}`,
        dueDate: s.dueDate,
        kind: "servico",
      })
    }

    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const overdueList: AlertItem[] = []
    const weekList: AlertItem[] = []
    for (const it of items) {
      const due = new Date(it.dueDate)
      if (isOverdue(it.dueDate)) overdueList.push(it)
      else if (due >= today && due <= nextWeek) weekList.push(it)
    }
    const byDate = (a: AlertItem, b: AlertItem) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    overdueList.sort(byDate)
    weekList.sort(byDate)
    return { overdueList, weekList }
  }, [obsWithDetails, taxes, installments, services, clients])

  const totalAlerts = overdueList.length + weekList.length

  // Padronizado: nenhum item da navegação mostra badge de contagem.
  // Alertas críticos (atrasados, vencendo na semana) ficam no popover do sino,
  // que já é destacado em vermelho. Contagens totais aparecem nas próprias páginas.
  // `label` = nome completo (usado no menu do celular, onde há espaço).
  // `short` = nome curto pra barra horizontal do desktop caber os 9 itens
  // numa linha em notebooks (1280-1366px). Sem `short`, usa o `label`.
  const navItems: { href: string; label: string; short?: string; icon: typeof LayoutDashboard }[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clientes", label: "Empresas", icon: Building2 },
    { href: "/impostos", label: "Guias de Imposto", short: "Guias", icon: Receipt },
    { href: "/obrigacoes", label: "Obrigações Acessórias", short: "Obrigações", icon: FileText },
    { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
    { href: "/servicos", label: "Serviços", icon: Briefcase },
    { href: "/calendario", label: "Calendário", icon: Calendar },
    { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/templates", label: "Templates", icon: Layers },
  ]

  return (
    <nav className="glass-panel border-b sticky top-0 z-50">
      <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg shadow-primary/20">
                <FileText className="size-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg hidden sm:inline tracking-tight">Controle Fiscal</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "gap-2 relative transition-all rounded-full h-9",
                        isActive && "bg-primary/10 text-primary hover:bg-primary/20"
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden xl:block">
              <PeriodSwitcher />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex h-9 w-9 rounded-full"
                onClick={() => refreshData()}
                disabled={isRefreshing}
                title={
                  lastRefreshAt
                    ? `Última atualização: ${new Date(lastRefreshAt).toLocaleTimeString("pt-BR")}`
                    : "Atualizar dados"
                }
                aria-label="Atualizar"
              >
                <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
              <ThemeToggle />
              {totalAlerts > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="hidden sm:flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-950/20 rounded-full border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label={`${totalAlerts} alertas — clique para ver`}
                    >
                      <Bell className="size-3.5 text-red-600 dark:text-red-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                        {totalAlerts} {totalAlerts === 1 ? "Alerta" : "Alertas"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[380px] p-0">
                    <AlertsPopoverContent overdue={overdueList} thisWeek={weekList} />
                  </PopoverContent>
                </Popover>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden relative"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                {totalAlerts > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">
                    {totalAlerts}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden py-4 space-y-1 animate-in">
            <div className="pb-4 mb-4 border-b">
              <PeriodSwitcher />
            </div>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={isActive ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}

type AlertsPopoverContentProps = {
  overdue: AlertItem[]
  thisWeek: AlertItem[]
}

function AlertItemRow({ item, tone }: { item: AlertItem; tone: "overdue" | "week" }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            <span className="text-foreground/60">{ALERT_KIND_LABEL[item.kind]}</span> · {item.clientName}
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold whitespace-nowrap ${
            tone === "overdue" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {formatDate(item.dueDate)}
        </span>
      </Link>
    </li>
  )
}

function AlertsPopoverContent({ overdue, thisWeek }: AlertsPopoverContentProps) {
  const MAX = 5
  const overdueShown = overdue.slice(0, MAX)
  const weekShown = thisWeek.slice(0, MAX)
  return (
    <div className="flex flex-col max-h-[480px]">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Bell className="size-4 text-destructive" />
          Atenção imediata
        </p>
        <p className="text-xs text-muted-foreground">
          {overdue.length} atrasada{overdue.length === 1 ? "" : "s"} · {thisWeek.length} vencendo nesta semana
        </p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {overdueShown.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-2 flex items-center gap-1.5">
              <AlertTriangle className="size-3" /> Atrasadas
              {overdue.length > MAX && <span className="ml-auto font-normal normal-case text-muted-foreground">+{overdue.length - MAX}</span>}
            </p>
            <ul className="space-y-1.5">
              {overdueShown.map((it) => (
                <AlertItemRow key={it.id} item={it} tone="overdue" />
              ))}
            </ul>
          </div>
        )}

        {weekShown.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
              <Clock className="size-3" /> Vencendo em até 7 dias
              {thisWeek.length > MAX && <span className="ml-auto font-normal normal-case text-muted-foreground">+{thisWeek.length - MAX}</span>}
            </p>
            <ul className="space-y-1.5">
              {weekShown.map((it) => (
                <AlertItemRow key={it.id} item={it} tone="week" />
              ))}
            </ul>
          </div>
        )}

        {overdue.length === 0 && thisWeek.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Tudo em dia! 🎉
          </div>
        )}
      </div>

      <div className="border-t p-2">
        <Link
          href="/obrigacoes?tab=overdue"
          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-primary hover:text-primary/80 py-2 rounded-md hover:bg-muted transition-colors"
        >
          Ver todas as tarefas <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
