"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Building2, Search, X } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { matchesText } from "@/lib/utils"

/**
 * Combobox compacto no header pra trocar de empresa rapidinho.
 * Ao selecionar, navega para /obrigacoes filtrando por aquela empresa
 * (caso já esteja nas páginas que filtram por cliente, atualiza o filtro).
 */
export function ClientQuickSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const { clients } = useData()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = search.trim()
    ? clients.filter((c) => matchesText(c.name, search) || matchesText(c.tradeName, search))
    : clients
  const visible = filtered.slice(0, 8)

  const select = (clientId: string) => {
    setOpen(false)
    setSearch("")
    // Se já está numa página que filtra por cliente, fica nela
    const path = pathname && ["/obrigacoes", "/impostos", "/parcelamentos", "/clientes"].includes(pathname)
      ? pathname
      : "/obrigacoes"
    router.push(`${path}?clientId=${clientId}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex h-9 gap-2 px-3"
          aria-label="Trocar de empresa"
        >
          <Building2 className="size-3.5" />
          <span className="text-xs font-medium">Empresas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:text-foreground text-muted-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {clients.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhum resultado"}
            </p>
          ) : (
            <ul className="py-1">
              {visible.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c.id)}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.tradeName && (
                        <p className="text-[11px] text-muted-foreground truncate">{c.tradeName}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
              {filtered.length > 8 && (
                <li className="px-3 py-1.5 text-[11px] text-muted-foreground text-center border-t mt-1">
                  +{filtered.length - 8} resultados — refine a busca
                </li>
              )}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
