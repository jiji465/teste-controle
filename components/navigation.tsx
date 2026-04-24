"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LayoutDashboard, FileText, Calendar, Receipt, Menu, X, BarChart3, Bell, CreditCard, Building2, Layers, AlertTriangle, Clock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { isOverdue, formatDate } from "@/lib/date-utils"
import { useData } from "@/contexts/data-context"
import { PeriodSwitcher } from "@/components/period-switcher"
import type { ObligationWithDetails } from "@/lib/types"

export function Navigation() {
  const pathname = usePathname()
  const { obligations, clients, taxes, isLoading } = useData()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const obsWithDetails = useMemo<ObligationWithDetails[]>(() => {
    if (isLoading || !clients.length) return []
    return getObligationsWithDetails(obligations, clients, taxes)
  }, [obligations, clients, taxes, isLoading])

  const { overdueList, weekList } = useMemo(() => {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const overdueList: ObligationWithDetails[] = []
    const weekList: ObligationWithDetails[] = []

    for (const o of obsWithDetails) {
      if (o.status === "completed") continue
      const due = new Date(o.calculatedDueDate)
      if (isOverdue(o.calculatedDueDate)) {
        overdueList.push(o)
      } else if (due >= today && due <= nextWeek) {
        weekList.push(o)
      }
    }
    overdueList.sort((a, b) => new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime())
    weekList.sort((a, b) => new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime())
    return { overdueList, weekList }
  }, [obsWithDetails])

  const totalAlerts = overdueList.length + weekList.length

  // Padronizado: nenhum item da navegação mostra badge de contagem.
  // Alertas críticos (atrasados, vencendo na semana) ficam no popover do sino,
  // que já é destacado em vermelho. Contagens totais aparecem nas próprias páginas.
  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clientes", label: "Empresas", icon: Building2 },
    { href: "/impostos", label: "Impostos", icon: Receipt },
    { href: "/obrigacoes", label: "Obrigações", icon: FileText },
    { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
    { href: "/calendario", label: "Calendário", icon: Calendar },
    { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/templates", label: "Templates", icon: Layers },
  ]

  return (
    <nav className="glass-panel border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
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
  overdue: ObligationWithDetails[]
  thisWeek: ObligationWithDetails[]
}

function AlertsPopoverContent({ overdue, thisWeek }: AlertsPopoverContentProps) {
  const MAX = 5
  const overdueShown = overdue.slice(0, MAX)
  const weekShown = thisWeek.slice(0, MAX)
  return (
    <div className="flex flex-col max-h-[480px]">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Bell className="size-4 text-red-600" />
          Atenção imediata
        </p>
        <p className="text-xs text-muted-foreground">
          {overdue.length} atrasadas · {thisWeek.length} vencendo nesta semana
        </p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {overdueShown.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="size-3" /> Atrasadas
            </p>
            <ul className="space-y-1.5">
              {overdueShown.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/obrigacoes?clientId=${o.clientId}&tab=overdue`}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{o.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.client.name}</p>
                    </div>
                    <span className="text-[10px] text-red-600 font-semibold whitespace-nowrap">
                      {formatDate(o.calculatedDueDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {weekShown.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1.5">
              <Clock className="size-3" /> Vencendo em até 7 dias
            </p>
            <ul className="space-y-1.5">
              {weekShown.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/obrigacoes?clientId=${o.clientId}`}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{o.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.client.name}</p>
                    </div>
                    <span className="text-[10px] text-amber-600 font-semibold whitespace-nowrap">
                      {formatDate(o.calculatedDueDate)}
                    </span>
                  </Link>
                </li>
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
          Ver todas as obrigações <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
