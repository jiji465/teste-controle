import { describe, expect, it } from "vitest"
import type { Obligation, Service, Tax } from "../types"
import {
  buildRecurringObligations,
  buildRecurringServices,
  buildRecurringTaxes,
  legacyServiceOccurrenceIds,
  normalizeRecurrenceInterval,
  stepMonths,
} from "../recurrence-generate"
import { deterministicAutoId, generateObligationForPeriod, generateTaxForPeriod } from "../recurrence-engine"
import { planOccurrenceInserts } from "../recurrence-sync"

const obligationMaster = (over: Partial<Obligation> = {}): Obligation => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "DCTFWeb",
  category: "declaration",
  clientId: "c1",
  dueDay: 15,
  competencyMonth: "2026-01",
  frequency: "monthly",
  recurrence: "monthly",
  recurrenceEndDate: "2026-06-30",
  autoGenerate: true,
  weekendRule: "postpone",
  status: "pending",
  priority: "medium",
  createdAt: "2026-01-01T00:00:00Z",
  history: [],
  ...over,
})

describe("intervalo residual (bug 6)", () => {
  it("intervalo só vale para 'custom': mensal com interval=3 continua mensal", () => {
    expect(stepMonths("monthly", 3)).toBe(1)
    expect(stepMonths("custom", 3)).toBe(3)
    const tax: Tax = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "DAS", clientId: "c", competencyMonth: "2026-01",
      recurrence: "monthly", recurrenceInterval: 3, recurrenceEndDate: "2026-12-31", dueDay: 20,
      weekendRule: "postpone", status: "pending", priority: "high", createdAt: "",
    }
    expect(buildRecurringTaxes(tax)).toHaveLength(11)
  })

  it("normalizeRecurrenceInterval descarta o intervalo fora de 'custom'", () => {
    expect(normalizeRecurrenceInterval("monthly", 3)).toBeUndefined()
    expect(normalizeRecurrenceInterval("quarterly", 2)).toBeUndefined()
    expect(normalizeRecurrenceInterval(undefined, 2)).toBeUndefined()
    expect(normalizeRecurrenceInterval("custom", 4)).toBe(4)
    expect(normalizeRecurrenceInterval("custom", undefined)).toBe(1)
  })
})

describe("clone da recorrência não herda dados da entrega anterior (bug 8)", () => {
  const master = obligationMaster({
    status: "completed",
    protocol: "REC-JAN-2026-123",
    attachments: ["recibo-jan.pdf"],
    notes: "enviado jan",
    completedAt: "2026-02-10T12:00:00Z",
  })

  it("obrigação: protocolo, anexos e observação ficam vazios", () => {
    const clone = generateObligationForPeriod(master, "2026-02")
    expect(clone.protocol).toBeUndefined()
    expect(clone.attachments ?? []).toEqual([])
    expect(clone.notes).toBeUndefined()
    expect(clone.status).toBe("pending")
  })

  it("guia: protocolo e observação ficam vazios", () => {
    const tax: Tax = {
      id: "22222222-2222-4222-8222-222222222222", name: "DAS", clientId: "c1", dueDay: 20,
      competencyMonth: "2026-01", recurrence: "monthly", status: "completed", priority: "high",
      createdAt: "", protocol: "DARF-JAN", notes: "pago jan",
    }
    const clone = generateTaxForPeriod(tax, "2026-02")
    expect(clone.protocol).toBeUndefined()
    expect(clone.notes).toBeUndefined()
  })
})

describe("serviço recorrente: ids estáveis (bug 3)", () => {
  const service = (over: Partial<Service> = {}): Service => ({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Emissão NF",
    clientId: "c1",
    category: "nf_emission",
    dueDate: "2026-11-09",
    weekendRule: "postpone",
    status: "pending",
    priority: "medium",
    recurrence: "monthly",
    recurrenceEndDate: "2027-02-28",
    createdAt: "",
    ...over,
  })

  it("data-base em fim de semana: criar (data digitada) e editar (data ajustada) geram os MESMOS ids", () => {
    // 07/11/2026 é sábado → salva 09/11; ao editar, o form recarrega 09/11
    const created = buildRecurringServices(service(), "2026-11-07")
    const edited = buildRecurringServices(service(), "2026-11-09")
    expect(created.map((s) => s.id)).toEqual(edited.map((s) => s.id))
    expect(created).toHaveLength(3)
  })

  it("aliases legados cobrem os ids antigos (por data crua) do mesmo mês", () => {
    const legacyId = deterministicAutoId("33333333-3333-4333-8333-333333333333", "2026-12-07")
    expect(legacyServiceOccurrenceIds("33333333-3333-4333-8333-333333333333", "2026-12")).toContain(legacyId)
  })
})

describe("planOccurrenceInserts (bug 2)", () => {
  it("cria só o que não existe e pula competência fechada", () => {
    const master = obligationMaster()
    const occurrences = buildRecurringObligations(master) // 02..06
    const existing = new Set([deterministicAutoId(master.id, "2026-03")])
    const plan = planOccurrenceInserts(occurrences, {
      existingIds: existing,
      periodOf: (o) => o.competencyMonth,
      isPeriodLocked: (p) => p === "2026-04",
    })
    expect(plan.toCreate.map((o) => o.competencyMonth)).toEqual(["2026-02", "2026-05", "2026-06"])
    expect(plan.skippedExisting.map((o) => o.competencyMonth)).toEqual(["2026-03"])
    expect(plan.skippedLocked.map((o) => o.competencyMonth)).toEqual(["2026-04"])
  })

  it("aliasIds: ocorrência com id legado existente não é recriada", () => {
    const plan = planOccurrenceInserts([{ id: "novo", month: "2026-12" }], {
      existingIds: new Set(["velho"]),
      periodOf: (o) => o.month,
      aliasIds: () => ["velho"],
    })
    expect(plan.toCreate).toEqual([])
    expect(plan.skippedExisting).toHaveLength(1)
  })
})
