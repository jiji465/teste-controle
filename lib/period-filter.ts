import type { Installment } from "./types"
import { parseLocalDate } from "./date-utils"
import { getParcelaDueDate } from "./installment-dates"

/**
 * Filtro por período (PeriodSwitcher do topo) com "arrasto" de atrasados.
 *
 * Com o mês ATUAL selecionado, itens NÃO concluídos que venceram em meses
 * anteriores continuam aparecendo (na lista, no cartão "Atrasadas" e nas
 * contagens) — antes sumiam na virada do mês e o atraso ficava invisível.
 * Meses passados/futuros mostram só o próprio mês.
 */

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function isInPeriodWithCarryOver(
  date: string | Date | null | undefined,
  status: string,
  period: string,
  today: Date = new Date(),
): boolean {
  if (period === "all") return true
  if (!date) return true
  const d = parseLocalDate(date)
  if (Number.isNaN(d.getTime())) return true
  const month = ym(d)
  if (month === period) return true
  const current = ym(today)
  return period === current && status !== "completed" && month < current
}

const isParcelaDone = (inst: Installment, n: number) =>
  (inst.paidInstallments ?? []).some((p) => p.number === n && (p.paidAt || p.sentAt))

/**
 * Qual parcela representa o parcelamento no período:
 * - "all": a parcela atual;
 * - mês atual: a 1ª parcela NÃO paga vencida em mês anterior (atraso
 *   arrastado), senão a parcela do mês;
 * - outro mês: a parcela que vence nele.
 * null = o parcelamento não aparece no período.
 */
export function installmentParcelaForPeriod(
  inst: Installment,
  period: string,
  today: Date = new Date(),
): { number: number; dueDate: Date } | null {
  if (period === "all") {
    return { number: inst.currentInstallment, dueDate: getParcelaDueDate(inst, inst.currentInstallment) }
  }
  const current = ym(today)
  if (period === current && inst.status !== "completed") {
    for (let n = 1; n <= inst.installmentCount; n++) {
      const due = getParcelaDueDate(inst, n)
      if (ym(due) >= current) break
      if (!isParcelaDone(inst, n)) return { number: n, dueDate: due }
    }
  }
  for (let n = 1; n <= inst.installmentCount; n++) {
    const due = getParcelaDueDate(inst, n)
    if (ym(due) === period) return { number: n, dueDate: due }
  }
  return null
}
