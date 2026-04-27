"use client"

/**
 * Botões rápidos das linhas/cards de parcelamentos.
 *
 * Mostra a ação MAIS URGENTE pra esse parcelamento:
 *  - Se há parcelas enviadas mas não pagas → "Confirmar pagamento X/N"
 *    (sempre da mais antiga, prioriza atrasadas)
 *  - Se há próxima parcela a enviar → "Marcar X/N enviada"
 *
 * Ambos podem aparecer ao mesmo tempo (ex: parcela 1 enviada e atrasada,
 * parcela 2 ainda não enviada — botão "Confirmar 1" + "Marcar 2 enviada").
 *
 * Em modo `compact` (cards mobile), mostra também Editar/Excluir.
 */

import { Button } from "@/components/ui/button"
import { CheckCircle2, Send, Pencil, Trash2 } from "lucide-react"
import type { Installment } from "@/lib/types"

type Props = {
  installment: Installment
  /** Status efetivo do parcelamento todo (pra esconder ações em concluídos). */
  status: "pending" | "in_progress" | "completed" | "overdue"
  onMarkAsSent: (installment: Installment) => void | Promise<void>
  onConfirmPayment: (installment: Installment, parcelNumber: number) => void | Promise<void>
  onEdit?: (installment: Installment) => void
  onDelete?: (id: string) => void
  /** Mode compacto pra cards mobile — inclui editar/excluir e usa h-7. */
  compact?: boolean
}

export function InstallmentQuickActions({
  installment,
  status,
  onMarkAsSent,
  onConfirmPayment,
  onEdit,
  onDelete,
  compact,
}: Props) {
  const records = installment.paidInstallments ?? []

  // Parcela enviada mais antiga sem pagamento (essa é a mais urgente).
  // Atrasadas naturalmente caem aqui porque sentAt vem antes na ordem.
  const oldestUnpaid = [...records]
    .filter((r) => r.sentAt && !r.paidAt)
    .sort((a, b) => a.number - b.number)[0]

  // Próxima a enviar: parcela atual ainda sem record de envio
  const currentRecord = records.find((r) => r.number === installment.currentInstallment)
  const canSendNext =
    status !== "completed" &&
    installment.currentInstallment <= installment.installmentCount &&
    !currentRecord?.sentAt

  const btnSize = compact ? "h-7 text-xs gap-1" : "h-7 text-xs"
  const wrapperClass = compact
    ? "ml-6 flex flex-wrap gap-1.5"
    : "flex gap-1 flex-wrap"

  return (
    <div className={wrapperClass} onClick={(e) => e.stopPropagation()}>
      {oldestUnpaid && (
        <Button
          size="sm"
          variant="default"
          onClick={() => onConfirmPayment(installment, oldestUnpaid.number)}
          className={`${btnSize} bg-green-600 hover:bg-green-700`}
          title={`Confirmar que o cliente pagou a parcela ${oldestUnpaid.number}/${installment.installmentCount}`}
        >
          <CheckCircle2 className="size-3 mr-1" />
          Confirmar pgto {oldestUnpaid.number}/{installment.installmentCount}
        </Button>
      )}
      {canSendNext && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMarkAsSent(installment)}
          className={`${btnSize} border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30`}
          title={`Marca a parcela ${installment.currentInstallment}/${installment.installmentCount} como enviada ao cliente. Avança pra próxima a preparar.`}
        >
          <Send className="size-3 mr-1" />
          Marcar {installment.currentInstallment}/{installment.installmentCount} enviada
        </Button>
      )}
      {compact && onEdit && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(installment)}
          className="h-7 text-xs gap-1"
        >
          <Pencil className="h-3 w-3" /> Editar
        </Button>
      )}
      {compact && onDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(installment.id)}
          className="h-7 text-xs gap-1 text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
