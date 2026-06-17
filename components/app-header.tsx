"use client"

/**
 * AppHeader — barra superior slim da nova shell (dentro da área de conteúdo,
 * à direita da sidebar).
 *
 *  - esquerda: gatilho do drawer (mobile) + breadcrumb da rota atual;
 *  - direita: seletor de período, atualizar, e sino de alertas (atrasos +
 *    vencendo em 7 dias) alimentado por useTaskAlerts.
 *
 * Tema e usuário ficam no rodapé da sidebar.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, RefreshCw, Bell, ChevronRight, AlertTriangle, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PeriodSwitcher } from "@/components/period-switcher"
import { useData } from "@/contexts/data-context"
import { useTaskAlerts, ALERT_KIND_LABEL, type TaskAlert } from "@/hooks/use-task-alerts"
import { formatDate } from "@/lib/date-utils"

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/clientes": "Empresas",
  "/impostos": "Guias de Imposto",
  "/obrigacoes": "Obrigações Acessórias",
  "/parcelamentos": "Parcelamentos",
  "/servicos": "Serviços",
  "/calendario": "Calendário",
  "/relatorios": "Relatórios",
  "/relatorios-executivos": "Relatório Executivo",
  "/templates": "Templates",
}

export function AppHeader({ onOpenMobile }: { onOpenMobile: () => void }) {
  const pathname = usePathname()
  const { isRefreshing, lastRefreshAt, refreshData } = useData()
  const { overdueList, weekList, totalAlerts } = useTaskAlerts()

  const currentLabel = ROUTE_LABELS[pathname] ?? "Página"

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background">
      <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        {/* Esquerda: menu mobile + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 lg:hidden"
            onClick={onOpenMobile}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href="/"
              className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Início
            </Link>
            <ChevronRight className="hidden size-3 shrink-0 text-muted-foreground sm:inline" />
            <span className="truncate text-sm font-semibold">{currentLabel}</span>
          </div>
        </div>

        {/* Direita: período + ações */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:block">
            <PeriodSwitcher />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
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

          {totalAlerts > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/20 dark:hover:bg-red-950/40"
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
        </div>
      </div>
    </header>
  )
}

function AlertItemRow({ item, tone }: { item: TaskAlert; tone: "overdue" | "week" }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center justify-between gap-2 rounded-md p-2 transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="text-foreground/60">{ALERT_KIND_LABEL[item.kind]}</span> · {item.clientName}
          </p>
        </div>
        <span
          className={`whitespace-nowrap text-[10px] font-semibold ${
            tone === "overdue" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {formatDate(item.dueDate)}
        </span>
      </Link>
    </li>
  )
}

function AlertsPopoverContent({ overdue, thisWeek }: { overdue: TaskAlert[]; thisWeek: TaskAlert[] }) {
  const MAX = 5
  const overdueShown = overdue.slice(0, MAX)
  const weekShown = thisWeek.slice(0, MAX)
  return (
    <div className="flex max-h-[480px] flex-col">
      <div className="border-b px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-destructive" />
          Atenção imediata
        </p>
        <p className="text-xs text-muted-foreground">
          {overdue.length} atrasada{overdue.length === 1 ? "" : "s"} · {thisWeek.length} vencendo nesta semana
        </p>
      </div>

      <div className="flex-1 divide-y overflow-y-auto">
        {overdueShown.length > 0 && (
          <div className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
              <AlertTriangle className="size-3" /> Atrasadas
              {overdue.length > MAX && (
                <span className="ml-auto font-normal normal-case text-muted-foreground">
                  +{overdue.length - MAX}
                </span>
              )}
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
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Clock className="size-3" /> Vencendo em até 7 dias
              {thisWeek.length > MAX && (
                <span className="ml-auto font-normal normal-case text-muted-foreground">
                  +{thisWeek.length - MAX}
                </span>
              )}
            </p>
            <ul className="space-y-1.5">
              {weekShown.map((it) => (
                <AlertItemRow key={it.id} item={it} tone="week" />
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
          className="flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-primary transition-colors hover:bg-muted hover:text-primary/80"
        >
          Ver todas as tarefas <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
