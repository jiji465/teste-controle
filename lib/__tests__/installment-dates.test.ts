import { describe, expect, it } from "vitest"
import { firstDueFromCurrentParcela, getParcelaDueDate, previewParcelaDue } from "../installment-dates"
import { toLocalDateString } from "../date-utils"

const ymd = (d: Date | null | undefined) => (d ? toLocalDateString(d) : null)

describe("parcela 1 = data digitada (bug 7)", () => {
  it("parcela 1 é o firstDueDate mesmo com dueDay diferente; as seguintes usam o dueDay", () => {
    const inst = { firstDueDate: "2026-01-31", dueDay: 10, weekendRule: "keep" as const }
    expect(ymd(getParcelaDueDate(inst, 1))).toBe("2026-01-31")
    expect(ymd(getParcelaDueDate(inst, 2))).toBe("2026-02-10")
  })

  it("parcela 1 recebe o ajuste de fim de semana", () => {
    // 31/01/2026 = sábado
    expect(ymd(getParcelaDueDate({ firstDueDate: "2026-01-31", dueDay: 31, weekendRule: "postpone" }, 1))).toBe("2026-02-02")
  })
})

describe("atalho 'Calcular parcela 1' + prévia (bug 7)", () => {
  it("atalho devolve a data da parcela 1 E o dia de vencimento", () => {
    expect(firstDueFromCurrentParcela("2026-06-25", 6)).toEqual({ firstDueDate: "2026-01-25", dueDay: 25 })
    expect(firstDueFromCurrentParcela("2026-06-05", 6)).toEqual({ firstDueDate: "2026-01-05", dueDay: 5 })
    expect(firstDueFromCurrentParcela("lixo", 6)).toBeNull()
  })

  it("prévia == cronograma salvo (mesma função)", () => {
    const { firstDueDate, dueDay } = firstDueFromCurrentParcela("2026-06-25", 6)!
    const values = { firstDueDate, dueDay, weekendRule: "postpone" as const, currentInstallment: 6, installmentCount: 24 }
    const prev = previewParcelaDue(values)
    expect(ymd(prev?.date)).toBe("2026-06-25")
    expect(ymd(prev?.date)).toBe(ymd(getParcelaDueDate(values, 6)))
  })

  it("prévia usa o 'Dia do vencimento' salvo, não o dia do 1º vencimento", () => {
    const values = { firstDueDate: "2026-01-15", dueDay: 20, weekendRule: "postpone" as const, currentInstallment: 3, installmentCount: 10 }
    expect(ymd(previewParcelaDue(values)?.date)).toBe("2026-03-20")
  })

  it("prévia some com dados inválidos", () => {
    expect(previewParcelaDue({ firstDueDate: "", dueDay: 10, weekendRule: "keep", currentInstallment: 1, installmentCount: 1 })).toBeNull()
    expect(previewParcelaDue({ firstDueDate: "2026-01-10", dueDay: 10, weekendRule: "keep", currentInstallment: 5, installmentCount: 3 })).toBeNull()
  })
})
