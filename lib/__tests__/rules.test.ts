import { describe, expect, it } from "vitest"
import { addMonthsToPeriod, recurringPeriods, buildRecurringTaxes } from "../recurrence-generate"
import { getParcelaDueDate } from "../installment-dates"
import { effectiveStatus } from "../obligation-status"
import { formatRange, yoyRange, dateInRange } from "../date-range"
import { formatDocument, isValidCNPJ, isValidCPF, normalizeCnpj } from "../cnpj-validation"
import { safeRedirect } from "../safe-redirect"
import { toDbError } from "../supabase/core"
import { toLocalDateString } from "../date-utils"
import { undoLastSent, markCurrentInstallmentAsSent } from "@/features/installments/actions"
import type { Installment, Tax } from "../types"

describe("recorrência por competência", () => {
  it("trimestral avança de 3 em 3 meses (não todo mês)", () => {
    expect(recurringPeriods("2026-01", "quarterly", "2026-12")).toEqual(["2026-04", "2026-07", "2026-10"])
  })

  it("bimestral, semestral e anual", () => {
    expect(recurringPeriods("2026-01", "bimonthly", "2026-06")).toEqual(["2026-03", "2026-05"])
    expect(recurringPeriods("2026-01", "semiannual", "2027-01")).toEqual(["2026-07", "2027-01"])
    expect(recurringPeriods("2025-12", "annual", "2027-12")).toEqual(["2026-12", "2027-12"])
  })

  it("vira o ano corretamente", () => {
    expect(addMonthsToPeriod("2026-11", 3)).toBe("2027-02")
    expect(addMonthsToPeriod("2026-12", 1)).toBe("2027-01")
  })

  it("buildRecurringTaxes respeita passo e data final", () => {
    const master = {
      id: "6f1b2c3d-4e5f-5a6b-8c9d-0e1f2a3b4c5d",
      name: "IRPJ Trimestral",
      status: "pending",
      priority: "high",
      createdAt: "2026-01-01T00:00:00Z",
      competencyMonth: "2026-03",
      recurrence: "quarterly",
      recurrenceEndDate: "2026-12-31",
      dueDay: 31,
    } as unknown as Tax
    expect(buildRecurringTaxes(master).map((t) => t.competencyMonth)).toEqual(["2026-06", "2026-09", "2026-12"])
  })
})

const baseInstallment = (over: Partial<Installment> = {}): Installment =>
  ({
    id: "inst-1",
    name: "Parcelamento",
    clientId: "c1",
    installmentCount: 3,
    currentInstallment: 1,
    firstDueDate: "2026-02-01",
    dueDay: 1,
    weekendRule: "keep",
    status: "pending",
    priority: "medium",
    createdAt: "2026-01-10T00:00:00Z",
    paidInstallments: [],
    history: [],
    ...over,
  }) as Installment

describe("parcelamentos", () => {
  it("1ª parcela em 01/02 não recua para janeiro (bug de fuso)", () => {
    expect(toLocalDateString(getParcelaDueDate(baseInstallment(), 1))).toBe("2026-02-01")
    expect(toLocalDateString(getParcelaDueDate(baseInstallment(), 3))).toBe("2026-04-01")
  })

  it("desfazer a 2ª parcela mantém 'em andamento' se a 1ª está paga", () => {
    let inst = markCurrentInstallmentAsSent(baseInstallment(), "Ana").updated
    inst = markCurrentInstallmentAsSent(inst, "Ana").updated
    expect(inst.currentInstallment).toBe(3)
    const undone = undoLastSent(inst)
    expect(undone.currentInstallment).toBe(2)
    expect(undone.status).toBe("in_progress")
    expect(undone.paidInstallments?.[0].paidBy).toBe("Ana")
  })

  it("desfazer a única parcela volta para pendente", () => {
    const inst = markCurrentInstallmentAsSent(baseInstallment(), "Ana").updated
    expect(undoLastSent(inst).status).toBe("pending")
  })
})

describe("status efetivo", () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  it("em andamento vencido conta como atrasado", () => {
    expect(effectiveStatus({ status: "in_progress", calculatedDueDate: yesterday })).toBe("overdue")
  })
  it("em andamento no prazo continua em andamento", () => {
    expect(effectiveStatus({ status: "in_progress", calculatedDueDate: tomorrow })).toBe("in_progress")
  })
  it("concluído nunca vira atrasado", () => {
    expect(effectiveStatus({ status: "completed", calculatedDueDate: yesterday })).toBe("completed")
  })
})

describe("date-range", () => {
  it("rótulo não mostra o dia anterior", () => {
    expect(formatRange({ from: "2026-05-01", to: "2026-05-01" })).toBe("01/05/2026")
  })
  it("comparativo anual de 29/02 cai em 28/02", () => {
    expect(yoyRange({ from: "2024-02-29", to: "2024-03-31" })).toEqual({ from: "2023-02-28", to: "2023-03-31" })
  })
  it("dateInRange com string de data local", () => {
    expect(dateInRange("2026-05-01", { from: "2026-05-01", to: "2026-05-31" })).toBe(true)
    expect(dateInRange("2026-04-30", { from: "2026-05-01", to: "2026-05-31" })).toBe(false)
  })
})

describe("CNPJ / CPF", () => {
  it("aceita CNPJ numérico válido e rejeita repetidos", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true)
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false)
    expect(isValidCNPJ("11.111.111/1111-11")).toBe(false)
  })
  it("aceita CNPJ alfanumérico (exemplo oficial da Receita)", () => {
    expect(isValidCNPJ("12.ABC.345/01DE-35")).toBe(true)
    expect(isValidCNPJ("12abc34501de35")).toBe(true)
    expect(isValidCNPJ("12.ABC.345/01DE-36")).toBe(false)
  })
  it("normaliza e formata", () => {
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35")
    expect(formatDocument("12ABC34501DE35")).toBe("12.ABC.345/01DE-35")
  })
  it("valida CPF", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true)
    expect(isValidCPF("529.982.247-24")).toBe(false)
    expect(isValidCPF("111.111.111-11")).toBe(false)
  })
})

describe("safeRedirect", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirect("/obrigacoes?x=1")).toBe("/obrigacoes?x=1")
  })
  it("bloqueia destinos externos", () => {
    expect(safeRedirect("https://evil.com")).toBe("/")
    expect(safeRedirect("//evil.com")).toBe("/")
    expect(safeRedirect("/\\evil.com")).toBe("/")
    expect(safeRedirect(null)).toBe("/")
  })
})


describe("toDbError — mensagens do banco", () => {
  it("40001 (versão da apuração) explica que outra pessoa salvou antes", () => {
    const e = toDbError({ code: "40001", message: "Esta competência foi alterada por outra pessoa (versão 3 no banco, 2 na tela). Recarregue antes de salvar." })
    expect(e.message).toMatch(/alterada por outra pessoa/)
  })
  it("competência fechada repassa a mensagem do trigger", () => {
    expect(toDbError({ message: "Competência 2026-06 está fechada. Reabra a competência para alterar esta apuração." }).message).toMatch(/fechada/)
  })
})
