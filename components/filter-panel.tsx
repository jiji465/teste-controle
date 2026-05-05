"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, Check, X, FilterX, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// FilterPill — botão estilo "pílula" que abre dropdown com opções
// ─────────────────────────────────────────────────────────────────────────────

export type FilterOption = {
  value: string
  /** Label visível no dropdown */
  label: string
  /** Hint opcional (ex: "5 itens") */
  hint?: string
}

type FilterPillProps = {
  /** Ícone à esquerda */
  icon?: ReactNode
  /** Label (ex: "Cliente") — sempre visível */
  label: string
  /** Valor atual */
  value: string
  /** "Todos" / "Qualquer" — quando o valor é igual a esse, considera não-ativo */
  defaultValue?: string
  /** Lista de opções */
  options: FilterOption[]
  /** Habilita busca textual no dropdown (útil pra muitas opções) */
  searchable?: boolean
  /** Texto do placeholder de busca */
  searchPlaceholder?: string
  onChange: (value: string) => void
  /** Largura mínima do trigger (px) */
  minWidth?: number
}

export function FilterPill({
  icon,
  label,
  value,
  defaultValue = "all",
  options,
  searchable,
  searchPlaceholder = "Buscar…",
  onChange,
  minWidth,
}: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const isActive = value !== defaultValue && value !== ""
  const current = options.find((o) => o.value === value)
  const displayValue = current?.label ?? "—"

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query, searchable])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        style={minWidth ? { minWidth } : undefined}
        className={cn(
          "group inline-flex items-center rounded-full border h-9 text-sm transition-all overflow-hidden",
          "hover:border-foreground/30",
          isActive
            ? "border-primary/50 bg-primary/5 text-primary shadow-sm"
            : "border-border bg-background text-foreground/90",
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 h-full pl-3 text-sm transition-colors",
              isActive ? "pr-2" : "pr-3",
            )}
          >
            {icon && <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>{icon}</span>}
            <span className={cn("font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
              {label}
            </span>
            {isActive && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-semibold truncate max-w-[160px]">{displayValue}</span>
              </>
            )}
            {!isActive && (
              <ChevronDown className="size-3.5 text-muted-foreground/60 group-hover:text-foreground/60 transition-colors" />
            )}
          </button>
        </PopoverTrigger>
        {isActive && (
          // Botão "limpar" como IRMÃO do trigger — antes estava aninhado dentro
          // do botão da pílula, o que é HTML inválido (button dentro de button)
          // e fazia o clique abrir o dropdown em vez de limpar o filtro.
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            aria-label={`Remover filtro ${label}`}
            className="h-full px-2 flex items-center hover:bg-primary/15 transition-colors border-l border-primary/20"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <PopoverContent className="p-0 w-[260px]" align="start">
        {searchable && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
                autoFocus
              />
            </div>
          </div>
        )}
        <div className="max-h-[260px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">Nenhuma opção encontrada</p>
          ) : (
            filtered.map((opt) => {
              const selected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm text-left",
                    "hover:bg-muted transition-colors",
                    selected && "bg-primary/5 text-primary font-medium",
                  )}
                >
                  <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                  {opt.hint && <span className="text-[10px] text-muted-foreground tabular-nums">{opt.hint}</span>}
                  {selected && <Check className="size-4 shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterPillMonth — variante pra input de mês (date input nativo)
// ─────────────────────────────────────────────────────────────────────────────

type FilterPillMonthProps = {
  icon?: ReactNode
  label: string
  /** "YYYY-MM" ou string vazia */
  value: string
  onChange: (value: string) => void
}

export function FilterPillMonth({ icon, label, value, onChange }: FilterPillMonthProps) {
  const [open, setOpen] = useState(false)
  const isActive = !!value

  // Formato amigável "Abr/26" pra mostrar no botão
  const display = (() => {
    if (!value) return null
    const m = value.match(/^(\d{4})-(\d{2})$/)
    if (!m) return value
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    return `${months[Number(m[2]) - 1]}/${m[1].slice(2)}`
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group inline-flex items-center rounded-full border h-9 text-sm transition-all overflow-hidden",
          "hover:border-foreground/30",
          isActive
            ? "border-primary/50 bg-primary/5 text-primary shadow-sm"
            : "border-border bg-background text-foreground/90",
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 h-full pl-3 text-sm transition-colors",
              isActive ? "pr-2" : "pr-3",
            )}
          >
            {icon && <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>{icon}</span>}
            <span className={cn("font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
              {label}
            </span>
            {isActive && display && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-semibold">{display}</span>
              </>
            )}
            {!isActive && (
              <ChevronDown className="size-3.5 text-muted-foreground/60 group-hover:text-foreground/60 transition-colors" />
            )}
          </button>
        </PopoverTrigger>
        {isActive && (
          // Botão limpar como irmão (não pode ser button dentro de button — HTML inválido)
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Remover filtro ${label}`}
            className="h-full px-2 flex items-center hover:bg-primary/15 transition-colors border-l border-primary/20"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <PopoverContent className="p-3 w-[240px]" align="start">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Selecione o mês
        </label>
        <Input
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            className="mt-2 w-full h-7 text-xs"
          >
            Limpar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterBar — wrapper horizontal que agrupa pills + botão "Limpar tudo"
// ─────────────────────────────────────────────────────────────────────────────

type FilterBarProps = {
  children: ReactNode
  /** Quantidade de filtros ativos — controla a visibilidade do "Limpar tudo" */
  activeCount: number
  onClearAll: () => void
}

export function FilterBar({ children, activeCount, onClearAll }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      {children}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-9 text-xs text-muted-foreground hover:text-foreground"
        >
          <FilterX className="size-3.5 mr-1" />
          Limpar {activeCount > 1 ? `${activeCount} filtros` : "filtro"}
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY (mantido pra compat) — Versões antigas do componente
// ─────────────────────────────────────────────────────────────────────────────

export type ActiveChip = {
  label: string
  onRemove: () => void
}

type ActiveChipsProps = {
  chips: ActiveChip[]
  onClearAll: () => void
}

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

type FilterShellProps = {
  children: ReactNode
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

type FilterFieldProps = {
  icon?: ReactNode
  label: string
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
