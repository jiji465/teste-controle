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
