import { beforeEach, describe, expect, it } from "vitest"
import type { Client } from "../types"
import { applyTemplateToClient } from "../template-applier"
import { getObligations } from "@/features/obligations/services"
import { getTemplateForClient, seedDefaultTemplates, type ObligationTemplate } from "../obligation-templates"
import { getCustomTemplatesAsync } from "@/features/templates/services"
import { TEMPLATE_ITEM_CATALOG, catalogItemToTemplate } from "../template-item-catalog"
import { calculateDueDateFromCompetency, toLocalDateString } from "../date-utils"
import { installLocalStorage } from "./local-storage-shim"

beforeEach(() => installLocalStorage())

const DEFIS: ObligationTemplate = {
  name: "DEFIS", description: "DEFIS", category: "declaration", scope: "federal", dueDay: 31, dueMonth: 3,
  frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high",
}
const client: Client = { id: "c1", name: "Empresa X", taxRegime: "simples_nacional", email: "", phone: "", status: "active", createdAt: "2026-01-01" }

describe("template anual reaplicado (dedupe por exercício)", () => {
  it("aplicar a DEFIS 2x no mesmo ano (meses iniciais diferentes) cria UMA só", async () => {
    await applyTemplateToClient(client, [DEFIS], { start: "2026-05", end: "2026-12" })
    const r2 = await applyTemplateToClient(client, [DEFIS], { start: "2026-10", end: "2026-12" })
    expect(r2.obligationsCreated).toBe(0)
    expect(r2.totalSkipped).toBe(1)
    const defis = (await getObligations()).filter((o) => o.name === "DEFIS")
    expect(defis).toHaveLength(1)
    // competência normalizada = dezembro do exercício; vencimento inalterado (31/03 do ano seguinte)
    expect(defis[0].competencyMonth).toBe("2026-12")
    const due = calculateDueDateFromCompetency(defis[0].competencyMonth, defis[0].dueDay, defis[0].weekendRule, defis[0].dueMonth)
    expect(toLocalDateString(due!)).toBe("2027-03-31")
  })

  it("item antigo com competência em outro mês do mesmo ano também conta como existente", async () => {
    await applyTemplateToClient(client, [DEFIS], { start: "2026-01", end: "2026-01" })
    const r = await applyTemplateToClient(client, [DEFIS], { start: "2026-04", end: "2026-12" })
    expect(r.obligationsCreated).toBe(0)
  })
})

describe("seed de templates padrão", () => {
  it("chamadas concorrentes não duplicam", async () => {
    await Promise.all([seedDefaultTemplates(), seedDefaultTemplates()])
    const names = (await getCustomTemplatesAsync()).map((t) => t.name)
    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe("catálogo de itens", () => {
  it("adicionar do catálogo mantém o mês fixo (DEFIS/DASN-SIMEI)", () => {
    const defis = catalogItemToTemplate(TEMPLATE_ITEM_CATALOG.find((c) => c.name === "DEFIS")!)
    expect(defis.dueMonth).toBe(3)
    expect("group" in defis).toBe(false)
    expect(catalogItemToTemplate(TEMPLATE_ITEM_CATALOG.find((c) => c.name === "DASN-SIMEI")!).dueMonth).toBe(5)
  })

  it("DAS / PGDAS-D / DAS-MEI postergam (igual aos templates padrão)", () => {
    const cat = Object.fromEntries(TEMPLATE_ITEM_CATALOG.map((c) => [c.name, c.weekendRule]))
    expect(cat["DAS"]).toBe("postpone")
    expect(cat["PGDAS-D"]).toBe("postpone")
    expect(cat["DAS-MEI"]).toBe("postpone")
    const tpl = Object.fromEntries(getTemplateForClient("simples_nacional", "servicos").map((c) => [c.name, c.weekendRule]))
    expect(cat["DAS"]).toBe(tpl["DAS"])
  })
})
