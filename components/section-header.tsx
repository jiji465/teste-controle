import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * SectionHeader — cabeçalho padrão de seção do painel.
 *
 * Marcador âmbar (assinatura da marca, ecoa o item ativo da sidebar e os
 * kickers do relatório) + ícone + título em Inter semibold + sufixo opcional
 * (ex.: período) e área de ação à direita.
 */
export function SectionHeader({
  icon: Icon,
  title,
  suffix,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  suffix?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-5 w-1 shrink-0 rounded-full bg-highlight" aria-hidden />
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
        <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
        {suffix ? <span className="text-sm font-normal text-muted-foreground">{suffix}</span> : null}
      </div>
      {action}
    </div>
  )
}
