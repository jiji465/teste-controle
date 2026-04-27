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
  ListChecks,
  RotateCcw,
  Circle,
  Send,
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
  /** Atalho "envia + paga" da parcela atual (1 clique = guia mandada e cliente pagou). */
  onPay?: (installment: Installment) => void | Promise<void>
  /** "Marquei pronto" — guia mandada ao cliente, mas pagamento ainda não confirmado. */
  onMarkAsSent?: (installment: Installment) => void | Promise<void>
  /** Cliente pagou a parcela X — confirma pagamento. */
  onConfirmPayment?: (installment: Installment, parcelNumber: number) => void | Promise<void>
  /** Desfaz último envio (e seu pagamento, se houver). */
  onUndoLastPayment?: (installment: Installment) => void | Promise<void>
}

export function InstallmentDetails({
  installment,
  clients,
  taxes,
  open,
  onOpenChange,
  onEdit,
  onPay,
  onMarkAsSent,
  onConfirmPayment,
  onUndoLastPayment,
}: InstallmentDetailsProps) {
  const client = clients.find((c) => c.id === installment.clientId)
  const tax = installment.taxId ? taxes.find((t) => t.id === installment.taxId) : undefined

  /** Calcula a data de vencimento de uma parcela específica (1..N) com base
   *  na 1ª data + (N-1) meses. Aplica a regra de fim de semana/feriado. */
  const dueDateFor = (parcelaNumber: number): Date => {
    const firstDue = new Date(installment.firstDueDate)
    const monthsToAdd = parcelaNumber - 1
    const dueDate = buildSafeDate(
      firstDue.getFullYear(),
      firstDue.getMonth() + monthsToAdd,
      installment.dueDay,
    )
    return adjustForWeekend(dueDate, installment.weekendRule)
  }

  const calcDueDate = dueDateFor(installment.currentInstallment)
  const overdue = installment.status !== "completed" && isOverdue(calcDueDate)
  const effectiveStatus = overdue ? "overdue" : installment.status

  // Progresso baseado em parcelas EFETIVAMENTE pagas (com paidAt).
  // O array paidInstallments agora pode conter parcelas só enviadas
  // (sentAt) sem pagamento — essas NÃO contam pra "pagas".
  const paidList = installment.paidInstallments ?? []
  const paidCount = paidList.filter((p) => !!p.paidAt).length
  const sentNotPaidCount = paidList.filter((p) => !!p.sentAt && !p.paidAt).length
  const progress = Math.min(
    100,
    Math.round((paidCount / Math.max(1, installment.installmentCount)) * 100),
  )
  const remaining = Math.max(0, installment.installmentCount - paidCount)
  const allPaid = paidCount >= installment.installmentCount

  // Detecta estado inconsistente: parcelamento marcado como concluído
  // (status=completed ou completedAt) MAS nenhuma parcela foi efetivamente
  // paga. Acontece com registros antigos, antes do fix de auto-avanço,
  // quando "Concluir" fechava o plano todo na 1ª parcela. O usuário precisa
  // recadastrar pra normalizar.
  const isInconsistentState =
    (installment.status === "completed" || !!installment.completedAt) &&
    paidCount === 0

  // Mapa { number → paidAt } pra busca rápida na renderização da lista
  const paidByNumber = new Map(paidList.map((p) => [p.number, p]))

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
                  {paidCount}/{installment.installmentCount} pagas
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {remaining > 0
                  ? `Faltam ${remaining} parcela${remaining !== 1 ? "s" : ""} · próxima é a parcela ${installment.currentInstallment}/${installment.installmentCount}`
                  : "Todas as parcelas pagas"}
              </p>
            </div>

            {/* Ações rápidas no header — fluxo de 2 etapas:
                1. "Marcar enviada" da parcela atual (azul, tipo "minha parte está feita")
                2. "Atalho: enviada + paga" pra quem sabe que cliente pagou na hora
                Os botões contextuais da linha do cronograma cobrem o resto. */}
            {!allPaid && (
              <div className="flex items-center gap-2 flex-wrap">
                {onMarkAsSent &&
                  installment.currentInstallment <= installment.installmentCount &&
                  !paidByNumber.get(installment.currentInstallment)?.sentAt && (
                    <Button
                      onClick={() => onMarkAsSent(installment)}
                      variant="outline"
                      className="flex-1 gap-2 border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                    >
                      <Send className="size-4" />
                      Marcar {installment.currentInstallment}/{installment.installmentCount} enviada
                    </Button>
                  )}
                {onPay &&
                  installment.currentInstallment <= installment.installmentCount &&
                  !paidByNumber.get(installment.currentInstallment)?.sentAt && (
                    <Button
                      onClick={() => onPay(installment)}
                      className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                      title="Atalho: marca como enviada e paga em um clique"
                    >
                      <CheckCircle2 className="size-4" />
                      Atalho: enviada + paga
                    </Button>
                  )}
                {paidCount > 0 && onUndoLastPayment && (
                  <Button
                    variant="outline"
                    onClick={() => onUndoLastPayment(installment)}
                    className="gap-2"
                    title="Desfazer último envio"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Aviso de estado inconsistente */}
          {isInconsistentState && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Estado inconsistente detectado
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-200/80 mt-1">
                    Esse parcelamento está marcado como concluído mas nenhuma
                    parcela foi efetivamente paga. Provavelmente foi criado
                    antes da correção do botão de pagamento. Recomendamos
                    apagar e recadastrar pra normalizar.
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {/* Cronograma completo das parcelas */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ListChecks className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cronograma de parcelas
              </p>
            </div>
            <ul className="rounded-lg border divide-y divide-border overflow-hidden">
              {Array.from({ length: installment.installmentCount }, (_, i) => i + 1).map(
                (n) => {
                  const due = dueDateFor(n)
                  const record = paidByNumber.get(n)
                  // 4 estados visuais:
                  //  - PAID: tem paidAt → ✅ verde
                  //  - SENT_OVERDUE: enviada, sem pagamento, vencida → ⚠️ vermelho
                  //  - SENT: enviada, sem pagamento, no prazo → 📧 azul
                  //  - PENDING: parcela atual, ainda não enviada → ⏳ âmbar
                  //  - FUTURE: ainda não chegou a vez → ⚪ cinza
                  const isPaid = !!record?.paidAt
                  const isSent = !!record?.sentAt && !record.paidAt
                  const isOverdueSent = isSent && isOverdue(due)
                  const isCurrentToSend =
                    !record &&
                    n === installment.currentInstallment &&
                    !allPaid
                  const isFuture =
                    !record && n !== installment.currentInstallment

                  const rowBg = isPaid
                    ? "bg-green-50/50 dark:bg-green-950/10"
                    : isOverdueSent
                      ? "bg-red-50/60 dark:bg-red-950/20"
                      : isSent
                        ? "bg-blue-50/50 dark:bg-blue-950/10"
                        : isCurrentToSend
                          ? "bg-amber-50/50 dark:bg-amber-950/10"
                          : ""

                  return (
                    <li
                      key={n}
                      className={`flex items-center gap-3 px-3 py-2 text-sm flex-wrap ${rowBg}`}
                    >
                      <span className="shrink-0">
                        {isPaid ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : isOverdueSent ? (
                          <AlertTriangle className="size-4 text-red-600" />
                        ) : isSent ? (
                          <Send className="size-4 text-blue-600" />
                        ) : isCurrentToSend ? (
                          <Clock className="size-4 text-amber-600" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground/40" />
                        )}
                      </span>
                      <span className="font-mono text-xs tabular-nums w-14 shrink-0">
                        {n}/{installment.installmentCount}
                      </span>
                      <span className="font-mono text-xs tabular-nums w-24 shrink-0 text-muted-foreground">
                        {formatDate(due)}
                      </span>
                      <span className="flex-1 min-w-0 text-xs">
                        {isPaid && record?.paidAt ? (
                          <span className="text-green-700 dark:text-green-400 truncate block">
                            Paga em {formatDate(record.paidAt)}
                            {record.paidBy && ` por ${record.paidBy}`}
                          </span>
                        ) : isOverdueSent ? (
                          <span className="text-red-700 dark:text-red-400 font-medium">
                            Atrasada — enviada em {formatDate(record!.sentAt!)} sem pagamento
                          </span>
                        ) : isSent ? (
                          <span className="text-blue-700 dark:text-blue-400">
                            Enviada em {formatDate(record!.sentAt!)} — aguardando pagamento
                          </span>
                        ) : isCurrentToSend ? (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            Próxima a enviar
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">A vencer</span>
                        )}
                      </span>
                      {/* Botões contextuais por linha */}
                      <div className="flex gap-1 shrink-0">
                        {isCurrentToSend && onMarkAsSent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onMarkAsSent(installment)}
                            className="h-7 text-[11px] gap-1 border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                          >
                            <Send className="size-3" /> Enviada
                          </Button>
                        )}
                        {(isSent || isOverdueSent) && onConfirmPayment && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onConfirmPayment(installment, n)}
                            className="h-7 text-[11px] gap-1 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="size-3" /> Confirmar pgto
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                },
              )}
            </ul>
          </div>

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
              // Mostra a data CALCULADA da parcela 1 (mesmo cálculo usado no
              // resto do app), não o valor cru de firstDueDate. Evita divergência
              // visual quando dueDay e o dia de firstDueDate não coincidem.
              value={formatDate(dueDateFor(1))}
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
