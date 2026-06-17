"use client"

/**
 * AppShell — esqueleto do painel: sidebar fixa (desktop) / drawer (mobile) +
 * header slim + área de conteúdo.
 *
 * Substitui a antiga shell de barra horizontal. O estado de colapso da
 * sidebar é persistido no localStorage; o drawer mobile fecha sozinho a cada
 * navegação. Rotas de autenticação (/login, /auth) renderizam sem a shell.
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { SidebarNav, MobileSidebar, SIDEBAR_STORAGE_KEY } from "@/components/sidebar-nav"
import { AppHeader } from "@/components/app-header"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hidrata o estado de colapso a partir do localStorage (só no cliente).
  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true")
  }, [])

  // Fecha o drawer mobile ao trocar de rota.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      }
      return next
    })
  }

  // Telas de autenticação ocupam a tela inteira, sem sidebar/header.
  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/auth")
  if (isAuthRoute) {
    return <div className="min-h-screen bg-background">{children}</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <SidebarNav collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      {/* Abaixo de lg a sidebar vira drawer (sem padding); a partir de lg o
          conteúdo recua conforme a largura da sidebar (256px ↔ 76px). */}
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 ease-in-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[256px]",
        )}
      >
        <AppHeader onOpenMobile={() => setMobileOpen(true)} />
        {/* pb extra no mobile pra o conteúdo não ficar atrás do bottom nav */}
        <main className="pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Barra de navegação inferior — só mobile (cara de app) */}
      <MobileBottomNav onOpenMenu={() => setMobileOpen(true)} />
    </div>
  )
}
