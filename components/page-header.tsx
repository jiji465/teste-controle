import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * PageHeader — cabeçalho padronizado das páginas internas.
 *
 * Drop-in para o antigo cluster `<div className="space-y-1"><h1/><p/></div>`:
 * acrescenta um chip de ícone em gradiente (igual à marca da sidebar) e mantém
 * suporte a um badge inline (ex.: filtro de período). As ações da página
 * continuam fora, no flex de cada página.
 */
interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  /** Conteúdo exibido ao lado do título (ex.: badge de período). */
  badge?: ReactNode
  className?: string
}

export function PageHeader({ title, description, icon: Icon, badge, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {Icon ? (
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border bg-card text-foreground">
          <Icon className="size-[18px]" />
        </span>
      ) : null}
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}
