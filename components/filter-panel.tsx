"use client"

import type { ReactNode } from "react"
import { X, FilterX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Chips de filtros ativos ────────────────────────────────────────────────

export type ActiveChip = {
  /** Label do filtro, ex: "Cliente: ACME LTDA" */
  label: string
  /** Remove esse filtro específico (volta pra "all" / vazio) */
  onRemove: () => void
}

type ActiveChipsProps = {
  chips: ActiveChip[]
  /** Limpa todos de uma vez */
  onClearAll: () => void
}

/**
 * Barra de chips dos filtros atualmente aplicados. Mostra "Cliente: X",
 * "Esfera: Federal", etc, cada um com botão X pra remover.
 * Renderiza apenas se houver pelo menos 1 chip.
 */
export function ActiveFilterChips({ chips, onClearAll }: ActiveChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        Filtros ativos:
      </span>
      {chips.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          onClick={chip.onRemove}
          className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 hover:bg-primary/15 transition-colors"
        >
          {chip.label}
          <X className="size-3 opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
      >
        <FilterX className="size-3 mr-1" />
        Limpar tudo
      </Button>
    </div>
  )
}

// ─── Card que envolve a grid de filtros ─────────────────────────────────────

type FilterShellProps = {
  children: ReactNode
  /** Número de colunas no breakpoint sm. Default: 3 */
  cols?: 2 | 3 | 4
  className?: string
}

export function FilterShell({ children, cols = 3, className }: FilterShellProps) {
  const colClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"
  return (
    <div
      className={cn(
        "grid gap-4 p-5 border rounded-xl bg-gradient-to-b from-muted/30 to-muted/10 shadow-sm",
        colClass,
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Cell de um filtro ──────────────────────────────────────────────────────

type FilterFieldProps = {
  icon?: ReactNode
  label: string
  /** Se true, mostra um indicador visual (dot azul) que esse filtro está ativo */
  active?: boolean
  children: ReactNode
}

export function FilterField({ icon, label, active, children }: FilterFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {active && <span className="size-1.5 rounded-full bg-primary animate-pulse" aria-hidden />}
      </div>
      {children}
    </div>
  )
}
