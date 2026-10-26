import { beforeEach, describe, expect, it } from "vitest"
import type { Obligation, Tax } from "../types"
import { saveObligation, getObligations } from "@/features/obligations/services"
import { saveTax, getTaxes } from "@/features/taxes/services"
import { buildRecurringObligations, buildRecurringTaxes } from "../recurrence-generate"
import { deterministicAutoId } from "../recurrence-engine"
import { saveNewOccurrences } from "../recurrence-sync"
import { installLocalStorage } from "./local-storage-shim"

beforeEach(() => installLocalStorage())

// Núcleo do handleSave de obligation-list.tsx (modo local, sem Supabase)
async function handleSaveObligation(obligation: Obligation, isPeriodLocked: (p: string) => boolean = () => false) {
  const existingIds = new Set((await getObligations()).map((o) => o.id))
  await saveObligation(obligation)
  const series =
    obligation.autoGenerate && !obligation.parentObligationId
      ? await saveNewOccurrences(
          buildRecurringObligations(obligation),
          { existingIds, periodOf: (o) => o.competencyMonth, isPeriodLocked },
          saveObligation,
        )
      : null
  return series
}

// Núcleo do handleSave de app/impostos/page.tsx
async function handleSaveTax(tax: Tax) {
  const existingIds = new Set((await getTaxes()).map((t) => t.id))
  await saveTax(tax)
  return tax.autoGenerate
    ? saveNewOccurrences(buildRecurringTaxes(tax), { existingIds, periodOf: (t) => t.competencyMonth }, saveTax)
    : null
}

const master: Obligation = {
  id: "11111111-1111-4111-8111-111111111111", name: "DCTFWeb", category: "other", clientId: "c1",
  dueDay: 15, competencyMonth: "2026-01", frequency: "monthly", recurrence: "monthly",
  recurrenceEndDate: "2026-06-30", autoGenerate: true, weekendRule: "postpone",
  status: "pending", priority: "medium", createdAt: "2026-01-01T00:00:00Z", history: [],
}

describe("editar o item-mestre recorrente (bug 2)", () => {
  it("obrigação: ocorrência concluída continua concluída (com data, responsável e protocolo)", async () => {
    expect((await handleSaveObligation(master))?.toCreate).toHaveLength(5)
    const childId = deterministicAutoId(master.id, "2026-03")
    const child = (await getObligations()).find((o) => o.id === childId)!
    await saveObligation({ ...child, status: "completed", completedAt: "2026-04-10T12:00:00Z", completedBy: "Ana", protocol: "PROT-123" })

    const r = await handleSaveObligation({ ...master, notes: "nova observação" })
    expect(r?.toCreate).toHaveLength(0)
    const after = (await getObligations()).find((o) => o.id === childId)!
    expect(after.status).toBe("completed")
    expect(after.completedAt).toBe("2026-04-10T12:00:00Z")
    expect(after.completedBy).toBe("Ana")
    expect(after.protocol).toBe("PROT-123")
  })

  it("obrigação: estender o 'Gerar até' cria só as competências novas", async () => {
    await handleSaveObligation(master)
    const r = await handleSaveObligation({ ...master, recurrenceEndDate: "2026-08-31" })
    expect(r?.toCreate.map((o) => o.competencyMonth)).toEqual(["2026-07", "2026-08"])
    expect((await getObligations())).toHaveLength(8)
  })

  it("competência fechada é pulada (não interrompe a série)", async () => {
    const r = await handleSaveObligation(master, (p) => p === "2026-03")
    expect(r?.toCreate.map((o) => o.competencyMonth)).toEqual(["2026-02", "2026-04", "2026-05", "2026-06"])
    expect(r?.skippedLocked.map((o) => o.competencyMonth)).toEqual(["2026-03"])
  })

  it("guia: competência paga continua paga", async () => {
    const tax: Tax = {
      id: "22222222-2222-4222-8222-222222222222", name: "DAS", clientId: "c1", dueDay: 20,
      competencyMonth: "2026-01", recurrence: "monthly", recurrenceEndDate: "2026-04-30",
      autoGenerate: true, weekendRule: "postpone", status: "pending", priority: "high", createdAt: "2026-01-01T00:00:00Z",
    }
    await handleSaveTax(tax)
    const id = deterministicAutoId(tax.id, "2026-02")
    const t = (await getTaxes()).find((x) => x.id === id)!
    await saveTax({ ...t, status: "completed", completedAt: "2026-03-18T12:00:00Z" })
    await handleSaveTax({ ...tax, priority: "urgent" })
    expect((await getTaxes()).find((x) => x.id === id)!.status).toBe("completed")
  })
})
