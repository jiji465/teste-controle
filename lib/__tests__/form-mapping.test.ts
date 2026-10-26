import { describe, expect, it } from "vitest"
import type { Installment, Obligation, Service, Tax } from "../types"
import { obligationFromForm } from "@/features/obligations/form-mapping"
import { taxFromForm } from "@/features/taxes/form-mapping"
import { serviceFromForm } from "@/features/services/form-mapping"
import { installmentFromForm } from "@/features/installments/form-mapping"
import type { ObligationFormData } from "@/features/obligations/schemas"
import type { TaxFormData } from "@/features/taxes/schemas"
import type { ServiceFormData } from "@/features/services/schemas"
import type { InstallmentFormData } from "@/features/installments/schemas"

const NOW = "2026-10-26T15:00:00.000Z"

describe("obrigação: editar pelo formulário (bug 5)", () => {
  const original: Obligation = {
    id: "55555555-5555-4555-8555-555555555555", name: "EFD", category: "sped", clientId: "c1", dueDay: 15,
    competencyMonth: "2026-10", frequency: "monthly", recurrence: "monthly", autoGenerate: false,
    weekendRule: "postpone", status: "completed", priority: "medium", createdAt: "2026-10-01T00:00:00Z",
    source: "template", templateId: "tpl-1", assignedTo: "Ana", taxId: "t1", amount: 123.45,
    completedAt: "2026-10-10T12:00:00Z", completedBy: "Ana", realizationDate: "2026-10-10",
    history: [{ id: "h1", action: "created", description: "x", timestamp: "2026-10-01T00:00:00Z" }],
  }
  const formOf = (o: Obligation): ObligationFormData => ({
    id: o.id, name: o.name, description: "", clientId: o.clientId, scope: undefined, applicableRegimes: [],
    dueDay: o.dueDay, competencyMonth: o.competencyMonth ?? "", frequency: "monthly", recurrence: o.recurrence,
    recurrenceInterval: 3, recurrenceEndDate: "", autoGenerate: false, weekendRule: o.weekendRule, status: o.status,
    priority: o.priority, protocol: "", notes: "", tags: [], createdAt: o.createdAt,
  })

  it("preserva source, templateId, assignedTo e demais campos fora do formulário", () => {
    const out = obligationFromForm({ ...formOf(original), notes: "x" }, original, { now: NOW })
    expect(out.source).toBe("template")
    expect(out.templateId).toBe("tpl-1")
    expect(out.assignedTo).toBe("Ana")
    expect(out.taxId).toBe("t1")
    expect(out.amount).toBe(123.45)
    expect(out.category).toBe("sped")
    expect(out.completedAt).toBe("2026-10-10T12:00:00Z")
    expect(out.history).toHaveLength(2)
    expect(out.notes).toBe("x")
  })

  it("intervalo residual não é gravado fora de 'custom' (bug 6)", () => {
    expect(obligationFromForm(formOf(original), original, { now: NOW }).recurrenceInterval).toBeUndefined()
    expect(
      obligationFromForm({ ...formOf(original), recurrence: "custom", recurrenceInterval: 3 }, original, { now: NOW })
        .recurrenceInterval,
    ).toBe(3)
  })

  it("voltar o status para Pendente limpa conclusão", () => {
    const out = obligationFromForm({ ...formOf(original), status: "pending" }, original, { now: NOW })
    expect(out.completedAt).toBeUndefined()
    expect(out.completedBy).toBeUndefined()
    expect(out.realizationDate).toBeUndefined()
  })

  it("marcar Concluída pelo formulário registra data e responsável", () => {
    const pending = { ...original, status: "pending" as const, completedAt: undefined, completedBy: undefined }
    const out = obligationFromForm({ ...formOf(pending), status: "completed" }, pending, { now: NOW, userName: "Bia" })
    expect(out.completedAt).toBe(NOW)
    expect(out.completedBy).toBe("Bia")
  })
})

describe("guia: editar pelo formulário", () => {
  const original: Tax = {
    id: "66666666-6666-4666-8666-666666666666", name: "DAS", clientId: "c1", dueDay: 20, competencyMonth: "2026-10",
    recurrence: "monthly", status: "completed", priority: "high", createdAt: "2026-10-01T00:00:00Z",
    assignedTo: "Ana", federalTaxCode: "1234", completedAt: "2026-10-18T12:00:00Z", completedBy: "Ana",
    history: [{ id: "h1", action: "created", description: "x", timestamp: "" }],
  }
  const formOf = (t: Tax): TaxFormData => ({
    id: t.id, name: t.name, clientId: t.clientId!, description: "", competencyMonth: t.competencyMonth ?? "",
    dueDay: t.dueDay, status: t.status, priority: t.priority, recurrence: "monthly", recurrenceInterval: 2,
    recurrenceEndDate: "", autoGenerate: false, weekendRule: "postpone", protocol: "", notes: "", tags: [],
    applicableRegimes: [], completedAt: t.completedAt, completedBy: t.completedBy, createdAt: t.createdAt,
  })

  it("preserva assignedTo, código da receita e histórico; limpa intervalo residual", () => {
    const out = taxFromForm(formOf(original), original, { now: NOW })
    expect(out.assignedTo).toBe("Ana")
    expect(out.federalTaxCode).toBe("1234")
    expect(out.history).toHaveLength(1)
    expect(out.recurrenceInterval).toBeUndefined()
  })

  it("Pendente limpa completedAt/completedBy", () => {
    const out = taxFromForm({ ...formOf(original), status: "pending" }, original, { now: NOW })
    expect(out.completedAt).toBeUndefined()
    expect(out.completedBy).toBeUndefined()
  })
})

describe("serviço: editar pelo formulário (bug 4)", () => {
  const original: Service = {
    id: "33333333-3333-4333-8333-333333333333", name: "Consultoria", clientId: "c1", category: "consulting",
    dueDate: "2026-11-10", weekendRule: "postpone", status: "completed", priority: "medium",
    completedAt: "2026-11-10T15:00:00Z", completedBy: "Ana", createdAt: "2026-10-01T00:00:00Z", tags: [],
    history: [{ id: "h1", action: "completed", description: "Serviço concluído", timestamp: "2026-11-10T15:00:00Z" }],
  }
  const formOf = (s: Service): ServiceFormData => ({
    id: s.id, name: s.name, clientId: s.clientId, description: "", category: s.category, dueDate: s.dueDate,
    weekendRule: "postpone", status: s.status, priority: s.priority, recurrence: undefined,
    recurrenceInterval: undefined, recurrenceEndDate: "", autoGenerate: false, notes: "", tags: [],
    completedAt: s.completedAt, completedBy: s.completedBy, createdAt: s.createdAt,
  })

  it("mantém o histórico", () => {
    const out = serviceFromForm({ ...formOf(original), notes: "obs" }, original, { now: NOW })
    expect(out.history).toHaveLength(1)
    expect(out.completedAt).toBe("2026-11-10T15:00:00Z")
  })

  it("aplica a regra de fim de semana na data digitada", () => {
    // 07/11/2026 = sábado
    expect(serviceFromForm({ ...formOf(original), dueDate: "2026-11-07" }, original, { now: NOW }).dueDate).toBe("2026-11-09")
  })
})

describe("parcelamento: editar pelo formulário (bug 1)", () => {
  const original: Installment = {
    id: "44444444-4444-4444-8444-444444444444", name: "PERT", clientId: "c1", installmentCount: 60,
    currentInstallment: 4, dueDay: 30, firstDueDate: "2026-01-30", weekendRule: "postpone", status: "in_progress",
    priority: "medium", createdAt: "2026-01-01T00:00:00Z", autoGenerate: true, recurrence: "monthly",
    assignedTo: "Ana", totalAmount: 6000, installmentAmount: 100,
    paidInstallments: [{ number: 1, paidAt: "2026-01-30" }, { number: 2, paidAt: "2026-02-27" }, { number: 3, paidAt: "2026-03-30" }],
  }
  const formOf = (i: Installment): InstallmentFormData => ({
    id: i.id, name: i.name, description: "", clientId: i.clientId, taxId: "none", installmentCount: i.installmentCount,
    currentInstallment: i.currentInstallment, dueDay: i.dueDay, firstDueDate: i.firstDueDate, weekendRule: i.weekendRule,
    status: i.status, priority: i.priority, protocol: "", notes: "nova obs", tags: [], autoGenerate: i.autoGenerate,
    recurrence: i.recurrence, recurrenceInterval: 1, createdAt: i.createdAt,
  })

  it("preserva as parcelas pagas e campos fora do formulário", () => {
    const out = installmentFromForm(formOf(original), original, { now: NOW })
    expect(out.paidInstallments).toHaveLength(3)
    expect(out.assignedTo).toBe("Ana")
    expect(out.totalAmount).toBe(6000)
    expect(out.notes).toBe("nova obs")
    expect(out.recurrenceInterval).toBeUndefined()
  })

  it("novo parcelamento começa sem parcelas pagas", () => {
    const out = installmentFromForm({ ...formOf(original), id: undefined }, undefined, { now: NOW })
    expect(out.paidInstallments).toEqual([])
    expect(out.id).toMatch(/[0-9a-f-]{36}/)
  })
})
