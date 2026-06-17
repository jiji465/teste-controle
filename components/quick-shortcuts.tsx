"use client"

/**
 * QuickShortcuts — atalhos de criação no Dashboard. Complementa o "Acesso
 * rápido" (que navega): aqui o foco é começar um cadastro novo rápido.
 */

import Link from "next/link"
import { Building2, FileText, Receipt, CreditCard, Briefcase, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const SHORTCUTS = [
  { label: "Empresa", icon: Building2, href: "/clientes" },
  { label: "Obrigação", icon: FileText, href: "/obrigacoes" },
  { label: "Guia", icon: Receipt, href: "/impostos" },
  { label: "Parcelamento", icon: CreditCard, href: "/parcelamentos" },
  { label: "Serviço", icon: Briefcase, href: "/servicos" },
]

export function QuickShortcuts() {
  return (
    <Card className="flex flex-row flex-wrap items-center gap-2 px-4 py-3">
      <span className="mr-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Plus className="size-3.5 text-highlight" />
        Novo
      </span>
      {SHORTCUTS.map((s) => {
        const Icon = s.icon
        return (
          <Link key={s.href} href={s.href}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Icon className="size-3.5" />
              {s.label}
            </Button>
          </Link>
        )
      })}
    </Card>
  )
}
