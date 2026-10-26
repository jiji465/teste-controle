// Adicional do IRPJ no LP trimestral (QA out/2026). Valores calculados à mão.
import { describe, it, expect } from "vitest"
import {
  autoFillTaxes,
  lpDefaults,
  resumoApuracao,
  parseNumBR,
  calcEconomia,
} from "./engine.js"

const byTax = (taxes, name) => taxes.find((t) => t.tax === name)
const num = (taxes, name, field = "apurado") => parseNumBR(byTax(taxes, name)?.[field])
const withIds = (list) => list.map((t, i) => ({ ...t, id: i + 1 }))

/* ===================== LP trimestral — Adicional do IRPJ ===================== */
// Lei 9.249/95, art. 3º, § 1º: adicional de 10% sobre a parcela da base que exceder
// R$ 20.000 × nº de meses do período. A provisão/carga do MÊS usa R$ 20 mil; o DARF do
// fechamento usa o limite do trimestre (R$ 60 mil) sobre a receita acumulada.

describe("LP trimestral — mês comum: Adicional entra na provisão", () => {
  // Maio, receita 100.000 (serviços): base IRPJ 32.000 → adicional 10% × 12.000 = 1.200.
  const data = { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", compMonth: "5", compYear: "2026", irpjCsllMode: "Trimestral (Apuração)" }
  const out = autoFillTaxes(data, withIds(lpDefaults("Serviços")))
  it("Adicional provisionado = 1.200", () => {
    expect(num(out, "Adicional IRPJ")).toBeCloseTo(1200, 2)
    expect(byTax(out, "Adicional IRPJ").provisao).toBe(true)
  })
  it("provisão do mês = IRPJ 4.800 + Adicional 1.200 + CSLL 2.880 = 8.880", () => {
    expect(resumoApuracao(out, 100000).totalProvisao).toBeCloseTo(8880, 2)
  })
})

describe("LP trimestral — fechamento (jun) com receita acumulada", () => {
  // Trimestre 300.000 (100.000/mês): DARF adicional = 10% × (96.000 − 60.000) = 3.600;
  // carga do mês = 10% × (32.000 − 20.000) = 1.200.
  const data = { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", periodRevenue: "300.000,00", compMonth: "6", compYear: "2026", irpjCsllMode: "Trimestral (Apuração)" }
  const out = autoFillTaxes(data, withIds(lpDefaults("Serviços")))
  it("DARF do Adicional mantém o limite trimestral: 3.600", () => {
    expect(num(out, "Adicional IRPJ")).toBeCloseTo(3600, 2)
  })
  it("carga do mês do Adicional usa o limite mensal: 1.200", () => {
    expect(parseNumBR(byTax(out, "Adicional IRPJ").cargaMes)).toBeCloseTo(1200, 2)
  })
  it("carga efetiva do mês = (650 + 3.000 + 5.000 + 4.800 + 1.200 + 2.880) / 100.000 = 17,53%", () => {
    expect(resumoApuracao(out, 100000).cargaEfetiva).toBeCloseTo(17.53, 2)
  })
})

describe("LP equiparação hospitalar trimestral — economia de um mês comum usa o limite mensal", () => {
  // Mês comum: base 32% de 100.000 = 32.000 (sem equip.) × 8% de 100.000 = 8.000 (com).
  // Sem: 4.800 + 2.880 + 1.200 (adicional, limite 20 mil) = 8.880; Com: 1.200 + 1.080 = 2.280.
  it("economia = 6.600 (igual ao mensal)", () => {
    const e = calcEconomia(
      { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", equiparacaoHospitalar: true, receitaEquiparacao: "100.000,00", irpjCsllMode: "Trimestral (Apuração)", compMonth: "5", compYear: "2026" },
      [],
    )
    expect(e.valor).toBeCloseTo(6600, 2)
  })
})
