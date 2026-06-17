"use client"

/**
 * MobileBottomNav — barra de navegação inferior estilo aplicativo (só mobile,
 * lg:hidden). Tabs das seções principais + "Mais" abrindo o drawer com tudo.
 *
 * Estado ativo: ícone dentro de uma "pílula" âmbar (padrão de app nativo) +
 * rótulo em navy. Alvos de toque generosos e feedback ao pressionar.
 * Respeita a safe-area inferior (iOS).
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, FileText, Receipt, Menu, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Item = { href: string; label: string; icon: LucideIcon }

const ITEMS: Item[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/clientes", label: "Empresas", icon: Building2 },
  { href: "/obrigacoes", label: "Obrigações", icon: FileText },
  { href: "/impostos", label: "Guias", icon: Receipt },
]

function ItemContent({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active ? "bg-highlight/20" : "bg-transparent",
        )}
      >
        <Icon className={cn("size-[22px] transition-colors", active ? "text-primary" : "text-muted-foreground")} />
      </span>
      <span className={cn("truncate text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
    </>
  )
}

export function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 pt-1.5 pb-1 transition-transform active:scale-95"
            >
              <ItemContent icon={item.icon} label={item.label} active={active} />
            </Link>
          )
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Mais seções"
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 pt-1.5 pb-1 transition-transform active:scale-95"
        >
          <ItemContent icon={Menu} label="Mais" active={false} />
        </button>
      </div>
    </nav>
  )
}
