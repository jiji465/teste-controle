"use client"

/**
 * StatusBadge / PriorityBadge — fonte ÚNICA de verdade para as cores de
 * status e prioridade em todo o app.
 *
 * Antes, cada tela (obrigações, impostos, parcelamentos, serviços) tinha
 * seu próprio bloco getStatusBadge com cores hardcoded e ESTILOS DIFERENTES
 * (umas sólidas bg-green-600, outras suaves bg-green-100) — visual
 * inconsistente. Agora todas usam estes componentes, baseados nos tokens
 * semânticos do globals.css (--success/--warning/--info/--destructive), que
 * já se adaptam ao tema claro/escuro automaticamente.
 *
 * Estilo: "soft" (fundo tingido + texto/borda na cor) — leve, legível e
 * consistente em ambos os temas.
 */

import { CheckCircle2, PlayCircle, AlertTriangle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TaskStatus = "completed" | "in_progress" | "overdue" | "pending"

// success/info/destructive usam tokens semânticos (texto na própria cor, que
// tem contraste OK em fundo /10). "pending" usa âmbar explícito: o token
// --warning-foreground é quase-preto no tema claro (pensado p/ fundo warning
// sólido), o que apagava a cor de "atenção" no badge. amber-700/400 garante
// contraste E o tom âmbar consistente em ambos os temas.
const STATUS_STYLE: Record<TaskStatus, string> = {
  completed: "bg-success/10 text-success border-success/25",
  in_progress: "bg-info/10 text-info border-info/25",
  overdue: "bg-destructive/10 text-destructive border-destructive/25",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
}

const STATUS_ICON: Record<TaskStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  in_progress: PlayCircle,
  overdue: AlertTriangle,
  pending: Clock,
}

// Rótulo padrão (feminino — "Concluída/Atrasada"). Telas com gênero
// masculino ("Concluído") ou termos próprios ("Pago") passam `labels`.
const DEFAULT_LABELS: Record<TaskStatus, string> = {
  completed: "Concluída",
  in_progress: "Em Andamento",
  overdue: "Atrasada",
  pending: "Pendente",
}

type StatusBadgeProps = {
  status: TaskStatus
  /** Sobrescreve rótulos por status (ex: { completed: "Pago" }). */
  labels?: Partial<Record<TaskStatus, string>>
  className?: string
}

export function StatusBadge({ status, labels, className }: StatusBadgeProps) {
  const Icon = STATUS_ICON[status]
  const label = labels?.[status] ?? DEFAULT_LABELS[status]
  return (
    <Badge variant="outline" className={cn(STATUS_STYLE[status], className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}

// ─── Prioridade ────────────────────────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high" | "urgent"

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  medium: "bg-muted text-muted-foreground border-border",
  low: "bg-info/10 text-info border-info/25",
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
}

type PriorityBadgeProps = {
  priority: TaskPriority
  /** Esconde a prioridade "média" (padrão), como as listas já faziam. */
  hideMedium?: boolean
  className?: string
}

export function PriorityBadge({ priority, hideMedium = true, className }: PriorityBadgeProps) {
  if (hideMedium && priority === "medium") return null
  return (
    <Badge variant="outline" className={cn(PRIORITY_STYLE[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
