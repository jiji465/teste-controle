// Fator R em início de atividade (QA out/2026). Valores calculados à mão.
import { describe, it, expect } from "vitest"
import {
  autoFillTaxes,
  DEFAULT_TAXES_SN_SERVICOS,
  parseNumBR,
  folhaFatorR,
  fatorRDoPeriodo,
  calcEconomia,
} from "./engine.js"

const byTax = (taxes, name) => taxes.find((t) => t.tax === name)
const num = (taxes, name, field = "apurado") => parseNumBR(byTax(taxes, name)?.[field])
const withIds = (list) => list.map((t, i) => ({ ...t, id: i + 1 }))

/* ===================== Fator R em início de atividade ===================== */
// Res. CGSN 140/2018, arts. 22 e 26: em início de atividade a receita (RBT12p) e a folha
// (FS12) são proporcionalizadas pelo MESMO critério — média dos meses anteriores × 12
// (no 1º mês, valor do próprio PA × 12). Antes a folha ia crua (3 meses) contra a receita
// anualizada e o Fator R caía para ~1/4 do real (Anexo V indevido).

describe("Fator R — início de atividade com RBT12p do PGDAS-D", () => {
  // Abertura 03/2026, PA 06/2026 → 3 meses anteriores. RBT12p 240.000 (média 20.000).
  // Folha dos 3 meses = 18.000 → FS12p = 18.000 / 3 × 12 = 72.000 → Fator R 30% → Anexo III.
  const data = {
    regime: "Simples Nacional", atividade: "Serviços", anexo: "Anexo V", sujeitoFatorR: true,
    rbt12: "0", rbt12p: "240.000,00", folha12m: "18.000,00", dataAbertura: "03/2026",
    revenue: "20.000,00", compMonth: "6", compYear: "2026",
  }
  it("folha anualizada pelo mesmo período da receita: 72.000", () => {
    expect(folhaFatorR(data)).toBeCloseTo(72000, 2)
  })
  it("Fator R = 30% (não 7,5%)", () => {
    expect(fatorRDoPeriodo(data)).toBeCloseTo(30, 6)
  })
  it("DAS no Anexo III, 2ª faixa: 20.000 × 7,30% = 1.460", () => {
    // (240.000 × 11,2% − 9.360) / 240.000 = 7,30%
    const out = autoFillTaxes(data, withIds(DEFAULT_TAXES_SN_SERVICOS))
    expect(num(out, "DAS", "rate")).toBeCloseTo(7.3, 4)
    expect(num(out, "DAS")).toBeCloseTo(1460, 2)
  })
  it("economia do Fator R usa o mesmo Fator R (≥ 28% → existe comparativo III × V)", () => {
    const out = autoFillTaxes(data, withIds(DEFAULT_TAXES_SN_SERVICOS))
    const e = calcEconomia(data, out)
    expect(e && e.tipo).toBe("Fator R")
  })
})

describe("Fator R — 1º mês de atividade (sem RBT12p informada)", () => {
  // Abertura = PA (06/2026): RBT12p = RPA × 12 = 240.000; FS12p = (folha + pró-labore do PA) × 12
  // = (5.000 + 1.000) × 12 = 72.000 → 30%.
  const data = {
    regime: "Simples Nacional", atividade: "Serviços", anexo: "Anexo V", sujeitoFatorR: true,
    rbt12: "0", dataAbertura: "06/2026", folhaMensal: "5.000,00", proLabore: "1.000,00",
    revenue: "20.000,00", compMonth: "6", compYear: "2026",
  }
  it("folha do próprio PA × 12", () => {
    expect(folhaFatorR(data)).toBeCloseTo(72000, 2)
    expect(fatorRDoPeriodo(data)).toBeCloseTo(30, 6)
  })
})

describe("Fator R — empresa com 12+ meses não proporcionaliza a folha", () => {
  const data = { regime: "Simples Nacional", anexo: "Anexo V", sujeitoFatorR: true, rbt12: "300.000,00", folha12m: "84.000,00", dataAbertura: "01/2020", compMonth: "6", compYear: "2026", revenue: "25.000,00" }
  it("FS12 = folha informada; Fator R = 28%", () => {
    expect(folhaFatorR(data)).toBeCloseTo(84000, 2)
    expect(fatorRDoPeriodo(data)).toBeCloseTo(28, 6)
  })
})
