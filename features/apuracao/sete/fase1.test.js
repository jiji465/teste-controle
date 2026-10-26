// Fase 1 do diagnóstico do Relatório Executivo — correções que mudam o VALOR das guias.
// Cada bloco documenta o erro encontrado (código do diagnóstico) e o valor correto,
// calculado à mão a partir da legislação. Escritos antes da correção (TDD).
import { describe, it, expect } from "vitest"
import {
  autoFillTaxes,
  regimeDefaults,
  lpDefaults,
  DEFAULT_TAXES_SN_SERVICOS,
  resumoApuracao,
  parseNumBR,
  calcFatorR,
  getAnexoEfetivo,
  isSujeitoFatorR,
  parsePGDASD,
  acumuladoPeriodo,
  rbt12InicioAtividade,
  calcEconomia,
  rbtFatorR,
} from "./engine.js"

const byTax = (taxes, name) => taxes.find((t) => t.tax === name)
const num = (taxes, name, field = "apurado") => parseNumBR(byTax(taxes, name)?.[field])
const withIds = (list) => list.map((t, i) => ({ ...t, id: i + 1 }))

/* ===================== B1 / A2 / B3 — Estimativa (Lucro Real anual) ===================== */

describe("B1/A2 — Estimativa mensal usa a receita do MÊS, não o acumulado", () => {
  // LR Serviços, junho: receita do mês 100.000; a tela preenche periodRevenue = 600.000
  // (jan→jun). Lei 9.430, art. 2º: a estimativa incide sobre a receita do próprio mês.
  const data = {
    regime: "Lucro Real",
    atividade: "Serviços",
    revenueNonRetained: "100.000,00",
    periodRevenue: "600.000,00",
    compMonth: "6",
    compYear: "2026",
    irpjCsllMode: "Estimativa (Anual)",
  }
  const out = autoFillTaxes(data, withIds(regimeDefaults("Lucro Real", "Serviços")))

  it("IRPJ = 15% × 32% × 100.000 = 4.800 (não 28.800)", () => {
    expect(num(out, "IRPJ")).toBeCloseTo(4800, 2)
  })
  it("CSLL = 9% × 32% × 100.000 = 2.880", () => {
    expect(num(out, "CSLL")).toBeCloseTo(2880, 2)
  })
  it("Adicional = 10% × (32.000 − 20.000) = 1.200", () => {
    expect(num(out, "Adicional IRPJ")).toBeCloseTo(1200, 2)
  })
  it("é guia do mês (não provisão)", () => {
    expect(byTax(out, "IRPJ").provisao).toBe(false)
  })
})

describe("B3 — Estimativa sem acumulado: limite do adicional é R$ 20 mil (um mês)", () => {
  // Junho, receita 250.000 → base 80.000 → adicional (80.000 − 20.000) × 10% = 6.000.
  // Antes o limite virava 20.000 × 6 meses = 120.000 e o adicional sumia.
  const out = autoFillTaxes(
    { regime: "Lucro Real", atividade: "Serviços", revenueNonRetained: "250.000,00", compMonth: "6", compYear: "2026", irpjCsllMode: "Estimativa (Anual)" },
    withIds(regimeDefaults("Lucro Real", "Serviços")),
  )
  it("Adicional = 6.000", () => {
    expect(num(out, "Adicional IRPJ")).toBeCloseTo(6000, 2)
  })
})

/* ===================== B2 / A4 — Lucro Presumido trimestral ===================== */

describe("B2 — LP trimestral, mês comum: provisão sobre a receita do próprio mês", () => {
  // Maio: receita 100.000; periodRevenue (abr+mai) 200.000 não pode inflar a provisão.
  const data = {
    regime: "Lucro Presumido",
    atividade: "Serviços",
    revenueNonRetained: "100.000,00",
    periodRevenue: "200.000,00",
    compMonth: "5",
    compYear: "2026",
    irpjCsllMode: "Trimestral (Apuração)",
  }
  const out = autoFillTaxes(data, withIds(lpDefaults("Serviços")))

  // QA out/2026: a provisão do mês usa o limite MENSAL do adicional (R$ 20 mil — Lei
  // 9.249/95, art. 3º, § 1º). Antes usava o trimestral (R$ 60 mil) sobre a base de um mês
  // e o adicional nunca era provisionado: 10% × (32.000 − 20.000) = 1.200.
  it("provisão IRPJ 4.800 + Adicional 1.200 + CSLL 2.880", () => {
    expect(num(out, "IRPJ")).toBeCloseTo(4800, 2)
    expect(num(out, "CSLL")).toBeCloseTo(2880, 2)
    expect(num(out, "Adicional IRPJ")).toBeCloseTo(1200, 2)
  })
  it("carga do mês = (650 + 3.000 + 5.000 + 4.800 + 1.200 + 2.880) / 100.000 = 17,53%", () => {
    const R = resumoApuracao(out, 100000)
    expect(R.totalProvisao).toBeCloseTo(8880, 2)
    expect(R.cargaEfetiva).toBeCloseTo(17.53, 2)
  })
})

describe("A4 — LP trimestral, fechamento (jun): DARF do trimestre com retenções do trimestre", () => {
  // Trimestre abr–jun: 300.000 (100.000/mês), dos quais 30.000 com retenção (10.000/mês).
  // IRPJ = 15% × 96.000 = 14.400; Adicional = 10% × (96.000 − 60.000) = 3.600;
  // CSLL = 9% × 96.000 = 8.640. Retido no trimestre: IRPJ 1,5% × 30.000 = 450;
  // CSLL 1% × 30.000 = 300 (Lei 10.833, arts. 30 e 36; Lei 9.430, art. 64).
  const data = {
    regime: "Lucro Presumido",
    atividade: "Serviços",
    revenueRetained: "10.000,00",
    revenueNonRetained: "90.000,00",
    periodRevenue: "300.000,00",
    periodRevenueRetained: "30.000,00",
    compMonth: "6",
    compYear: "2026",
    irpjCsllMode: "Trimestral (Apuração)",
  }
  const out = autoFillTaxes(data, withIds(lpDefaults("Serviços")))

  it("DARF IRPJ: apurado 14.400, retido 450, a pagar 13.950", () => {
    expect(num(out, "IRPJ")).toBeCloseTo(14400, 2)
    expect(num(out, "IRPJ", "retido")).toBeCloseTo(450, 2)
    expect(num(out, "IRPJ", "value")).toBeCloseTo(13950, 2)
  })
  it("DARF CSLL: apurado 8.640, retido 300, a pagar 8.340", () => {
    expect(num(out, "CSLL")).toBeCloseTo(8640, 2)
    expect(num(out, "CSLL", "retido")).toBeCloseTo(300, 2)
    expect(num(out, "CSLL", "value")).toBeCloseTo(8340, 2)
  })
  it("Adicional do trimestre = 3.600", () => {
    expect(num(out, "Adicional IRPJ")).toBeCloseTo(3600, 2)
  })
  it("carga efetiva mostra só o mês (17,53%, com o adicional do mês), não o trimestre dividido pela receita do mês", () => {
    // QA out/2026: a carga do mês inclui o adicional do mês (limite R$ 20 mil):
    // (650 + 3.000 + 5.000 + 4.800 + 1.200 + 2.880) / 100.000 = 17,53%.
    const R = resumoApuracao(out, 100000)
    expect(R.cargaEfetiva).toBeCloseTo(17.53, 2)
  })
})

describe("acumuladoPeriodo — soma também a receita com retenção do trimestre", () => {
  const records = [
    { compKey: "2026-04", faturamento: 100000, payload: { clientData: { revenueRetained: "10.000,00" } } },
    { compKey: "2026-05", faturamento: 100000, payload: { clientData: { revenueRetained: "10.000,00" } } },
  ]
  it("retido do trimestre = abr + mai salvos + jun vivo", () => {
    const r = acumuladoPeriodo(
      { regime: "Lucro Presumido", atividade: "Serviços", compMonth: "6", compYear: "2026", irpjCsllMode: "Trimestral (Apuração)", revenueRetained: "10.000,00", revenueNonRetained: "90.000,00" },
      records,
    )
    expect(r.total).toBe(300000)
    expect(r.totalRetido).toBe(30000)
  })
})

/* ===================== A3 / A1 — Lucro Real ===================== */

describe("A3 — Lucro Real usa PIS 1,65% / COFINS 7,6% (não cumulativo) por padrão", () => {
  const out = autoFillTaxes(
    { regime: "Lucro Real", atividade: "Serviços", revenueNonRetained: "100.000,00", compMonth: "5", compYear: "2026", irpjCsllMode: "Estimativa (Anual)" },
    withIds(regimeDefaults("Lucro Real", "Serviços")),
  )
  it("PIS 1.650 / COFINS 7.600 sem créditos informados", () => {
    expect(num(out, "PIS")).toBeCloseTo(1650, 2)
    expect(num(out, "COFINS")).toBeCloseTo(7600, 2)
  })
  it("LP continua cumulativo (0,65% / 3%)", () => {
    expect(byTax(regimeDefaults("Lucro Presumido", "Serviços"), "PIS").rate).toBe("0,65")
  })
})

describe("A1 — Lucro Real trimestral não usa presunção", () => {
  const base = {
    regime: "Lucro Real",
    atividade: "Serviços",
    revenueNonRetained: "100.000,00",
    compMonth: "6",
    compYear: "2026",
    irpjCsllMode: "Trimestral (Apuração)",
  }
  it("sem IRPJ/CSLL informados, não calcula por presunção (fica em branco com aviso)", () => {
    const out = autoFillTaxes(base, withIds(regimeDefaults("Lucro Real", "Serviços")))
    expect(num(out, "IRPJ")).toBe(0)
    expect(num(out, "CSLL")).toBe(0)
    expect(byTax(out, "IRPJ").obs).toMatch(/lucro real/i)
  })
  it("usa o IRPJ/CSLL apurado sobre o lucro real quando informado", () => {
    const out = autoFillTaxes(
      { ...base, irpjRealApurado: "12.000,00", csllRealApurado: "7.200,00" },
      withIds(regimeDefaults("Lucro Real", "Serviços")),
    )
    expect(num(out, "IRPJ")).toBeCloseTo(12000, 2)
    expect(num(out, "CSLL")).toBeCloseTo(7200, 2)
    expect(num(out, "Adicional IRPJ")).toBe(0)
  })
})

/* ===================== B4 / M1 / B5 / B6 — Simples Nacional / Fator R ===================== */

describe("B4 — Fator R usa a RBT12p quando a RBT12 é 0", () => {
  // Anexo V sujeito ao Fator R; folha 40.000 / RBT12p 120.000 = 33% → Anexo III, 1ª faixa 6%.
  const out = autoFillTaxes(
    { regime: "Simples Nacional", atividade: "Serviços", anexo: "Anexo V", sujeitoFatorR: true, rbt12: "0", rbt12p: "120.000,00", folha12m: "40.000,00", revenue: "10.000,00", compMonth: "5", compYear: "2026" },
    withIds(DEFAULT_TAXES_SN_SERVICOS),
  )
  it("DAS = 6% de 10.000 = 600 (não 1.550 do Anexo V)", () => {
    expect(num(out, "DAS")).toBeCloseTo(600, 2)
  })
})

describe("M1 — início de atividade (Res. CGSN 140, art. 22)", () => {
  it("1º mês: RBT12p = RPA × 12", () => {
    expect(rbt12InicioAtividade({ dataAbertura: "07/2026", compMonth: "7", compYear: "2026", regime: "Simples Nacional", revenue: "40.000,00" })).toBeCloseTo(480000, 2)
  })
  it("meses seguintes: média dos meses anteriores × 12 (meses sem receita contam como 0)", () => {
    const d = {
      dataAbertura: "05/2026", compMonth: "7", compYear: "2026", regime: "Simples Nacional", revenue: "40.000,00",
      evolucao: [{ ym: "05/2026", receita: 30000 }, { ym: "06/2026", receita: 50000 }, { ym: "07/2026", receita: 40000 }],
    }
    expect(rbt12InicioAtividade(d)).toBeCloseTo(480000, 2)
  })
  it("empresa com mais de 12 meses não proporcionaliza (null)", () => {
    expect(rbt12InicioAtividade({ dataAbertura: "08/2024", compMonth: "7", compYear: "2026", regime: "Simples Nacional", revenue: "40.000,00" })).toBeNull()
  })
  it("DAS da empresa nova sai na faixa correta: 480.000 → Anexo III 3ª faixa (9,825%)", () => {
    const out = autoFillTaxes(
      { regime: "Simples Nacional", atividade: "Serviços", anexo: "Anexo III", sujeitoFatorR: false, rbt12: "0", dataAbertura: "07/2026", revenue: "40.000,00", compMonth: "7", compYear: "2026" },
      withIds(DEFAULT_TAXES_SN_SERVICOS),
    )
    expect(num(out, "DAS", "rate")).toBeCloseTo(9.825, 3)
    expect(num(out, "DAS")).toBeCloseTo(3930, 2)
  })
})

describe("B5 — Fator R exatamente 28% é Anexo III (sem erro de ponto flutuante)", () => {
  it("135.114,28 / 482.551,00 = 28% → Anexo III", () => {
    expect(getAnexoEfetivo("Anexo V", calcFatorR(135114.28, 482551), true)).toBe("Anexo III")
  })
  it("84.000 / 300.000 → III; 83.999,99 / 300.000 → V", () => {
    expect(getAnexoEfetivo("Anexo V", calcFatorR(84000, 300000), true)).toBe("Anexo III")
    expect(getAnexoEfetivo("Anexo V", calcFatorR(83999.99, 300000), true)).toBe("Anexo V")
  })
})

describe("B6 — Anexo III por natureza não migra para o V sem a flag", () => {
  it("isSujeitoFatorR: Anexo III com folha e sem flag → false", () => {
    expect(isSujeitoFatorR({ anexo: "Anexo III" }, 10000)).toBe(false)
    expect(isSujeitoFatorR({ anexo: "Anexo V" }, 0)).toBe(true)
  })
  it("DAS fica em 6% (III), não 15,5% (V)", () => {
    const out = autoFillTaxes(
      { regime: "Simples Nacional", atividade: "Serviços", anexo: "Anexo III", rbt12: "120.000,00", folha12m: "10.000,00", revenue: "10.000,00", compMonth: "5", compYear: "2026" },
      withIds(DEFAULT_TAXES_SN_SERVICOS),
    )
    expect(num(out, "DAS")).toBeCloseTo(600, 2)
  })
})

/* ===================== B9 — FAP ===================== */

describe("B9 — FAP aceita decimal e é limitado a 0,5–2,0", () => {
  const run = (fap) =>
    autoFillTaxes(
      { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", folhaMensal: "20.000,00", fap, compMonth: "5", compYear: "2026", irpjCsllMode: "Mensal (Provisão)" },
      withIds(lpDefaults("Serviços")),
    )
  it("FAP 1,2345 → RAT = 20.000 × 1% × 1,2345 = 246,90", () => {
    expect(num(run("1,2345"), "RAT")).toBeCloseTo(246.9, 2)
  })
  it("FAP '1.2345' (ponto decimal) dá o mesmo resultado", () => {
    expect(num(run("1.2345"), "RAT")).toBeCloseTo(246.9, 2)
  })
  it("FAP fora da faixa é limitado a 2,0 e sinalizado", () => {
    const rat = byTax(run("12345"), "RAT")
    expect(parseNumBR(rat.apurado)).toBeCloseTo(400, 2)
    expect(rat.obs).toMatch(/fora da faixa/i)
  })
})

/* ===================== B8 — parseNumBR ===================== */

describe("B8 — parseNumBR robusto", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["R$ 1.000,50", 1000.5],
    ["-1.234,56", -1234.56],
    ["1234.56", 1234.56],
    ["1.5", 1.5],
    ["1.234", 1234],
    ["1.234.567", 1234567],
    ["1,234.56", 1234.56],
    ["(1.000,00)", -1000],
    ["", 0],
    ["-", 0],
    [null, 0],
    [NaN, 0],
    [Infinity, 0],
  ])("%s → %s", (input, expected) => {
    expect(parseNumBR(input)).toBeCloseTo(expected, 6)
  })
})

/* ===================== B10 / B11 — PGDAS-D ===================== */

describe("B10 — PGDAS-D com 'Período de Apuração (PA): MM/AAAA'", () => {
  const r = parsePGDASD("PGDAS-D\nPeríodo de Apuração (PA): 12/2025\nCNPJ Matriz: 11.222.333/0001-81\nRPA) - Competência 10.000,00")
  it("lê a competência 12/2025", () => {
    expect(r.compMonth).toBe("12")
    expect(r.compYear).toBe("2025")
  })
})

describe("B11 — DAS não pode capturar multa/juros", () => {
  it("'Valor Total do Débito Declarado 600,00 Principal Multa Juros 12,34' → 600,00", () => {
    const r = parsePGDASD("PGDAS-D\nValor Total do Débito Declarado 600,00 Principal Multa Juros 12,34")
    expect(parseNumBR(r.das)).toBeCloseTo(600, 2)
  })
  it("com rótulo Total explícito, usa o Total", () => {
    const r = parsePGDASD("PGDAS-D\nValor Total do Débito Declarado Principal 900,00 Multa 0,00 Juros 0,00 Total 957,66")
    expect(parseNumBR(r.das)).toBeCloseTo(957.66, 2)
  })
  it("captura a data de abertura (para início de atividade)", () => {
    const r = parsePGDASD("PGDAS-D\nNome empresarial: X LTDA Data de abertura no CNPJ: 05/08/2025")
    expect(r.dataAbertura).toBe("08/2025")
  })
})

/* ===================== Economia persistida + receita do Fator R ===================== */


describe("calcEconomia — fonte única (relatório e histórico)", () => {
  it("equiparação hospitalar, LP mensal, 100% equiparado: 8.880 − 2.280 = 6.600", () => {
    // Sem: IRPJ 15%×32.000 = 4.800 + CSLL 9%×32.000 = 2.880 + adic 10%×12.000 = 1.200
    // Com: IRPJ 15%×8.000 = 1.200 + CSLL 9%×12.000 = 1.080 (sem adicional)
    const e = calcEconomia(
      { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", equiparacaoHospitalar: true, receitaEquiparacao: "100.000,00", irpjCsllMode: "Mensal (Provisão)", compMonth: "5", compYear: "2026" },
      [],
    )
    expect(e.tipo).toBe("Equiparação Hospitalar")
    expect(e.valor).toBeCloseTo(6600, 2)
  })
  it("sem cenário de economia → null", () => {
    expect(calcEconomia({ regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00" }, [])).toBeNull()
  })
})

describe("rbtFatorR — receita de 12 meses do Fator R", () => {
  it("prefere a RBT12p, depois a RBT12", () => {
    expect(rbtFatorR({ rbt12: "0", rbt12p: "120.000,00" })).toBe(120000)
    expect(rbtFatorR({ rbt12: "300.000,00" })).toBe(300000)
  })
  it("empresa nova sem RBT12p usa o art. 22", () => {
    expect(rbtFatorR({ rbt12: "0", dataAbertura: "07/2026", compMonth: "7", compYear: "2026", regime: "Simples Nacional", revenue: "10.000,00" })).toBe(120000)
  })
})

describe("B9 — corrigir o FAP limpa o aviso anterior", () => {
  it("FAP 12345 → aviso; depois FAP 1 → observação volta ao padrão", () => {
    const base = { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", folhaMensal: "20.000,00", compMonth: "5", compYear: "2026", irpjCsllMode: "Mensal (Provisão)" }
    const comAviso = autoFillTaxes({ ...base, fap: "12345" }, withIds(lpDefaults("Serviços")))
    const corrigido = autoFillTaxes({ ...base, fap: "1,0000" }, comAviso)
    expect(byTax(corrigido, "RAT").obs).not.toMatch(/FAP/)
    expect(num(corrigido, "RAT")).toBeCloseTo(200, 2)
  })
})

/* ============ PGDAS-D real: "2.6) Resumo da Declaração" ============ */
// Layout oficial (texto extraído pelo pdf.js de declarações reais): duas colunas,
// "Receita Bruta Auferida" e "Valor Total do Débito Declarado", com os valores
// NA ORDEM receita → DAS. Pegar o 1º número levava a receita para o DAS e a
// alíquota importada saía 100%.
describe("PGDAS-D — Resumo da Declaração (receita e DAS lado a lado)", () => {
  const T = [
    "PGDAS-D",
    "Período de Apuração: 01/09/2025 a 30/09/2025",
    "RPA) - Competência 117.984,12",
    "2.6)", " ", "Resumo", " ", "da Declaração", "Receita", " ", "Bruta Auferida", " ", "(regime", " ", "competência)",
    "Valor Total do Débito Declarado (R$)",
    "117.984,12", " ", "9.516,30", "", "2.7)", " ", "Informações",
  ].join("\n")
  const r = parsePGDASD(T)

  it("DAS é o 2º valor (9.516,30), não a receita", () => {
    expect(parseNumBR(r.das)).toBeCloseTo(9516.3, 2)
  })
  it("alíquota efetiva importada fica ~8,07%, não 100%", () => {
    expect((parseNumBR(r.das) / parseNumBR(r.rpa)) * 100).toBeCloseTo(8.0657, 3)
  })
})
