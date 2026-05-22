/**
 * Lógica central de manipulação de parcelas.
 *
 * Modelo SIMPLIFICADO (uma etapa só):
 *
 *   Pendente → [Concluir parcela] → Concluída → próxima vira atual
 *
 *   currentInstallment = "próxima parcela a concluir"
 *
 * Quando o usuário "Conclui parcela atual":
 *   - Adiciona record com sentAt = agora E paidAt = agora (mesma timestamp)
 *   - currentInstallment avança +1
 *   - Se era a última: status do parcelamento todo vira "completed"
 *
 * Histórico do modelo anterior: existia uma etapa intermediária "Enviada"
 * separada de "Paga". Removida pelo usuário: na prática, contador conclui
 * uma parcela quando o cliente paga — não rastreia o "enviei pro cliente"
 * separadamente. Funções `confirmInstallmentPayment`, `payCurrentInstallment`
 * e `undoInstallmentPayment` mantidas só por compatibilidade com chamadas
 * antigas (caem todas em `markCurrentInstallmentAsSent` agora).
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
  // Guard contra registros antigos com currentInstallment fora do intervalo
  // [1, installmentCount]. Pode acontecer com dados pré-fix de auto-recurrence
  // ou edição manual no banco. Sem essa guarda, geraríamos uma "parcela 13/12"
  // fantasma em paidInstallments que nem aparece no cronograma.
  if (
    installment.currentInstallment < 1 ||
    installment.currentInstallment > installment.installmentCount
  ) {
    throw new Error(
      `Parcela atual (${installment.currentInstallment}) está fora do intervalo válido [1, ${installment.installmentCount}] — registro inconsistente, recadastre.`,
    )
  }

  const sentNumber = installment.currentInstallment
  const ts = nowIso(now)
  const isLastSent = sentNumber >= installment.installmentCount

  const existing = installment.paidInstallments ?? []
  const { records, index } = findOrCreateRecord(existing, sentNumber)
  // Modelo simplificado: enviar = pagar. Setamos os dois timestamps na
  // mesma chamada (compatibilidade com leituras antigas que olham paidAt).
  records[index] = {
    ...records[index],
    sentAt: records[index].sentAt ?? ts,
    sentBy: records[index].sentBy ?? sentBy,
    paidAt: records[index].paidAt ?? ts,
    paidBy: records[index].paidBy ?? sentBy,
  }

  const historyEntry = {
    id: crypto.randomUUID(),
    action: isLastSent ? ("completed" as const) : ("status_changed" as const),
    description: isLastSent
      ? `Parcela ${sentNumber}/${installment.installmentCount} concluída — parcelamento finalizado`
      : `Parcela ${sentNumber}/${installment.installmentCount} concluída`,
    timestamp: ts,
    user: sentBy,
  }

  return {
    updated: {
      ...installment,
      // currentInstallment vira a próxima a concluir. Se era a última,
      // permanece nela (não há "próxima").
      currentInstallment: isLastSent
        ? installment.currentInstallment
        : sentNumber + 1,
      // Última parcela → parcelamento todo concluído. Senão, in_progress.
      status: isLastSent ? "completed" : "in_progress",
      completedAt: isLastSent ? ts : undefined,
      completedBy: isLastSent ? sentBy : undefined,
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

/**
 * @deprecated Modelo de duas etapas removido. Compatível: agora apenas
 * delega a `markCurrentInstallmentAsSent` quando o parcelNumber bate com
 * o currentInstallment. Se for diferente, lança erro (uso antigo).
 */
export function confirmInstallmentPayment(
  installment: Installment,
  parcelNumber: number,
  paidBy = "Contador",
  now: Date = new Date(),
): ConfirmPaymentResult {
  if (parcelNumber !== installment.currentInstallment) {
    // No modelo simplificado só dá pra concluir a parcela atual em ordem.
    // Se quiser desfazer alguma anterior, use undoLastSent/undoInstallmentPayment.
    throw new Error(
      `Modelo simplificado: só dá pra concluir a parcela atual (${installment.currentInstallment}). Pediu ${parcelNumber}.`,
    )
  }
  const sent = markCurrentInstallmentAsSent(installment, paidBy, now)
  return {
    updated: sent.updated,
    paidNumber: sent.sentNumber,
    isFullyPaid: sent.isLastSent,
  }
}

// ─── Action: Atalho "envia + paga" (pra usuários que querem fluxo curto) ──

export type PayInstallmentResult = {
  updated: Installment
  isFinalPayment: boolean
  paidNumber: number
}

/**
 * Conclui a parcela atual (envia + paga + avança em um único passo).
 * Modelo simplificado: é o mesmo que `markCurrentInstallmentAsSent`.
 */
export function payCurrentInstallment(
  installment: Installment,
  paidBy = "Contador",
  now: Date = new Date(),
): PayInstallmentResult {
  const sent = markCurrentInstallmentAsSent(installment, paidBy, now)
  return {
    updated: sent.updated,
    isFinalPayment: sent.isLastSent,
    paidNumber: sent.sentNumber,
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

/**
 * Status visual de uma parcela individual no cronograma.
 *
 * No modelo simplificado:
 *   - `paid`: parcela já concluída (tem paidAt OU sentAt — tratamos como o mesmo)
 *   - `overdue`: ainda não concluída e vencimento já passou
 *   - `pending`: é a parcela atual (próxima a concluir)
 *   - `future`: ainda não chegou a vez
 *
 * O valor `"sent"` continua no type por compatibilidade mas não é mais
 * retornado por esta função (qualquer record com sentAt agora vira "paid").
 */
export type ParcelaStatus = "future" | "pending" | "sent" | "paid" | "overdue"

export function parcelaStatus(
  installment: Installment,
  parcelNumber: number,
  dueDate: Date,
  today: Date = new Date(),
): ParcelaStatus {
  const records = installment.paidInstallments ?? []
  const record = records.find((r) => r.number === parcelNumber)
  // Modelo simplificado: tanto sentAt quanto paidAt indicam parcela concluída.
  if (record?.paidAt || record?.sentAt) return "paid"

  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  if (parcelNumber < installment.currentInstallment) {
    // Avançou sem registrar (dados antigos): trata como pendente/atrasada
    return dueDate < todayStart ? "overdue" : "pending"
  }
  if (parcelNumber === installment.currentInstallment) {
    return dueDate < todayStart ? "overdue" : "pending"
  }
  return "future"
}
