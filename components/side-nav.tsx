"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Receipt,
  FileText,
  CreditCard,
  Calendar,
  BarChart3,
  Layers,
  ChevronLeft,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Empresas", icon: Building2 },
  { href: "/impostos", label: "Guias", icon: Receipt },
  { href: "/obrigacoes", label: "Obrigações", icon: FileText },
  { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
  { href: "/calendario", label: "Calendário", icon: Calendar },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/templates", label: "Templates", icon: Layers },
]

export const SIDEBAR_STORAGE_KEY = "sidebar-collapsed"

type SideNavProps = {
  isMobileOpen: boolean
  onMobileToggle: () => void
}

export function SideNav({ isMobileOpen, onMobileToggle }: SideNavProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
  })

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      window.dispatchEvent(new Event("sidebar-toggle"))
    }
  }

  return (
    <>
      {/* Backdrop mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileToggle}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen border-r bg-card transition-[width,transform] duration-200 ease-in-out",
          // Width
          isCollapsed ? "w-[64px]" : "w-[220px]",
          // Mobile: drawer
          "transform lg:transform-none",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo + collapse toggle */}
          <div className="flex h-14 items-center justify-between px-3 border-b">
            <Link
              href="/"
              className="flex items-center gap-2 group min-w-0"
              onClick={() => isMobileOpen && onMobileToggle()}
            >
              <div className="size-8 shrink-0 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <FileText className="size-4 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <span className="font-bold text-sm tracking-tight truncate">Controle Fiscal</span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex size-7 shrink-0"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              <ChevronLeft className={cn("size-4 transition-transform", isCollapsed && "rotate-180")} />
            </Button>
          </div>

          {/* Items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobileOpen && onMobileToggle()}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-primary/10 text-primary hover:bg-primary/15",
                    isCollapsed && "justify-center px-0",
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t p-2">
            <p className={cn("text-[10px] text-muted-foreground text-center px-2", isCollapsed && "hidden")}>
              v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile menu trigger (fica visível só no mobile) */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-2.5 left-2.5 z-50"
        onClick={onMobileToggle}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </Button>
    </>
  )
}
