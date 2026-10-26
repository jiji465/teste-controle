import { beforeEach, describe, expect, it } from "vitest"
import type { Obligation, Tax } from "../types"
import { saveObligation, deleteObligation, getObligations } from "@/features/obligations/services"
import { saveTax, deleteTax } from "@/features/taxes/services"
import * as local from "../storage"
import { installLocalStorage } from "./local-storage-shim"

beforeEach(() => installLocalStorage())

const obl: Obligation = {
  id: "o1", name: "EFD", category: "sped", clientId: "c1", dueDay: 15, competencyMonth: "2026-09",
  frequency: "monthly", recurrence: "monthly", autoGenerate: false, weekendRule: "postpone",
  status: "pending", priority: "medium", createdAt: "",
}
const tax: Tax = { id: "t1", name: "DAS", clientId: "c1", competencyMonth: "2026-09", status: "pending", priority: "high", createdAt: "" }

describe("competência fechada em modo local (sem banco para impor)", () => {
  it("recusa incluir item em competência fechada", async () => {
    local.lockPeriod("2026-09")
    await expect(saveObligation(obl)).rejects.toThrow(/2026-09 está fechada/)
    await expect(saveTax(tax)).rejects.toThrow(/2026-09 está fechada/)
    expect(await getObligations()).toEqual([])
  })

  it("recusa alterar, mover para fora ou excluir item de competência fechada", async () => {
    await saveObligation(obl)
    await saveTax(tax)
    local.lockPeriod("2026-09")
    await expect(saveObligation({ ...obl, status: "completed" })).rejects.toThrow(/fechada/)
    await expect(saveObligation({ ...obl, competencyMonth: "2026-10" })).rejects.toThrow(/fechada/)
    await expect(deleteObligation(obl.id)).rejects.toThrow(/fechada/)
    await expect(deleteTax(tax.id)).rejects.toThrow(/fechada/)
    // gravar igual ao que já está é permitido (no-op), como o trigger do banco
    await expect(saveObligation({ ...obl })).resolves.toBeUndefined()
  })

  it("competência aberta continua livre", async () => {
    local.lockPeriod("2026-08")
    await saveObligation(obl)
    await saveObligation({ ...obl, status: "completed" })
    await deleteObligation(obl.id)
    expect(await getObligations()).toEqual([])
  })
})
