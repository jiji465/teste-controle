"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  CreditCard,
  Calendar,
  Clock,
  Building2,
  FileText,
  Hash,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Pencil,
  Copy,
  User,
  History,
  Tag,
  Receipt,
  AlertCircle,
  Layers,
} from "lucide-react"
import type { Installment, Client, Tax, Priority } from "@/lib/types"
import { adjustForWeekend, buildSafeDate, formatDate, isOverdue } from "@/lib/date-utils"
import { toast } from "sonner"

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

const WEEKEND_LABELS: Record<string, string> = {
  postpone: "Postergar para o próximo dia útil",
  anticipate: "Antecipar para o dia útil anterior",
  keep: "Manter na data original",
}

type InstallmentDetailsProps = {
  installment: Installment
  clients: Client[]
  taxes: Tax[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (installment: Installment) => void
}

export function InstallmentDetails({
  installment,
  clients,
  taxes,
  open,
  onOpenChange,
  onEdit,
}: InstallmentDetailsProps) {
  const client = clients.find((c) => c.id === installment.clientId)
  const tax = installment.taxId ? taxes.find((t) => t.id === installment.taxId) : undefined

  const calcDueDate = (() => {
    const firstDue = new Date(installment.firstDueDate)
    const monthsToAdd = installment.currentInstallment - 1
    const dueDate = buildSafeDate(
      firstDue.getFullYear(),
      firstDue.getMonth() + monthsToAdd,
      installment.dueDay,
    )
    return adjustForWeekend(dueDate, installment.weekendRule)
  })()

  const overdue = installment.status !== "completed" && isOverdue(calcDueDate)
  const effectiveStatus = overdue ? "overdue" : installment.status
  const progress = Math.min(
    100,
    Math.round(((installment.currentInstallment - 1) / Math.max(1, installment.installmentCount)) * 100),
  )
  const remaining = Math.max(0, installment.installmentCount - installment.currentInstallment + 1)

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
                <CreditCard className="size-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl leading-tight break-words">{installment.name}</DialogTitle>
                {installment.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{installment.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <StatusBadge status={effectiveStatus} completedAt={installment.completedAt} />
                  {installment.priority && installment.priority !== "medium" && (
                    <Badge variant="outline" className={`gap-1 ${PRIORITY_COLORS[installment.priority]}`}>
                      <AlertCircle className="size-3" />
                      {PRIORITY_LABELS[installment.priority]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="rounded-lg bg-background/70 border px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Progresso
                </p>
                <span className="text-xs font-medium tabular-nums">
                  {installment.currentInstallment - 1}/{installment.installmentCount} pagas
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {remaining > 0
                  ? `Faltam ${remaining} parcela${remaining !== 1 ? "s" : ""} · próxima é a parcela ${installment.currentInstallment}/${installment.installmentCount}`
                  : "Todas as parcelas pagas"}
              </p>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Empresa & imposto */}
          <Section title="Empresa & imposto" icon={<Building2 className="size-4" />}>
            <InfoTile
              icon={<Building2 className="size-4" />}
              label="Empresa"
              value={client?.name || "—"}
              hint={client?.cnpj}
              wide
            />
            {tax && (
              <InfoTile
                icon={<Receipt className="size-4" />}
                label="Imposto vinculado"
                value={tax.name}
                wide
              />
            )}
          </Section>

          <Separator />

          {/* Vencimento */}
          <Section title="Vencimento" icon={<Calendar className="size-4" />}>
            <InfoTile
              icon={<Calendar className="size-4" />}
              label="Próxima parcela"
              value={formatDate(calcDueDate)}
              mono
              highlight={overdue ? "destructive" : undefined}
            />
            <InfoTile
              icon={<CalendarDays className="size-4" />}
              label="1º vencimento"
              value={formatDate(installment.firstDueDate)}
              mono
            />
            <InfoTile icon={<Hash className="size-4" />} label="Dia do vencimento" value={`Dia ${installment.dueDay}`} />
            <InfoTile
              icon={<Layers className="size-4" />}
              label="Parcela atual"
              value={`${installment.currentInstallment}/${installment.installmentCount}`}
            />
            <InfoTile
              icon={<CalendarClock className="size-4" />}
              label="Fim de semana / feriado"
              value={WEEKEND_LABELS[installment.weekendRule] || installment.weekendRule}
              wide
            />
          </Section>

          {/* Protocolo / responsável */}
          {(installment.protocol || installment.assignedTo) && (
            <>
              <Separator />
              <Section title="Protocolo e responsável" icon={<User className="size-4" />}>
                {installment.protocol && (
                  <InfoTile
                    icon={<Hash className="size-4" />}
                    label="Protocolo"
                    value={installment.protocol}
                    mono
                    copyable
                    onCopy={() => handleCopy("Protocolo", installment.protocol)}
                  />
                )}
                {installment.assignedTo && (
                  <InfoTile icon={<User className="size-4" />} label="Responsável" value={installment.assignedTo} />
                )}
              </Section>
            </>
          )}

          {/* Tags */}
          {installment.tags && installment.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {installment.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Observações */}
          {installment.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Observações</p>
                </div>
                <div className="rounded-lg bg-muted/40 border px-3 py-2.5">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{installment.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Histórico */}
          {installment.history && installment.history.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Histórico</p>
                </div>
                <div className="space-y-3">
                  {installment.history.slice(-5).reverse().map((entry) => (
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
              Criado em <span className="font-medium">{formatDate(installment.createdAt)}</span>
            </div>
            {installment.completedAt && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-green-600" />
                Concluído em <span className="font-medium">{formatDate(installment.completedAt)}</span>
                {installment.completedBy && <span>por {installment.completedBy}</span>}
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
                onEdit(installment)
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
        <Badge className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="size-3 mr-1" />
          Concluída {completedAt && `em ${formatDate(completedAt)}`}
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
