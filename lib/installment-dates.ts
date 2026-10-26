import type { Installment, WeekendRule } from "./types"
import { adjustForWeekend, buildSafeDate, parseLocalDate, toLocalDateString } from "./date-utils"

/**
 * Vencimento da parcela N (1..installmentCount) de um parcelamento.
 *
 * - Parcela 1 = exatamente o "Vencimento da parcela 1" digitado (com a regra
 *   de fim de semana/feriado), mesmo que o "Dia do vencimento" seja outro.
 * - Parcelas seguintes: mês da 1ª parcela + (N-1) meses, no dia `dueDay`,
 *   com a regra de fim de semana/feriado aplicada.
 *
 * Fonte única — o cronograma, os alertas e a PRÉVIA do formulário usam esta
 * função (antes a prévia usava o dia do 1º vencimento e divergia do salvo).
 */
export function getParcelaDueDate(
  inst: Pick<Installment, "firstDueDate" | "dueDay" | "weekendRule">,
  parcelNumber: number,
): Date {
  const firstDue = parseLocalDate(inst.firstDueDate)
  const raw =
    parcelNumber <= 1
      ? buildSafeDate(firstDue.getFullYear(), firstDue.getMonth(), firstDue.getDate())
      : buildSafeDate(firstDue.getFullYear(), firstDue.getMonth() + (parcelNumber - 1), inst.dueDay)
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

/**
 * Atalho do formulário "Calcular parcela 1": a partir do vencimento da parcela
 * ATUAL, devolve a data da parcela 1 (retroagindo current-1 meses) E o dia de
 * vencimento — os dois precisam mudar juntos, senão o cronograma salvo usava
 * o dueDay antigo e não batia com a data informada.
 */
export function firstDueFromCurrentParcela(
  currentDueIso: string,
  currentInstallment: number,
): { firstDueDate: string; dueDay: number } | null {
  const m = currentDueIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const current = Math.max(1, Number(currentInstallment) || 1)
  const day = Number(m[3])
  const first = buildSafeDate(Number(m[1]), Number(m[2]) - 1 - (current - 1), day)
  return { firstDueDate: toLocalDateString(first), dueDay: day }
}

/** Prévia "Parcela X/Y vai vencer em…" do formulário — mesma conta do cronograma. */
export function previewParcelaDue(values: {
  firstDueDate?: string
  dueDay?: number | string
  weekendRule?: WeekendRule | string
  currentInstallment?: number | string
  installmentCount?: number | string
}): { current: number; total: number; date: Date; isFirst: boolean } | null {
  if (!values.firstDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(values.firstDueDate)) return null
  const current = Number(values.currentInstallment) || 1
  const total = Number(values.installmentCount) || 1
  if (current < 1 || current > total) return null
  const firstDay = Number(values.firstDueDate.slice(8, 10))
  const dueDay = Number(values.dueDay)
  const date = getParcelaDueDate(
    {
      firstDueDate: values.firstDueDate,
      dueDay: dueDay >= 1 && dueDay <= 31 ? dueDay : firstDay,
      weekendRule: (values.weekendRule as WeekendRule) || "postpone",
    },
    current,
  )
  return { current, total, date, isFirst: current === 1 }
}
