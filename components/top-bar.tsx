"use client"

import { useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PeriodSwitcher } from "@/components/period-switcher"
import { useData } from "@/contexts/data-context"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { isOverdue, formatDate } from "@/lib/date-utils"
import type { ObligationWithDetails } from "@/lib/types"

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/clientes": "Empresas",
  "/impostos": "Guias de Imposto",
  "/obrigacoes": "Obrigações Acessórias",
  "/parcelamentos": "Parcelamentos",
  "/calendario": "Calendário",
  "/relatorios": "Relatórios",
  "/templates": "Templates",
}

export function TopBar() {
  const pathname = usePathname()
  const { obligations, clients, taxes, isLoading, isRefreshing, lastRefreshAt, refreshData } = useData()

  const currentLabel = ROUTE_LABELS[pathname] ?? "Página"

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
      if (isOverdue(o.calculatedDueDate)) overdueList.push(o)
      else if (due >= today && due <= nextWeek) weekList.push(o)
    }
    overdueList.sort((a, b) => new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime())
    weekList.sort((a, b) => new Date(a.calculatedDueDate).getTime() - new Date(b.calculatedDueDate).getTime())
    return { overdueList, weekList }
  }, [obsWithDetails])

  const totalAlerts = overdueList.length + weekList.length

  return (
    <header className="sticky top-0 z-20 h-12 border-b bg-card/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0 pl-10 lg:pl-0">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            Início
          </Link>
          <ChevronRight className="size-3 text-muted-foreground hidden sm:inline shrink-0" />
          <span className="text-sm font-medium truncate">{currentLabel}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:block">
            <PeriodSwitcher />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refreshData()}
            disabled={isRefreshing}
            title={
              lastRefreshAt
                ? `Última: ${new Date(lastRefreshAt).toLocaleTimeString("pt-BR")}`
                : "Atualizar"
            }
            aria-label="Atualizar"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>

          {totalAlerts > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  aria-label={`${totalAlerts} alertas`}
                >
                  <Bell className="size-4" />
                  <span className="text-xs font-bold">{totalAlerts}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[380px] p-0">
                <AlertsPopoverContent overdue={overdueList} thisWeek={weekList} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </header>
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
          <div className="p-8 text-center text-sm text-muted-foreground">Tudo em dia! 🎉</div>
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
