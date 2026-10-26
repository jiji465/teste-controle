import { describe, expect, it } from "vitest"
import { countByStatus, filterByStatusTab, statusBucket } from "../obligation-status"
import { installmentParcelaForPeriod, isInPeriodWithCarryOver } from "../period-filter"
import type { Installment } from "../types"

const TODAY = new Date(2026, 9, 26, 10) // 26/10/2026
const yesterday = "2026-10-25"
const nextWeek = "2026-11-02"

describe("cartões de status = lista (effectiveStatus)", () => {
  const items = [
    { id: "a", status: "in_progress", calculatedDueDate: yesterday },
    { id: "b", status: "pending", calculatedDueDate: nextWeek },
    { id: "c", status: "pending", calculatedDueDate: yesterday },
    { id: "d", status: "completed", calculatedDueDate: yesterday },
    { id: "e", status: "in_progress", calculatedDueDate: nextWeek },
  ]

  it("em andamento vencido conta só como atrasado (sem contagem dupla)", () => {
    expect(statusBucket(items[0], TODAY)).toBe("overdue")
    const c = countByStatus(items, TODAY)
    expect(c).toEqual({ all: 5, pending: 1, in_progress: 1, completed: 1, overdue: 2 })
    expect(c.pending + c.in_progress + c.completed + c.overdue).toBe(c.all)
  })

  it("filtro da aba usa a mesma regra do cartão", () => {
    expect(filterByStatusTab(items, "overdue", TODAY).map((i) => i.id)).toEqual(["a", "c"])
    expect(filterByStatusTab(items, "in_progress", TODAY).map((i) => i.id)).toEqual(["e"])
    expect(filterByStatusTab(items, "all", TODAY)).toHaveLength(5)
    expect(filterByStatusTab(items, null, TODAY)).toHaveLength(5)
  })
})

describe("atrasados de meses anteriores aparecem no mês atual", () => {
  it("mês atual: inclui não concluídos vencidos de meses anteriores", () => {
    expect(isInPeriodWithCarryOver("2026-09-20", "pending", "2026-10", TODAY)).toBe(true)
    expect(isInPeriodWithCarryOver("2026-09-20", "in_progress", "2026-10", TODAY)).toBe(true)
    expect(isInPeriodWithCarryOver("2026-09-20", "completed", "2026-10", TODAY)).toBe(false)
    expect(isInPeriodWithCarryOver("2026-10-20", "completed", "2026-10", TODAY)).toBe(true)
    expect(isInPeriodWithCarryOver("2026-11-20", "pending", "2026-10", TODAY)).toBe(false)
  })

  it("outro mês selecionado: só o próprio mês; 'all' mostra tudo", () => {
    expect(isInPeriodWithCarryOver("2026-08-20", "pending", "2026-09", TODAY)).toBe(false)
    expect(isInPeriodWithCarryOver("2026-09-20", "pending", "2026-09", TODAY)).toBe(true)
    expect(isInPeriodWithCarryOver("2020-01-01", "pending", "all", TODAY)).toBe(true)
    expect(isInPeriodWithCarryOver(null, "pending", "2026-10", TODAY)).toBe(true)
  })

  it("parcelamento: parcela atrasada de mês anterior aparece no mês atual", () => {
    const inst: Installment = {
      id: "i", name: "PERT", clientId: "c", installmentCount: 3, currentInstallment: 2, dueDay: 10,
      firstDueDate: "2026-01-10", weekendRule: "keep", status: "in_progress", priority: "medium",
      createdAt: "", autoGenerate: true, recurrence: "monthly", paidInstallments: [{ number: 1, paidAt: "2026-01-10" }],
    }
    // parcelas: jan, fev (não paga), mar — nenhuma em outubro
    expect(installmentParcelaForPeriod(inst, "2026-10", TODAY)?.number).toBe(2)
    expect(installmentParcelaForPeriod(inst, "2026-09", TODAY)).toBeNull()
    expect(installmentParcelaForPeriod(inst, "2026-03", TODAY)?.number).toBe(3)
    expect(installmentParcelaForPeriod(inst, "all", TODAY)?.number).toBe(2)
    const paid = { ...inst, currentInstallment: 3, paidInstallments: [{ number: 1, paidAt: "x" }, { number: 2, paidAt: "x" }, { number: 3, paidAt: "x" }], status: "completed" as const }
    expect(installmentParcelaForPeriod(paid, "2026-10", TODAY)).toBeNull()
  })
})
