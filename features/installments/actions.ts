/**
 * Lógica central de pagamento de parcela.
 *
 * Por que separar daqui em vez de inline na página:
 * - O fluxo "marcar parcela X paga" é chamado de 4+ lugares (botão lista
 *   desktop, lista mobile, card de detalhes, ação em lote). Centralizando,
 *   um bug ou regra nova só precisa ser corrigido em um lugar.
 * - O contador é exigente: se a regra de avanço de parcela tiver bug, ele
 *   pode marcar errado e bagunçar o controle do cliente. Um helper testável
 *   reduz superfície de erro.
 *
 * Regra principal:
 *   currentInstallment é "qual é a próxima a pagar". Quando o usuário
 *   clica "Pagar parcela X/N":
 *     - Adiciona { number: X, paidAt: agora } em paidInstallments
 *     - Se X < N: avança currentInstallment +1, status volta pra "pending"
 *       (porque agora a próxima é X+1, ainda a pagar)
 *     - Se X == N: marca o parcelamento INTEIRO como concluído
 *       (status="completed", completedAt=agora)
 */

import type { Installment, PaidInstallment } from "@/lib/types"

export type PayInstallmentResult = {
  /** O Installment com o estado atualizado pós-pagamento. */
  updated: Installment
  /** True se este pagamento finalizou o parcelamento todo. */
  isFinalPayment: boolean
  /** Número da parcela paga (igual a currentInstallment de entrada). */
  paidNumber: number
}

/**
 * Marca a parcela ATUAL como paga e retorna o Installment atualizado.
 * Não persiste — quem chama é responsável por chamar saveInstallment.
 *
 * Idempotência: se a parcela atual já estiver registrada como paga em
 * paidInstallments (caso raro de double-click), o helper não duplica o
 * registro mas ainda avança normalmente.
 */
export function payCurrentInstallment(
  installment: Installment,
  paidBy = "Contador",
  now: Date = new Date(),
): PayInstallmentResult {
  const paidNumber = installment.currentInstallment
  const isFinalPayment = paidNumber >= installment.installmentCount
  const nowIso = now.toISOString()

  const existing = installment.paidInstallments ?? []
  const alreadyLogged = existing.some((p) => p.number === paidNumber)
  const newEntry: PaidInstallment = {
    number: paidNumber,
    paidAt: nowIso,
    paidBy,
  }
  const paidInstallments = alreadyLogged ? existing : [...existing, newEntry]

  const historyEntry = {
    id: crypto.randomUUID(),
    action: "completed" as const,
    description: isFinalPayment
      ? `Parcela ${paidNumber}/${installment.installmentCount} paga — parcelamento concluído`
      : `Parcela ${paidNumber}/${installment.installmentCount} paga`,
    timestamp: nowIso,
    user: paidBy,
  }

  if (isFinalPayment) {
    return {
      updated: {
        ...installment,
        status: "completed",
        completedAt: nowIso,
        completedBy: paidBy,
        paidInstallments,
        history: [...(installment.history ?? []), historyEntry],
      },
      isFinalPayment: true,
      paidNumber,
    }
  }

  return {
    updated: {
      ...installment,
      currentInstallment: paidNumber + 1,
      status: "pending",
      // Limpa marcadores de "concluído" — o parcelamento como um todo
      // não está concluído, só avançou.
      completedAt: undefined,
      completedBy: undefined,
      paidInstallments,
      history: [...(installment.history ?? []), historyEntry],
    },
    isFinalPayment: false,
    paidNumber,
  }
}

/**
 * Desfaz o último pagamento (volta uma parcela).
 * Útil quando o usuário marca paga por engano.
 */
export function undoLastPayment(
  installment: Installment,
  now: Date = new Date(),
): Installment {
  const paid = installment.paidInstallments ?? []
  if (paid.length === 0) return installment

  // Remove o último pagamento (maior number)
  const sorted = [...paid].sort((a, b) => a.number - b.number)
  const last = sorted[sorted.length - 1]
  const remaining = sorted.slice(0, -1)

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
        description: `Pagamento da parcela ${last.number}/${installment.installmentCount} desfeito`,
        timestamp: now.toISOString(),
      },
    ],
  }
}
