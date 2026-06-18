"use client"

/**
 * StatFilterBar — cartões de status que servem de RESUMO + FILTRO.
 *
 * Substitui as abas genéricas das páginas de lista por cartões estilo
 * Dashboard: número grande (tabular), ícone com cor por status e o item ativo
 * destacado com o accent âmbar da marca. Cores via tokens (adaptam ao tema).
 */

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/animated-number"

export type StatTone = "neutral" | "warning" | "info" | "success" | "danger"

export type StatFilterItem = {
  value: string
  label: string
  count: number
  icon?: LucideIcon
  tone?: StatTone
}

const TONE_ICON: Record<StatTone, string> = {
  neutral: "text-muted-foreground",
  warning: "text-warning",
  info: "text-info",
  success: "text-success",
  danger: "text-destructive",
}

export function StatFilterBar({
  items,
  value,
  onChange,
  className,
}: {
  items: StatFilterItem[]
  /** Valor ativo. "all" (ou vazio) = primeiro cartão. */
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const activeValue = value || "all"

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {items.map((item) => {
        const active = activeValue === item.value
        const Icon = item.icon
        const tone = item.tone ?? "neutral"
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={cn(
              "group relative rounded-xl border bg-card p-3 text-left outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary/40 ring-1 ring-inset ring-primary/25" : "hover:border-primary/40",
            )}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-highlight"
                aria-hidden
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              {Icon ? (
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : TONE_ICON[tone])} />
              ) : null}
            </div>
            <p className={cn("mt-1.5 text-2xl font-bold leading-none tabular-nums", active && "text-primary")}>
              <AnimatedNumber value={item.count} />
            </p>
          </button>
        )
      })}
    </div>
  )
}
