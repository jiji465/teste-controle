"use client"

/**
 * Sidebar criativa do painel — substitui a antiga barra horizontal (navigation.tsx).
 *
 *  - rail colapsável (256px ↔ 76px) com estado persistido no localStorage;
 *  - itens agrupados por seção (Visão geral, Cadastros, Operação, Análise);
 *  - indicador do item ativo animado com framer-motion (layoutId) — a "pílula"
 *    desliza entre os itens a cada navegação, dando a sensação fluida;
 *  - quando colapsada, cada item vira ícone + tooltip lateral;
 *  - botão flutuante na borda recolhe/expande.
 *
 * `SidebarNav` é a versão fixa (desktop); `MobileSidebar` é o mesmo conteúdo
 * dentro de um Sheet (drawer) pra telas pequenas. As duas reusam SidebarInner.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, LayoutGroup } from "framer-motion"
import {
  LayoutDashboard,
  Building2,
  Layers,
  Receipt,
  FileText,
  CreditCard,
  Briefcase,
  Calendar,
  BarChart3,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"

export const SIDEBAR_STORAGE_KEY = "sidebar-collapsed"
export const SIDEBAR_WIDTH = 256
export const SIDEBAR_WIDTH_COLLAPSED = 76

type NavItem = { href: string; label: string; icon: LucideIcon }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/clientes", label: "Empresas", icon: Building2 },
      { href: "/templates", label: "Templates", icon: Layers },
    ],
  },
  {
    label: "Operação fiscal",
    items: [
      { href: "/impostos", label: "Guias de Imposto", icon: Receipt },
      { href: "/obrigacoes", label: "Obrigações", icon: FileText },
      { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
      { href: "/servicos", label: "Serviços", icon: Briefcase },
    ],
  },
  {
    label: "Agenda & análise",
    items: [
      { href: "/calendario", label: "Calendário", icon: Calendar },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/relatorios-executivos", label: "Relatório Executivo", icon: TrendingUp },
    ],
  },
]

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "text-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-md bg-sidebar-accent"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      {active && !collapsed && (
        <motion.span
          layoutId="sidebar-active-bar"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-highlight"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <Icon className={cn("relative z-10 size-[18px] shrink-0", active && "text-foreground")} />
      {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarInner({
  collapsed,
  onNavigate,
  groupId,
}: {
  collapsed: boolean
  onNavigate?: () => void
  /** Namespacing do LayoutGroup p/ não conflitar layoutId entre desktop e drawer. */
  groupId: string
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-3.5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5"
          aria-label="Ir para o Dashboard"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <FileText className="size-[18px]" />
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold leading-tight tracking-tight">
                Controle Fiscal
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                Painel administrativo
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Navegação */}
      <LayoutGroup id={groupId}>
        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              {!collapsed ? (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              ) : (
                <div className="mx-auto mb-1.5 h-px w-6 bg-sidebar-border" aria-hidden />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      active={pathname === item.href}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </LayoutGroup>

      {/* Rodapé: usuário + tema */}
      <div
        className={cn(
          "border-t border-sidebar-border p-2.5",
          collapsed ? "flex flex-col items-center gap-1.5" : "flex items-center justify-between gap-2",
        )}
      >
        <UserMenu />
        <ThemeToggle />
      </div>
    </div>
  )
}

export function SidebarNav({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out lg:block",
      )}
      style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH }}
    >
      <SidebarInner collapsed={collapsed} groupId="sidebar-desktop" />

      {/* Botão flutuante de recolher/expandir na borda */}
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-[4.5rem] size-6 rounded-full border-border bg-card hover:bg-accent"
      >
        {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
      </Button>
    </aside>
  )
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[264px] gap-0 p-0">
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SidebarInner collapsed={false} groupId="sidebar-mobile" onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
