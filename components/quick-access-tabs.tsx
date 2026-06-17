"use client"

/**
 * QuickAccessTabs — barra de acesso rápido do Dashboard usando o ExpandableTabs
 * (ícones que expandem mostrando o rótulo ao selecionar). Ao escolher um item,
 * navega para a seção correspondente. Paleta alinhada à marca (text-primary).
 */

import { useRouter } from "next/navigation"
import { Building2, Receipt, FileText, CreditCard, Briefcase, Calendar, BarChart3 } from "lucide-react"
import { ExpandableTabs } from "@/components/ui/expandable-tabs"

const TABS = [
  { title: "Empresas", icon: Building2 },
  { title: "Guias", icon: Receipt },
  { title: "Obrigações", icon: FileText },
  { title: "Parcelamentos", icon: CreditCard },
  { title: "Serviços", icon: Briefcase },
  { type: "separator" as const },
  { title: "Calendário", icon: Calendar },
  { title: "Relatórios", icon: BarChart3 },
]

// Mesma ordem de TABS — separador = null (não navega).
const ROUTES: (string | null)[] = [
  "/clientes",
  "/impostos",
  "/obrigacoes",
  "/parcelamentos",
  "/servicos",
  null,
  "/calendario",
  "/relatorios",
]

export function QuickAccessTabs() {
  const router = useRouter()
  return (
    <ExpandableTabs
      tabs={TABS}
      activeColor="text-primary"
      className="w-fit max-w-full border-primary/15"
      onChange={(index) => {
        if (index == null) return
        const href = ROUTES[index]
        if (href) router.push(href)
      }}
    />
  )
}
