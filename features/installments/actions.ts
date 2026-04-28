/**
 * Lógica central de manipulação de parcelas.
 *
 * Modelo de duas etapas (separa "minha parte" de "pagamento do cliente"):
 *
 *   Pendente → [Marcar enviada] → Enviada → [Confirmar pagamento] → Paga
 *                                       ↑
 *                                  Pode virar Atrasada se passar do
 *                                  vencimento e ainda não tiver paidAt.
 *
 *   currentInstallment = "próxima parcela a ENVIAR"
 *
 * Quando o usuário "Marca enviada" a parcela atual:
 *   - Adiciona/atualiza record com sentAt = agora
 *   - currentInstallment avança +1 (próxima a enviar)
 *   - Status do parcelamento permanece como "pending" até todas pagas
 *
 * Quando o usuário "Confirma pagamento" da parcela X:
 *   - Atualiza record com paidAt = agora
 *   - currentInstallment NÃO MUDA (envio é independente do pagamento)
 *   - Se ALL parcelas têm paidAt → marca parcelamento todo como completed
 *
 * Por que separar daqui em vez de inline na página:
 * - O fluxo é chamado de muitos lugares (lista desktop/mobile, card de
 *   detalhes, ação em lote). Centralizar evita divergência.
 * - Lógica fiscal sensível: erros aqui bagunçam o controle do cliente.
 */

import type { Installment, PaidInstallment } from "@/lib/types"

// ─── Helpers internos ─────────────────────────────────────────────────────

function nowIso(now: Date = new Date()): string {
  return now.toISOString()
}

function findOrCreateRecord(
  records: PaidInstallment[],
  number: number,
): { records: PaidInstallment[]; index: number } {
  const idx = records.findIndex((r) => r.number === number)
  if (idx >= 0) return { records: [...records], index: idx }
  const newRecords = [...records, { number }]
  return { records: newRecords, index: newRecords.length - 1 }
}

function allParcelasPaid(installment: Installment, records: PaidInstallment[]): boolean {
  if (records.length < installment.installmentCount) return false
  for (let n = 1; n <= installment.installmentCount; n++) {
    const r = records.find((x) => x.number === n)
    if (!r || !r.paidAt) return false
  }
  return true
}

// ─── Action: Marcar parcela atual como ENVIADA ────────────────────────────

export type MarkAsSentResult = {
  updated: Installment
  /** Número da parcela que foi marcada como enviada. */
  sentNumber: number
  /** Se true, era a última parcela a enviar (não significa que o parcelamento
   *  está concluído — concluído só quando todas estiverem PAGAS). */
  isLastSent: boolean
}

export function markCurrentInstallmentAsSent(
  installment: Installment,
  sentBy = "Contador",
  now: Date = new Date(),
): MarkAsSentResult {
  const sentNumber = installment.currentInstallment
  const ts = nowIso(now)
  const isLastSent = sentNumber >= installment.installmentCount

  const existing = installment.paidInstallments ?? []
  const { records, index } = findOrCreateRecord(existing, sentNumber)
  records[index] = {
    ...records[index],
    sentAt: records[index].sentAt ?? ts,
    sentBy: records[index].sentBy ?? sentBy,
  }

  const historyEntry = {
    id: crypto.randomUUID(),
    action: "status_changed" as const,
    description: `Parcela ${sentNumber}/${installment.installmentCount} marcada como enviada`,
    timestamp: ts,
    user: sentBy,
  }

  return {
    updated: {
      ...installment,
      // currentInstallment vira a próxima a ENVIAR. Se já era a última,
      // permanece nela (não há "próxima" pra enviar).
      currentInstallment: isLastSent
        ? installment.currentInstallment
        : sentNumber + 1,
      // Preserva o status atual ("pending" ou "in_progress"). Só forçamos
      // pra "pending" quando estava "completed" por engano (estado
      // inconsistente), porque o parcelamento todo só vira "completed"
      // quando todas as parcelas têm paidAt.
      status: installment.status === "completed" ? "pending" : installment.status,
      completedAt:
        installment.status === "completed" ? undefined : installment.completedAt,
      completedBy:
        installment.status === "completed" ? undefined : installment.completedBy,
      paidInstallments: records,
      history: [...(installment.history ?? []), historyEntry],
    },
    sentNumber,
    isLastSent,
  }
}

// ─── Action: Confirmar PAGAMENTO de uma parcela específica ────────────────

export type ConfirmPaymentResult = {
  updated: Installment
  paidNumber: number
  /** Se true, todas as parcelas estão pagas — parcelamento foi finalizado. */
  isFullyPaid: boolean
}

export function confirmInstallmentPayment(
  installment: Installment,
  parcelNumber: number,
  paidBy = "Contador",
  now: Date = new Date(),
): ConfirmPaymentResult {
  const ts = nowIso(now)
  const existing = installment.paidInstallments ?? []
  const { records, index } = findOrCreateRecord(existing, parcelNumber)
  records[index] = {
    ...records[index],
    // Se ainda não tinha sido marcada como enviada, marca agora também
    // (paga implicitamente significa que foi enviada).
    sentAt: records[index].sentAt ?? ts,
    sentBy: records[index].sentBy ?? paidBy,
    paidAt: ts,
    paidBy,
  }

  const fullyPaid = allParcelasPaid(installment, records)

  const historyEntry = {
    id: crypto.randomUUID(),
    action: "completed" as const,
    description: fullyPaid
      ? `Parcela ${parcelNumber}/${installment.installmentCount} paga — parcelamento concluído`
      : `Parcela ${parcelNumber}/${installment.installmentCount} paga`,
    timestamp: ts,
    user: paidBy,
  }

  // currentInstallment fica como está (envio é independente de pagamento).
  // Só ajustamos status do parcelamento todo quando totalmente pago.
  return {
    updated: {
      ...installment,
      ...(fullyPaid
        ? { status: "completed", completedAt: ts, completedBy: paidBy }
        : {}),
      paidInstallments: records,
      history: [...(installment.history ?? []), historyEntry],
    },
    paidNumber: parcelNumber,
    isFullyPaid: fullyPaid,
  }
}

// ─── Action: Atalho "envia + paga" (pra usuários que querem fluxo curto) ──

export type PayInstallmentResult = {
  updated: Installment
  isFinalPayment: boolean
  paidNumber: number
}

/**
 * Marca a parcela atual como ENVIADA E PAGA num único clique.
 * Útil quando o usuário sabe que o cliente já pagou e não quer fazer dois
 * passos (Marcar enviada → Confirmar pagamento).
 *
 * Mantida por compatibilidade com chamadas antigas e como atalho de UX.
 */
export function payCurrentInstallment(
  installment: Installment,
  paidBy = "Contador",
  now: Date = new Date(),
): PayInstallmentResult {
  // Encadeia: marca como enviada (avança currentInstallment) e depois
  // confirma o pagamento da que acabou de ser enviada.
  const sent = markCurrentInstallmentAsSent(installment, paidBy, now)
  const confirmed = confirmInstallmentPayment(
    sent.updated,
    sent.sentNumber,
    paidBy,
    now,
  )
  return {
    updated: confirmed.updated,
    isFinalPayment: confirmed.isFullyPaid,
    paidNumber: confirmed.paidNumber,
  }
}

// ─── Undo ─────────────────────────────────────────────────────────────────

/**
 * Desfaz o pagamento (mas NÃO o envio) de uma parcela específica.
 * Use quando você confirmou pagamento por engano mas a guia foi enviada
 * de fato. A parcela volta pra "Enviada".
 */
export function undoInstallmentPayment(
  installment: Installment,
  parcelNumber: number,
  now: Date = new Date(),
): Installment {
  const records = (installment.paidInstallments ?? []).map((r) =>
    r.number === parcelNumber ? { ...r, paidAt: undefined, paidBy: undefined } : r,
  )
  return {
    ...installment,
    // Se estava marcado como concluído, volta pra pending
    status: installment.status === "completed" ? "pending" : installment.status,
    completedAt: undefined,
    completedBy: undefined,
    paidInstallments: records,
    history: [
      ...(installment.history ?? []),
      {
        id: crypto.randomUUID(),
        action: "status_changed",
        description: `Pagamento da parcela ${parcelNumber}/${installment.installmentCount} desfeito`,
        timestamp: nowIso(now),
      },
    ],
  }
}

/**
 * Desfaz o envio (E o pagamento, se houver) da última parcela enviada.
 * Volta currentInstallment 1 pra trás.
 */
export function undoLastSent(
  installment: Installment,
  now: Date = new Date(),
): Installment {
  const records = installment.paidInstallments ?? []
  if (records.length === 0) return installment

  // Pega o maior number já registrado
  const sorted = [...records].sort((a, b) => a.number - b.number)
  const last = sorted[sorted.length - 1]
  const remaining = records.filter((r) => r.number !== last.number)

  return {
    ...installment,
    currentInstallment: last.number,
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    paidInstallments: remaining,
    history: [
      ...(installment.history ?? []),
      {
        id: crypto.randomUUID(),
        action: "status_changed",
        description: `Envio da parcela ${last.number}/${installment.installmentCount} desfeito`,
        timestamp: nowIso(now),
      },
    ],
  }
}

/**
 * Compatibilidade: alias antigo. Faz o mesmo que `undoLastSent` —
 * desfaz o último envio (e seu pagamento, se houver).
 */
export const undoLastPayment = undoLastSent

// ─── Helpers de status visual ────────────────────────────────────────────

export type ParcelaStatus = "future" | "pending" | "sent" | "paid" | "overdue"

/**
 * Retorna o status efetivo de uma parcela específica.
 *
 * - `paid`: tem paidAt
 * - `overdue`: tem sentAt, sem paidAt, vencimento já passou
 * - `sent`: tem sentAt, sem paidAt, vencimento ainda não passou
 * - `pending`: é a parcela atual (próxima a enviar)
 * - `future`: ainda não chegou a vez dela
 */
export function parcelaStatus(
  installment: Installment,
  parcelNumber: number,
  dueDate: Date,
  today: Date = new Date(),
): ParcelaStatus {
  const records = installment.paidInstallments ?? []
  const record = records.find((r) => r.number === parcelNumber)
  if (record?.paidAt) return "paid"
  if (record?.sentAt) {
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    return dueDate < todayStart ? "overdue" : "sent"
  }
  if (parcelNumber < installment.currentInstallment) {
    // Caso raro: avançou sem registrar — trata como pendente
    return "pending"
  }
  if (parcelNumber === installment.currentInstallment) return "pending"
  return "future"
}
