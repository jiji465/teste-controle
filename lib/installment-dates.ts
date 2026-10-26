import type { Installment } from "./types"
import { adjustForWeekend, buildSafeDate, parseLocalDate } from "./date-utils"

/**
 * Vencimento da parcela N (1..installmentCount) de um parcelamento:
 * mês da 1ª parcela + (N-1) meses, no dia `dueDay`, com a regra de fim de
 * semana/feriado aplicada. Fonte única — antes a conta estava copiada em
 * vários arquivos, todos com o bug de fuso (`new Date("YYYY-MM-01")` recuava
 * um mês no Brasil).
 */
export function getParcelaDueDate(
  inst: Pick<Installment, "firstDueDate" | "dueDay" | "weekendRule">,
  parcelNumber: number,
): Date {
  const firstDue = parseLocalDate(inst.firstDueDate)
  const raw = buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (parcelNumber - 1), inst.dueDay)
  return adjustForWeekend(raw, inst.weekendRule)
}

/** Vencimento da parcela ATUAL (a próxima a concluir). */
export function getCurrentParcelaDueDate(
  inst: Pick<Installment, "firstDueDate" | "dueDay" | "weekendRule" | "currentInstallment">,
): Date {
  return getParcelaDueDate(inst, inst.currentInstallment)
}

export type ParcelaStatus = "completed" | "overdue" | "pending"

/** Uma parcela individual de um parcelamento, com o status DELA. */
export type ParcelaInfo = {
  parcelaNumber: number
  dueDate: Date
  status: ParcelaStatus
  /** Quando ficou concluída (paidAt, senão sentAt). */
  doneAt?: string
  /** Quem concluiu (paidBy, senão sentBy). */
  doneBy?: string
}

/**
 * Status da parcela N — mesma regra de /parcelamentos (getParcelaStatus):
 *  - concluída se tem registro com sentAt OU paidAt (ou se o parcelamento
 *    inteiro já está concluído);
 *  - atrasada se não concluída e o vencimento é ANTES de hoje (vence hoje
 *    ainda não é atraso);
 *  - pendente caso contrário.
 */
export function getParcelaInfo(inst: Installment, parcelNumber: number): ParcelaInfo {
  const dueDate = getParcelaDueDate(inst, parcelNumber)
  const record = (inst.paidInstallments ?? []).find((p) => p.number === parcelNumber)
  const recordDone = !!(record?.paidAt || record?.sentAt)
  const isDone = recordDone || inst.status === "completed"
  let status: ParcelaStatus
  if (isDone) status = "completed"
  else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    status = dueDate < today ? "overdue" : "pending"
  }
  return {
    parcelaNumber: parcelNumber,
    dueDate,
    status,
    doneAt: recordDone ? (record?.paidAt ?? record?.sentAt) : isDone ? inst.completedAt : undefined,
    doneBy: recordDone ? (record?.paidBy ?? record?.sentBy) : isDone ? inst.completedBy : undefined,
  }
}

/** Todas as parcelas do parcelamento (opcionalmente só as cujo vencimento
 *  passa no filtro), parcela a parcela, com o status de cada uma. */
export function listParcelas(inst: Installment, include?: (dueDate: Date) => boolean): ParcelaInfo[] {
  const out: ParcelaInfo[] = []
  for (let n = 1; n <= inst.installmentCount; n++) {
    if (include && !include(getParcelaDueDate(inst, n))) continue
    out.push(getParcelaInfo(inst, n))
  }
  return out
}
