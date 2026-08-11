// Testes de caracterização do motor de apuração (engine.js).
// Objetivo: travar o comportamento ATUAL antes do refactor do Relatório Executivo,
// para provar que mudanças de cálculo são deliberadas e não regressões acidentais.
// Snapshots capturam a saída completa por regime; os asserts explícitos documentam
// os valores fiscalmente críticos (base legal conhecida).
import { describe, it, expect } from "vitest"
import {
  autoFillTaxes,
  lpDefaults,
  DEFAULT_TAXES_SN_SERVICOS,
  DEFAULT_TAXES_SN_COMERCIO,
  DEFAULT_TAXES_MEI_SERVICOS,
  calcAliquotaEfetivaSN,
  getBasePresumidaLP,
  getDueDate,
  parseNumBR,
  calculateTotalRevenue,
  SALARIO_MINIMO,
  resumoApuracao,
  avisosApuracao,
  acumuladoPeriodo,
} from "./engine.js"

// Projeção estável dos tributos p/ snapshot (ignora id, que é volátil).
const project = (taxes) =>
  taxes.map((t) => ({
    tax: t.tax,
    base: t.base,
    rate: t.rate,
    apurado: t.apurado,
    retido: t.retido,
    value: t.value,
    dueDate: t.dueDate,
    provisao: t.provisao ?? undefined,
  }))

const byTax = (taxes, name) => taxes.find((t) => t.tax === name)

/* ===================== Helpers puros ===================== */

describe("calcAliquotaEfetivaSN — tabelas do Simples", () => {
  it("Anexo I, RBT12 na 1ª faixa (4%)", () => {
    const r = calcAliquotaEfetivaSN(120000, "Anexo I")
    expect(r.nominal).toBe(4)
    expect(r.faixa).toBe(1)
    expect(r.rate).toBeCloseTo(4, 5)
  })
  it("Anexo III, RBT12 R$ 500.000 (3ª faixa, 13,5% − 17.640)", () => {
    const r = calcAliquotaEfetivaSN(500000, "Anexo III")
    expect(r.nominal).toBe(13.5)
    expect(r.faixa).toBe(3)
    // (500000*0.135 - 17640)/500000*100 = 9,972%
    expect(r.rate).toBeCloseTo(9.972, 3)
  })
  it("RBT12 = 0 (empresa nova sem histórico) → 1ª faixa, efetiva = nominal", () => {
    const r = calcAliquotaEfetivaSN(0, "Anexo III")
    expect(r.faixa).toBe(1)
    expect(r.nominal).toBe(6)
    expect(r.rate).toBeCloseTo(6, 5)
  })
})

describe("getBasePresumidaLP — bases presumidas", () => {
  it("Serviços 32% p/ IRPJ e CSLL", () => {
    expect(getBasePresumidaLP(100000, "IRPJ", "Serviços", "Mensal (Provisão)", 0)).toBeCloseTo(32000, 2)
    expect(getBasePresumidaLP(100000, "CSLL", "Serviços", "Mensal (Provisão)", 0)).toBeCloseTo(32000, 2)
  })
  it("Comércio 8% IRPJ / 12% CSLL", () => {
    expect(getBasePresumidaLP(100000, "IRPJ", "Comércio", "Mensal (Provisão)", 0)).toBeCloseTo(8000, 2)
    expect(getBasePresumidaLP(100000, "CSLL", "Comércio", "Mensal (Provisão)", 0)).toBeCloseTo(12000, 2)
  })
  it("Adicional IRPJ: base menos limite mensal R$ 20.000 (Serviços)", () => {
    // base IRPJ = 32.000 → adicional sobre 12.000
    expect(getBasePresumidaLP(100000, "Adicional IRPJ", "Serviços", "Mensal (Provisão)", 0)).toBeCloseTo(12000, 2)
  })
  it("Adicional IRPJ trimestral usa limite R$ 60.000", () => {
    // base IRPJ = 32% de 300.000 = 96.000 → adicional sobre 36.000
    expect(getBasePresumidaLP(300000, "Adicional IRPJ", "Serviços", "Trimestral (Apuração)", 0)).toBeCloseTo(36000, 2)
  })
  it("Estimativa Anual: limite do adicional proporcional aos meses acumulados (Fase 1.6)", () => {
    // base IRPJ = 32% de 300.000 (acumulado 3 meses) = 96.000; limite 20.000×3 = 60.000 → adicional sobre 36.000
    expect(getBasePresumidaLP(300000, "Adicional IRPJ", "Serviços", "Estimativa (Anual)", 0, 3)).toBeCloseTo(36000, 2)
    // sem nº de meses (default 1) mantém o limite de um mês
    expect(getBasePresumidaLP(100000, "Adicional IRPJ", "Serviços", "Estimativa (Anual)", 0, 1)).toBeCloseTo(12000, 2)
  })
})

describe("getDueDate — comportamento atual (pré-refactor)", () => {
  // BUG CONHECIDO: IRPJ/CSLL em 'Mensal (Provisão)' recebem vencimento mensal.
  // Caracteriza o atual; muda na Fase 1.1 (provisão sem vencimento).
  it("[atual] IRPJ 'Mensal (Provisão)' recebe vencimento no mês seguinte", () => {
    const d = getDueDate("5", "2026", "IRPJ", "Mensal (Provisão)")
    expect(d).toMatch(/^\d{2}\/06\/2026$/)
  })
  it("IRPJ 'Trimestral (Apuração)' fora do fechamento não tem vencimento", () => {
    expect(getDueDate("5", "2026", "IRPJ", "Trimestral (Apuração)")).toBe("")
  })
  it("IRPJ 'Trimestral (Apuração)' no fechamento (jun) tem vencimento em jul", () => {
    expect(getDueDate("6", "2026", "IRPJ", "Trimestral (Apuração)")).toMatch(/^\d{2}\/07\/2026$/)
  })
  it("PIS vence dia 25 do mês seguinte (com ajuste de dia útil)", () => {
    expect(getDueDate("5", "2026", "PIS")).toMatch(/\/06\/2026$/)
  })
})

/* ===================== autoFillTaxes por regime ===================== */

describe("autoFillTaxes — Lucro Presumido / Serviços", () => {
  const data = {
    regime: "Lucro Presumido",
    atividade: "Serviços",
    revenueRetained: "10.000,00",
    revenueNonRetained: "90.000,00",
    compMonth: "5",
    compYear: "2026",
    folhaMensal: "20.000,00",
    proLabore: "10.000,00",
    irpjCsllMode: "Mensal (Provisão)",
  }
  const out = autoFillTaxes(data, lpDefaults("Serviços").map((t, i) => ({ ...t, id: i + 1 })))

  it("faturamento total = COM + SEM retenção", () => {
    expect(calculateTotalRevenue(data)).toBe(100000)
  })
  it("PIS = 0,65% da receita", () => {
    expect(parseNumBR(byTax(out, "PIS").apurado)).toBeCloseTo(650, 2)
  })
  it("COFINS = 3% da receita", () => {
    expect(parseNumBR(byTax(out, "COFINS").apurado)).toBeCloseTo(3000, 2)
  })
  it("ISS = 5% da receita", () => {
    expect(parseNumBR(byTax(out, "ISS").apurado)).toBeCloseTo(5000, 2)
  })
  it("IRPJ = 15% da base presumida (32%)", () => {
    expect(parseNumBR(byTax(out, "IRPJ").apurado)).toBeCloseTo(4800, 2)
  })
  it("Adicional IRPJ = 10% sobre o que excede R$ 20.000 da base", () => {
    expect(parseNumBR(byTax(out, "Adicional IRPJ").apurado)).toBeCloseTo(1200, 2)
  })
  it("CSLL = 9% da base presumida (32%)", () => {
    expect(parseNumBR(byTax(out, "CSLL").apurado)).toBeCloseTo(2880, 2)
  })
  it("CPP = 20% de (folha + pró-labore)", () => {
    expect(parseNumBR(byTax(out, "CPP (Patronal)").apurado)).toBeCloseTo(6000, 2)
  })
  it("FGTS = 8% da folha (sem pró-labore)", () => {
    expect(parseNumBR(byTax(out, "FGTS").apurado)).toBeCloseTo(1600, 2)
  })
  it("retenção de PIS = 0,65% da receita COM retenção", () => {
    expect(parseNumBR(byTax(out, "PIS").retido)).toBeCloseTo(65, 2)
  })
  it("snapshot completo (LP Serviços)", () => {
    expect(project(out)).toMatchSnapshot()
  })
})

describe("autoFillTaxes — Lucro Presumido / Comércio (lançamento guiado)", () => {
  const data = {
    regime: "Lucro Presumido",
    atividade: "Comércio",
    revenueNonRetained: "200.000,00",
    icmsApurado: "18.400,00", // ICMS próprio do SPED (valor lançado, não calculado)
    compMonth: "5",
    compYear: "2026",
    folhaMensal: "15.000,00",
    irpjCsllMode: "Mensal (Provisão)",
  }
  const out = autoFillTaxes(data, lpDefaults("Comércio").map((t, i) => ({ ...t, id: i + 1 })))

  it("PIS = 0,65% / COFINS = 3% da receita (cumulativo)", () => {
    expect(parseNumBR(byTax(out, "PIS").apurado)).toBeCloseTo(1300, 2)
    expect(parseNumBR(byTax(out, "COFINS").apurado)).toBeCloseTo(6000, 2)
  })
  it("IRPJ base 8% → 15% de 16.000 = 2.400", () => {
    expect(parseNumBR(byTax(out, "IRPJ").apurado)).toBeCloseTo(2400, 2)
  })
  it("CSLL base 12% → 9% de 24.000 = 2.160", () => {
    expect(parseNumBR(byTax(out, "CSLL").apurado)).toBeCloseTo(2160, 2)
  })
  it("ICMS = valor lançado do SPED (não estimado)", () => {
    expect(parseNumBR(byTax(out, "ICMS").apurado)).toBeCloseTo(18400, 2)
  })
  it("snapshot completo (LP Comércio)", () => {
    expect(project(out)).toMatchSnapshot()
  })
})

describe("Comércio — guias estaduais por valor lançado", () => {
  const data = {
    regime: "Lucro Presumido",
    atividade: "Comércio",
    revenueNonRetained: "250.000,00",
    icmsApurado: "22.000,00",
    receitaMonofasica: "60.000,00", // CST 04/05/06/09 → fora da base de PIS/COFINS
    icmsStValor: "4.500,00",
    difalValor: "1.300,00",
    antecipacaoValor: "2.100,00",
    fumacopValor: "1.800,00",
    compMonth: "5",
    compYear: "2026",
  }
  // Simula o que o recalcular monta: núcleo + guias estaduais ligadas por interruptor
  const taxes = [
    ...lpDefaults("Comércio"),
    { tax: "ICMS (ST)", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "", retidoManual: false },
    { tax: "Antecipação Parcial", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "", retidoManual: false },
    { tax: "DIFAL", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "", retidoManual: false },
    { tax: "FUMACOP", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "", retidoManual: false },
  ].map((t, i) => ({ ...t, id: i + 1 }))
  const out = autoFillTaxes(data, taxes)

  it("cada guia estadual recebe o valor lançado (não calculado)", () => {
    expect(parseNumBR(byTax(out, "ICMS").apurado)).toBeCloseTo(22000, 2)
    expect(parseNumBR(byTax(out, "ICMS (ST)").apurado)).toBeCloseTo(4500, 2)
    expect(parseNumBR(byTax(out, "DIFAL").apurado)).toBeCloseTo(1300, 2)
    expect(parseNumBR(byTax(out, "Antecipação Parcial").apurado)).toBeCloseTo(2100, 2)
    expect(parseNumBR(byTax(out, "FUMACOP").apurado)).toBeCloseTo(1800, 2)
  })
  it("PIS/COFINS excluem a receita sem PIS/COFINS (CST 04/05/06/09)", () => {
    // base = 250.000 − 60.000 = 190.000 → PIS 1.235, COFINS 5.700
    expect(parseNumBR(byTax(out, "PIS").apurado)).toBeCloseTo(1235, 2)
    expect(parseNumBR(byTax(out, "COFINS").apurado)).toBeCloseTo(5700, 2)
  })
  it("vencimentos automáticos por tipo (ICMS-ST/DIFAL dia 10; FUMACOP/Antecipação dia 20)", () => {
    expect(byTax(out, "ICMS (ST)").dueDate).toMatch(/^\d{2}\/06\/2026$/)
    expect(byTax(out, "DIFAL").dueDate).toMatch(/^\d{2}\/06\/2026$/)
    expect(byTax(out, "FUMACOP").dueDate).toMatch(/^\d{2}\/06\/2026$/)
  })
})

describe("autoFillTaxes — Simples Nacional / Serviços", () => {
  const data = {
    regime: "Simples Nacional",
    atividade: "Serviços",
    anexo: "Anexo III",
    revenue: "50.000,00",
    rbt12: "500.000,00",
    folha12m: "180.000,00",
    compMonth: "5",
    compYear: "2026",
  }
  const out = autoFillTaxes(data, DEFAULT_TAXES_SN_SERVICOS.map((t, i) => ({ ...t, id: i + 1 })))

  it("DAS calculado pela alíquota efetiva do Anexo III (3ª faixa)", () => {
    // rate efetiva ≈ 9,972% → DAS ≈ 4.986
    expect(parseNumBR(byTax(out, "DAS").apurado)).toBeCloseTo(4986, 0)
  })
  it("snapshot completo (SN Serviços)", () => {
    expect(project(out)).toMatchSnapshot()
  })
})

describe("autoFillTaxes — Simples / empresa nova sem RBT12 (caso Cionê)", () => {
  // PGDAS-D 07/2026 Cionê: Anexo III, RBT12 = 0 (meses anteriores zerados),
  // RPA 15.960,95 → DAS 957,66 (6% exatos). Antes ficava em branco.
  const data = {
    regime: "Simples Nacional",
    atividade: "Serviços",
    anexo: "Anexo III",
    revenue: "15.960,95",
    rbt12: "0",
    compMonth: "7",
    compYear: "2026",
  }
  const out = autoFillTaxes(data, DEFAULT_TAXES_SN_SERVICOS.map((t, i) => ({ ...t, id: i + 1 })))

  it("DAS = 6% (1ª faixa) da receita, batendo com o PGDAS-D", () => {
    expect(parseNumBR(byTax(out, "DAS").rate)).toBeCloseTo(6, 4)
    expect(parseNumBR(byTax(out, "DAS").apurado)).toBeCloseTo(957.66, 2)
  })
})

describe("autoFillTaxes — Simples com folha: FGTS 8%", () => {
  const data = {
    regime: "Simples Nacional",
    atividade: "Serviços",
    anexo: "Anexo III",
    revenue: "50.000,00",
    rbt12: "500.000,00",
    folhaMensal: "10.000,00",
    compMonth: "5",
    compYear: "2026",
  }
  // FGTS entra pela reconciliação da tela; aqui simulamos a linha já presente.
  const taxes = [
    ...DEFAULT_TAXES_SN_SERVICOS,
    { id: 90, tax: "FGTS", base: "", rate: "8,00", apurado: "", retido: "", value: "", dueDate: "", obs: "", retidoManual: false },
  ].map((t, i) => ({ ...t, id: i + 1 }))
  const out = autoFillTaxes(data, taxes)

  it("FGTS = 8% da folha mensal", () => {
    expect(parseNumBR(byTax(out, "FGTS").apurado)).toBeCloseTo(800, 2)
    expect(parseNumBR(byTax(out, "FGTS").value)).toBeCloseTo(800, 2)
  })
})

describe("autoFillTaxes — MEI / Serviços", () => {
  const data = { regime: "MEI", atividade: "Serviços", compMonth: "5", compYear: "2026" }
  const out = autoFillTaxes(data, DEFAULT_TAXES_MEI_SERVICOS.map((t, i) => ({ ...t, id: i + 1 })))

  it("DAS-MEI = 5% do salário mínimo + ISS R$ 5,00", () => {
    expect(parseNumBR(byTax(out, "DAS-MEI").value)).toBeCloseTo(SALARIO_MINIMO * 0.05 + 5, 2)
  })
  it("snapshot completo (MEI)", () => {
    expect(project(out)).toMatchSnapshot()
  })
})

describe("Vazamento de receita e monofásica (Fases 1.4 / 1.5)", () => {
  it("LP Comércio ignora 'receita com retenção' — usa só as saídas", () => {
    expect(calculateTotalRevenue({ regime: "Lucro Presumido", atividade: "Comércio", revenueRetained: "50.000,00", revenueNonRetained: "200.000,00" })).toBe(200000)
  })
  it("LP Serviços soma receita com + sem retenção", () => {
    expect(calculateTotalRevenue({ regime: "Lucro Presumido", atividade: "Serviços", revenueRetained: "10.000,00", revenueNonRetained: "90.000,00" })).toBe(100000)
  })
  it("monofásica NÃO abate PIS/COFINS em Serviços (campo é de comércio)", () => {
    const out = autoFillTaxes(
      { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", receitaMonofasica: "40.000,00", compMonth: "5", compYear: "2026" },
      lpDefaults("Serviços").map((t, i) => ({ ...t, id: i + 1 })),
    )
    expect(parseNumBR(byTax(out, "PIS").apurado)).toBeCloseTo(650, 2)
  })
  it("monofásica abate PIS/COFINS em Comércio", () => {
    const out = autoFillTaxes(
      { regime: "Lucro Presumido", atividade: "Comércio", revenueNonRetained: "100.000,00", receitaMonofasica: "40.000,00", compMonth: "5", compYear: "2026" },
      lpDefaults("Comércio").map((t, i) => ({ ...t, id: i + 1 })),
    )
    // base = 100.000 − 40.000 = 60.000 → PIS 0,65% = 390
    expect(parseNumBR(byTax(out, "PIS").apurado)).toBeCloseTo(390, 2)
  })
})

describe("IRPJ/CSLL — provisão × recolhimento (dois perfis)", () => {
  const base = {
    regime: "Lucro Presumido",
    atividade: "Serviços",
    revenueNonRetained: "100.000,00",
    compYear: "2026",
    irpjCsllMode: "Trimestral (Apuração)",
  }
  const run = (data) => autoFillTaxes(data, lpDefaults("Serviços").map((t, i) => ({ ...t, id: i + 1 })))

  it("Trimestral, mês comum (mai): IRPJ/CSLL são provisão, sem vencimento", () => {
    const out = run({ ...base, compMonth: "5" })
    expect(byTax(out, "IRPJ").provisao).toBe(true)
    expect(byTax(out, "CSLL").provisao).toBe(true)
    expect(byTax(out, "IRPJ").dueDate).toBe("")
  })
  it("Trimestral, fechamento (jun): IRPJ/CSLL viram guia real com vencimento", () => {
    const out = run({ ...base, compMonth: "6" })
    expect(byTax(out, "IRPJ").provisao).toBe(false)
    expect(byTax(out, "IRPJ").dueDate).toMatch(/\/07\/2026$/)
  })
  it("Mensal (antecipado): IRPJ/CSLL recolhem todo mês, não são provisão", () => {
    const out = run({ ...base, compMonth: "5", irpjCsllMode: "Mensal (Provisão)" })
    expect(byTax(out, "IRPJ").provisao).toBe(false)
    expect(byTax(out, "IRPJ").dueDate).toMatch(/\/06\/2026$/)
  })
  it("provisão sai do total do mês mas entra na carga do período", () => {
    const out = run({ ...base, compMonth: "5" })
    const R = resumoApuracao(out, 100000)
    // IRPJ (4.800) + CSLL (2.880) provisionados. Adicional = 0 no mês (limite
    // trimestral R$ 60k sobre a base mensal de R$ 32k → sem excedente).
    expect(R.totalProvisao).toBeCloseTo(7680, 2)
    // não entram no caixa do mês
    expect(R.totalRecolherMes).toBeGreaterThan(0)
    // mas contam na carga efetiva (base sobre receita)
    expect(R.baseCarga).toBeGreaterThanOrEqual(7680)
  })
})

describe("acumuladoPeriodo — soma do período pelo histórico salvo (LP)", () => {
  const base = { regime: "Lucro Presumido", atividade: "Comércio", compYear: "2026", revenueNonRetained: "150.000,00" }
  const records = [
    { compKey: "2026-04", faturamento: 100000 },
    { compKey: "2026-05", faturamento: 120000 },
    { compKey: "2026-01", faturamento: 90000 },
    { compKey: "2026-02", faturamento: 110000 },
    { compKey: "2026-03", faturamento: 130000 },
  ]
  it("Trimestral, junho (Q2): abr + mai salvos + junho vivo", () => {
    const r = acumuladoPeriodo({ ...base, compMonth: "6", irpjCsllMode: "Trimestral (Apuração)" }, records)
    expect(r.total).toBeCloseTo(370000, 2) // 100k + 120k + 150k
    expect(r.salvos).toBe(2)
    expect(r.faltando).toBe(0)
    expect(r.meses).toBe(3)
  })
  it("Trimestral, abril (início do trimestre): só o mês corrente", () => {
    const r = acumuladoPeriodo({ ...base, compMonth: "4", irpjCsllMode: "Trimestral (Apuração)" }, records)
    expect(r.total).toBeCloseTo(150000, 2)
    expect(r.meses).toBe(1)
  })
  it("Estimativa, março: jan + fev salvos + março vivo", () => {
    const r = acumuladoPeriodo({ ...base, compMonth: "3", irpjCsllMode: "Estimativa (Anual)" }, records)
    expect(r.total).toBeCloseTo(90000 + 110000 + 150000, 2)
    expect(r.salvos).toBe(2)
  })
  it("mês faltante no período conta como 0 e é sinalizado", () => {
    const r = acumuladoPeriodo({ ...base, compMonth: "6", irpjCsllMode: "Trimestral (Apuração)" }, [{ compKey: "2026-05", faturamento: 120000 }])
    expect(r.total).toBeCloseTo(120000 + 150000, 2) // abril faltando
    expect(r.faltando).toBe(1)
  })
  it("modo Mensal (antecipado) não acumula → null", () => {
    expect(acumuladoPeriodo({ ...base, compMonth: "6", irpjCsllMode: "Mensal (Provisão)" }, records)).toBeNull()
  })
})

describe("resumoApuracao — fonte única de totais", () => {
  const taxes = [
    { tax: "PIS", apurado: "650,00", retido: "", value: "650,00" },
    { tax: "ISS", apurado: "5.000,00", retido: "", value: "5.000,00" },
    { tax: "CPP (Patronal)", apurado: "6.000,00", retido: "", value: "6.000,00" }, // folha → fora da carga
    { tax: "IRPJ", apurado: "4.800,00", retido: "", value: "4.800,00", provisao: true }, // provisão → fora do caixa do mês
    { tax: "ISS (retido)", apurado: "300,00", retido: "", value: "300,00" }, // informativa
  ]
  const R = resumoApuracao(taxes, 100000)

  it("totalRecolherMes exclui provisão e linhas (retido)", () => {
    // 650 + 5000 + 6000 (IRPJ é provisão, ISS(retido) é informativa)
    expect(R.totalRecolherMes).toBeCloseTo(11650, 2)
  })
  it("totalProvisao soma só as linhas de provisão", () => {
    expect(R.totalProvisao).toBeCloseTo(4800, 2)
  })
  it("baseCarga inclui provisão (imposto do período) e exclui folha", () => {
    // PIS 650 + ISS 5000 + IRPJ 4800 (CPP folha fora; ISS retido fora)
    expect(R.baseCarga).toBeCloseTo(10450, 2)
    expect(R.cargaEfetiva).toBeCloseTo(10.45, 4)
  })
  it("liquido = faturamento − baseCarga (não desconta folha nem retenção)", () => {
    expect(R.liquido).toBeCloseTo(89550, 2)
  })
})

describe("Locks manuais preservam edições no recálculo (Fase 2)", () => {
  const data = { regime: "Lucro Presumido", atividade: "Serviços", revenueNonRetained: "100.000,00", compMonth: "5", compYear: "2026", irpjCsllMode: "Mensal (Provisão)" }
  const fresh = () => autoFillTaxes(data, lpDefaults("Serviços").map((t, i) => ({ ...t, id: i + 1 })))

  it("valueManual preserva o 'A pagar' digitado à mão", () => {
    const out1 = fresh()
    const iss = out1.find((t) => t.tax === "ISS")
    iss.value = "1.234,56"; iss.valueManual = true
    const out2 = autoFillTaxes(data, out1)
    expect(out2.find((t) => t.tax === "ISS").value).toBe("1.234,56")
  })
  it("apuradoManual preserva o apurado e recalcula o value a partir dele", () => {
    const out1 = fresh()
    const irpj = out1.find((t) => t.tax === "IRPJ")
    irpj.apurado = "9.999,00"; irpj.apuradoManual = true
    const out2 = autoFillTaxes(data, out1)
    const irpj2 = out2.find((t) => t.tax === "IRPJ")
    expect(irpj2.apurado).toBe("9.999,00")
    expect(parseNumBR(irpj2.value)).toBeCloseTo(9999, 2)
  })
  it("sem lock, o recálculo sobrescreve normalmente", () => {
    const out1 = fresh()
    out1.find((t) => t.tax === "ISS").value = "1.234,56" // sem flag
    const out2 = autoFillTaxes(data, out1)
    expect(parseNumBR(out2.find((t) => t.tax === "ISS").value)).toBeCloseTo(5000, 2)
  })
  it("as flags de lock são carregadas adiante (sobrevivem ao recálculo)", () => {
    const out1 = fresh()
    const iss = out1.find((t) => t.tax === "ISS")
    iss.value = "1.234,56"; iss.valueManual = true
    const out2 = autoFillTaxes(data, out1)
    expect(out2.find((t) => t.tax === "ISS").valueManual).toBe(true)
  })
})

describe("avisosApuracao — sanidade / anti-erro (Fase 5)", () => {
  it("retido maior que apurado gera aviso", () => {
    const a = avisosApuracao([{ tax: "ISS", apurado: "100,00", retido: "150,00", rate: "5,00" }])
    expect(a.some((x) => x.tax === "ISS" && /retido/.test(x.msg))).toBe(true)
  })
  it("ISS fora da faixa 2–5% gera aviso; dentro não", () => {
    expect(avisosApuracao([{ tax: "ISS", apurado: "100,00", rate: "8,00" }]).some((x) => /fora da faixa/.test(x.msg))).toBe(true)
    expect(avisosApuracao([{ tax: "ISS", apurado: "100,00", rate: "5,00" }]).some((x) => /fora da faixa/.test(x.msg))).toBe(false)
  })
  it("tributo duplicado gera aviso", () => {
    const a = avisosApuracao([{ tax: "ISS", rate: "5,00" }, { tax: "ISS", rate: "5,00" }])
    expect(a.some((x) => /duplicidade/.test(x.msg))).toBe(true)
  })
  it("alíquota acima de 100% gera aviso", () => {
    expect(avisosApuracao([{ tax: "PIS", apurado: "10,00", rate: "150,00" }]).some((x) => /acima de 100/.test(x.msg))).toBe(true)
  })
  it("apuração normal não gera avisos", () => {
    const a = avisosApuracao([
      { tax: "PIS", apurado: "650,00", retido: "", rate: "0,65" },
      { tax: "ISS", apurado: "5.000,00", retido: "", rate: "5,00" },
    ])
    expect(a.length).toBe(0)
  })
})

