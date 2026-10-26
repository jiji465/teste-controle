import { describe, expect, it } from "vitest"
import type { Obligation } from "../types"
import { duplicateObligationToNextPeriod } from "@/features/obligations/duplicate"

const base: Obligation = {
  id: "o1", name: "EFD", category: "sped", clientId: "c1", dueDay: 15, competencyMonth: "2026-10",
  frequency: "monthly", recurrence: "monthly", autoGenerate: true, weekendRule: "postpone",
  status: "completed", priority: "medium", createdAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-15T00:00:00Z",
  completedBy: "Ana", protocol: "P-1", attachments: ["a.pdf"], realizationDate: "2026-10-15",
  parentObligationId: "m1", generatedFor: "2026-10",
}

describe("duplicar obrigação", () => {
  it("cria na PRÓXIMA competência, pendente e sem dados da entrega", () => {
    const d = duplicateObligationToNextPeriod(base, [base], { now: "2026-10-26T00:00:00Z" })
    expect(d.ok).toBe(true)
    if (!d.ok) return
    expect(d.obligation.id).not.toBe(base.id)
    expect(d.obligation.competencyMonth).toBe("2026-11")
    expect(d.obligation.status).toBe("pending")
    expect(d.obligation.completedAt).toBeUndefined()
    expect(d.obligation.protocol).toBeUndefined()
    expect(d.obligation.attachments).toEqual([])
    expect(d.obligation.realizationDate).toBeUndefined()
    // cópia avulsa: não vira outra série nem clone da série original
    expect(d.obligation.autoGenerate).toBe(false)
    expect(d.obligation.parentObligationId).toBeUndefined()
  })

  it("trimestral avança 3 meses", () => {
    const d = duplicateObligationToNextPeriod({ ...base, recurrence: "quarterly" }, [], { now: "x" })
    expect(d.ok && d.obligation.competencyMonth).toBe("2027-01")
  })

  it("pula competências que já têm a mesma obrigação do cliente", () => {
    const nov = { ...base, id: "o2", competencyMonth: "2026-11" }
    const d = duplicateObligationToNextPeriod(base, [base, nov], { now: "x" })
    expect(d.ok && d.obligation.competencyMonth).toBe("2026-12")
  })

  it("competência destino fechada → recusa com motivo", () => {
    const d = duplicateObligationToNextPeriod(base, [base], { now: "x", isPeriodLocked: (p) => p === "2026-11" })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toMatch(/2026-11.*fechada/)
  })
})
