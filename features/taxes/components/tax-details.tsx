"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Receipt,
  Calendar,
  Clock,
  Building2,
  FileText,
  Layers,
  AlertCircle,
  Tag,
  Hash,
  CalendarClock,
  CalendarDays,
  Repeat,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Pencil,
  Copy,
  Scale,
  User,
  History,
} from "lucide-react"
import type { Tax, Client, TaxRegime, Priority } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS, TAX_SCOPE_LABELS } from "@/lib/types"
import { calculateDueDateFromCompetency, formatDate, isOverdue } from "@/lib/date-utils"
import { toast } from "sonner"

const RECURRENCE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Personalizada",
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "border-blue-500 text-blue-700 dark:text-blue-400",
  medium: "border-gray-400 text-gray-700 dark:text-gray-400",
  high: "border-orange-500 text-orange-700 dark:text-orange-400",
  urgent: "border-red-500 text-red-700 dark:text-red-400",
}

const SCOPE_COLORS: Record<string, string> = {
  federal: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  estadual: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  municipal: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
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

type TaxDetailsProps = {
  tax: Tax
  clients: Client[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (tax: Tax) => void
}

export function TaxDetails({ tax, clients, open, onOpenChange, onEdit }: TaxDetailsProps) {
  const client = clients.find((c) => c.id === tax.clientId)
  const calculatedDueDate = calculateDueDateFromCompetency(
    tax.competencyMonth,
    tax.dueDay,
    tax.weekendRule,
    tax.dueMonth,
  )
  const overdue =
    tax.status !== "completed" && calculatedDueDate && isOverdue(calculatedDueDate)
  const effectiveStatus: Tax["status"] = overdue ? "overdue" : tax.status

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
              ? "bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent"
              : effectiveStatus === "completed"
                ? "bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent"
                : effectiveStatus === "in_progress"
                  ? "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent"
                  : "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"
          }`}
        >
          <DialogHeader className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-xl bg-background/80 border flex items-center justify-center shrink-0 shadow-sm">
                <Receipt className="size-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl leading-tight break-words">{tax.name}</DialogTitle>
                {tax.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{tax.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <StatusBadge status={effectiveStatus} completedAt={tax.completedAt} />
                  {tax.scope && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SCOPE_COLORS[tax.scope]}`}
                    >
                      <Layers className="size-3 mr-1" />
                      {TAX_SCOPE_LABELS[tax.scope]}
                    </span>
                  )}
                  {tax.priority && tax.priority !== "medium" && (
                    <Badge variant="outline" className={`gap-1 ${PRIORITY_COLORS[tax.priority]}`}>
                      <AlertCircle className="size-3" />
                      {PRIORITY_LABELS[tax.priority]}
                    </Badge>
                  )}
                  {tax.recurrence && (
                    <Badge variant="secondary" className="gap-1">
                      <Repeat className="size-3" />
                      {RECURRENCE_LABELS[tax.recurrence] || tax.recurrence}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Cliente */}
          <Section title="Empresa" icon={<Building2 className="size-4" />}>
            <InfoTile
              icon={<Building2 className="size-4" />}
              label="Empresa"
              value={client?.name || "—"}
              hint={client?.cnpj}
              wide
            />
          </Section>

          <Separator />

          {/* Vencimento e competência */}
          <Section title="Vencimento e Competência" icon={<Calendar className="size-4" />}>
            <InfoTile
              icon={<Calendar className="size-4" />}
              label="Próximo vencimento"
              value={calculatedDueDate ? formatDate(calculatedDueDate) : "—"}
              mono
              highlight={overdue ? "destructive" : undefined}
            />
            <InfoTile
              icon={<CalendarDays className="size-4" />}
              label="Competência"
              value={formatCompetency(tax.competencyMonth)}
            />
            {tax.dueDay && (
              <InfoTile icon={<Hash className="size-4" />} label="Dia do vencimento" value={`Dia ${tax.dueDay}`} />
            )}
            {tax.dueMonth && (
              <InfoTile
                icon={<CalendarDays className="size-4" />}
                label="Mês fixo"
                value={MONTH_LABELS[tax.dueMonth - 1] || `Mês ${tax.dueMonth}`}
              />
            )}
          </Section>

          {/* Regimes aplicáveis */}
          {tax.applicableRegimes && tax.applicableRegimes.length > 0 && (
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
                  {tax.applicableRegimes.map((r) => (
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
          {(tax.protocol || tax.assignedTo) && (
            <>
              <Separator />
              <Section title="Protocolo e responsável" icon={<User className="size-4" />}>
                {tax.protocol && (
                  <InfoTile
                    icon={<Hash className="size-4" />}
                    label="Protocolo"
                    value={tax.protocol}
                    mono
                    copyable
                    onCopy={() => handleCopy("Protocolo", tax.protocol)}
                  />
                )}
                {tax.assignedTo && (
                  <InfoTile icon={<User className="size-4" />} label="Responsável" value={tax.assignedTo} />
                )}
              </Section>
            </>
          )}

          {/* Tags */}
          {tax.tags && tax.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tax.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Observações */}
          {tax.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Observações</p>
                </div>
                <div className="rounded-lg bg-muted/40 border px-3 py-2.5">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tax.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Histórico */}
          {tax.history && tax.history.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Histórico</p>
                </div>
                <div className="space-y-3">
                  {tax.history.slice(-5).reverse().map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-sm">
                      <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Criado em <span className="font-medium">{formatDate(tax.createdAt)}</span>
            </div>
            {tax.completedAt && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-green-600" />
                Concluído em <span className="font-medium">{formatDate(tax.completedAt)}</span>
                {tax.completedBy && <span>por {tax.completedBy}</span>}
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
                onEdit(tax)
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

function StatusBadge({ status, completedAt }: { status: Tax["status"]; completedAt?: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="size-3 mr-1" />
          Concluído {completedAt && `em ${formatDate(completedAt)}`}
        </Badge>
      )
    case "in_progress":
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
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
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
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
      ? "border-red-300 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20"
      : highlight === "success"
        ? "border-green-300 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20"
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
