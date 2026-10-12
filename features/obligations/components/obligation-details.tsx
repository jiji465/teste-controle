"use client"

import { HistoryTimeline } from "@/components/history-timeline"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  Clock,
  User,
  FileText,
  Building2,
  Receipt,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Pencil,
  Hash,
  CalendarDays,
  Layers,
  AlertCircle,
  CalendarClock,
  Repeat,
  Tag,
  Copy,
  Scale,
  FolderOpen,
} from "lucide-react"
import type { ObligationWithDetails, Priority, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS, TAX_SCOPE_LABELS } from "@/lib/types"
import { formatDate, isOverdue } from "@/lib/date-utils"
import { getRecurrenceDescription } from "@/lib/recurrence-utils"
import { toast } from "sonner"

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "border-info text-info",
  medium: "border-gray-400 text-gray-700 dark:text-gray-400",
  high: "border-warning text-warning",
  urgent: "border-destructive text-destructive",
}

const SCOPE_COLORS: Record<string, string> = {
  federal: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  estadual: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  municipal: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
}

const CATEGORY_LABELS: Record<string, string> = {
  sped: "SPED",
  tax_guide: "Guia de Imposto",
  certificate: "Certidão",
  declaration: "Declaração",
  other: "Outro",
}

const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

function formatCompetency(c?: string): string {
  if (!c) return "—"
  const [y, m] = c.split("-")
  const idx = Number(m) - 1
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return c
  return `${MONTH_LABELS[idx]}/${y}`
}

type ObligationDetailsProps = {
  obligation: ObligationWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (obligation: ObligationWithDetails) => void
}

export function ObligationDetails({ obligation, open, onOpenChange, onEdit }: ObligationDetailsProps) {
  const overdue =
    obligation.status !== "completed" && isOverdue(obligation.calculatedDueDate)
  const effectiveStatus = overdue ? "overdue" : obligation.status

  const handleCopy = (label: string, value?: string) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    toast.success(`${label} copiado`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-0">
        {/* Hero */}
        <div
          className={`relative px-6 pt-6 pb-5 border-b ${
            effectiveStatus === "overdue"
              ? "bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent"
              : effectiveStatus === "completed"
                ? "bg-gradient-to-br from-success/10 via-success/5 to-transparent"
                : effectiveStatus === "in_progress"
                  ? "bg-gradient-to-br from-info/10 via-info/5 to-transparent"
                  : "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"
          }`}
        >
          <DialogHeader className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-xl bg-background/80 border flex items-center justify-center shrink-0 shadow-sm">
                <FileText className="size-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl leading-tight break-words">{obligation.name}</DialogTitle>
                {obligation.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{obligation.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <StatusBadge status={effectiveStatus} completedAt={obligation.completedAt} />
                  {obligation.scope && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SCOPE_COLORS[obligation.scope]}`}
                    >
                      <Layers className="size-3 mr-1" />
                      {TAX_SCOPE_LABELS[obligation.scope]}
                    </span>
                  )}
                  {obligation.category && (
                    <Badge variant="outline" className="gap-1">
                      <FolderOpen className="size-3" />
                      {CATEGORY_LABELS[obligation.category] || obligation.category}
                    </Badge>
                  )}
                  {obligation.priority && obligation.priority !== "medium" && (
                    <Badge variant="outline" className={`gap-1 ${PRIORITY_COLORS[obligation.priority]}`}>
                      <AlertCircle className="size-3" />
                      {PRIORITY_LABELS[obligation.priority]}
                    </Badge>
                  )}
                  {obligation.recurrence && (
                    <Badge variant="secondary" className="gap-1">
                      <Repeat className="size-3" />
                      {getRecurrenceDescription(obligation)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Empresa & imposto */}
          <Section title="Empresa & imposto" icon={<Building2 className="size-4" />}>
            <InfoTile
              icon={<Building2 className="size-4" />}
              label="Empresa"
              value={obligation.client.name}
              hint={obligation.client.cnpj}
              wide
            />
            {obligation.tax && (
              <InfoTile
                icon={<Receipt className="size-4" />}
                label="Imposto vinculado"
                value={obligation.tax.name}
                wide
              />
            )}
          </Section>

          <Separator />

          {/* Vencimento */}
          <Section title="Vencimento e competência" icon={<Calendar className="size-4" />}>
            <InfoTile
              icon={<Calendar className="size-4" />}
              label="Próximo vencimento"
              value={formatDate(obligation.calculatedDueDate)}
              mono
              highlight={overdue ? "destructive" : undefined}
            />
            <InfoTile
              icon={<CalendarDays className="size-4" />}
              label="Competência"
              value={formatCompetency(obligation.competencyMonth)}
            />
            {obligation.dueDay && (
              <InfoTile icon={<Hash className="size-4" />} label="Dia do vencimento" value={`Dia ${obligation.dueDay}`} />
            )}
            {obligation.dueMonth && (
              <InfoTile
                icon={<CalendarDays className="size-4" />}
                label="Mês fixo"
                value={MONTH_LABELS[obligation.dueMonth - 1] || `Mês ${obligation.dueMonth}`}
              />
            )}
          </Section>

          {/* Regimes aplicáveis */}
          {obligation.applicableRegimes && obligation.applicableRegimes.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="size-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Regimes aplicáveis
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {obligation.applicableRegimes.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${TAX_REGIME_COLORS[r as TaxRegime]}`}
                    >
                      {TAX_REGIME_LABELS[r as TaxRegime]}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Protocolo / responsável */}
          {(obligation.protocol || obligation.assignedTo) && (
            <>
              <Separator />
              <Section title="Protocolo e responsável" icon={<User className="size-4" />}>
                {obligation.protocol && (
                  <InfoTile
                    icon={<Hash className="size-4" />}
                    label="Protocolo"
                    value={obligation.protocol}
                    mono
                    copyable
                    onCopy={() => handleCopy("Protocolo", obligation.protocol)}
                  />
                )}
                {obligation.assignedTo && (
                  <InfoTile icon={<User className="size-4" />} label="Responsável" value={obligation.assignedTo} />
                )}
              </Section>
            </>
          )}

          {/* Tags */}
          {obligation.tags && obligation.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {obligation.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Observações */}
          {obligation.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Observações</p>
                </div>
                <div className="rounded-lg bg-muted/40 border px-3 py-2.5">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{obligation.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Histórico (trilha do banco + anotações do registro) */}
          <HistoryTimeline entityType="obligation" entityId={obligation.id} localEntries={obligation.history} />

          <Separator />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Criada em <span className="font-medium">{formatDate(obligation.createdAt)}</span>
            </div>
            {obligation.completedAt && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" />
                Concluída em <span className="font-medium">{formatDate(obligation.completedAt)}</span>
                {obligation.completedBy && <span>por {obligation.completedBy}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onOpenChange(false)
                onEdit(obligation)
              }}
              className="gap-2"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatusBadge({ status, completedAt }: { status: string; completedAt?: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-success text-success-foreground hover:bg-success/90 text-white">
          <CheckCircle2 className="size-3 mr-1" />
          Concluída {completedAt && `em ${formatDate(completedAt)}`}
        </Badge>
      )
    case "in_progress":
      return (
        <Badge className="bg-info text-info-foreground hover:bg-info/90 text-white">
          <PlayCircle className="size-3 mr-1" />
          Em andamento
        </Badge>
      )
    case "overdue":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="size-3 mr-1" />
          Atrasada
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning">
          <Clock className="size-3 mr-1" />
          Pendente
        </Badge>
      )
  }
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">{children}</div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  hint,
  mono,
  copyable,
  onCopy,
  highlight,
  wide,
}: {
  icon?: React.ReactNode
  label: string
  value?: string | null
  hint?: string
  mono?: boolean
  copyable?: boolean
  onCopy?: () => void
  highlight?: "destructive" | "success"
  wide?: boolean
}) {
  const highlightClass =
    highlight === "destructive"
      ? "border-destructive/30 dark:border-destructive/60 bg-destructive/60 dark:bg-destructive/20"
      : highlight === "success"
        ? "border-success/30 dark:border-success/60 bg-success/60 dark:bg-success/20"
        : ""
  return (
    <div
      className={`group rounded-lg border bg-card hover:bg-muted/40 transition-colors px-3 py-2.5 flex items-start gap-2.5 ${highlightClass} ${wide ? "sm:col-span-2" : ""}`}
    >
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-sm break-words ${mono ? "font-mono" : ""}`}>
          {value || <span className="text-muted-foreground">—</span>}
        </p>
        {hint && <p className="text-xs text-muted-foreground font-mono mt-0.5">{hint}</p>}
      </div>
      {copyable && value && (
        <button
          type="button"
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-muted"
          aria-label={`Copiar ${label}`}
        >
          <Copy className="size-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
