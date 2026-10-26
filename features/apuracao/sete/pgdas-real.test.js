// PGDAS-D REAIS — texto extraído pelo mesmo pdf.js do app (anonimizado: CNPJ, nome
// empresarial, nº da declaração/recibo/autenticação e dia da abertura trocados; valores
// e layout intactos). Cada fixture reproduz um defeito visto no lote de 107 declarações:
//  · pgdas-rodape-no-resumo*.txt  — o rodapé de página ("Número da Declaração… Página 1")
//    cai entre "Valor Total do Débito Declarado" e os valores do resumo (2.6);
//  · pgdas-rodape-na-tabela-2-8.txt — o rodapé corta a tabela do "2.8) Total Geral";
//  · pgdas-revenda-e-industria.txt — 3 atividades (revenda c/ e s/ ST + industrializada,
//    com IPI) e município de várias palavras.
// Os valores esperados foram conferidos no próprio texto do PDF (resumo 2.6 e tabela 2.8).
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  parsePGDASD,
  parseNumBR,
  aplicarPgdasD,
  autoFillTaxes,
  resumoApuracao,
  calculateTotalRevenue,
  rbtFatorR,
} from "./engine.js"

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__")
const fx = (name) => fs.readFileSync(path.join(DIR, name), "utf8")
const n = parseNumBR

// Simula o botão "Importar PGDAS-D" da tela: aplica sobre o estado atual e recalcula o DAS.
const importar = (prev, d) => {
  const next = aplicarPgdasD(prev, d)
  const dasTax = { id: 1, tax: "DAS", base: d.rpa || "", rate: "", apurado: d.das || "", retido: "", value: d.das || "", dueDate: "", obs: "", retidoManual: false }
  return { next, taxes: autoFillTaxes(next, [dasTax]) }
}

describe("PGDAS-D real — rodapé de página entre o rótulo e os valores do resumo (01/2023)", () => {
  const r = parsePGDASD(fx("pgdas-rodape-no-resumo.txt"))

  it("DAS = débito declarado 2.487,27 (não 450,38 da 1ª atividade)", () => {
    expect(n(r.das)).toBeCloseTo(2487.27, 2)
  })
  it("repartição = Total Geral da Empresa (2.8), somando as duas atividades", () => {
    expect(r.repart).toMatchObject({ IRPJ: 194.51, CSLL: 123.78, COFINS: 450.56, PIS: 97.61, CPP: 1467.68, ICMS: 153.13, IPI: 0, ISS: 0 })
    expect(r.repart.total).toBeCloseTo(2487.27, 2)
    expect(r.repart.exata).toBe(true)
  })
  it("RPA = 88.414,69 e RBT12 = 0,00", () => {
    expect(n(r.rpa)).toBeCloseTo(88414.69, 2)
    expect(n(r.rbt12)).toBe(0)
  })
  it("RBT12p vazia no PDF → não captura a RBA (88.414,69)", () => {
    expect(r.rbt12p).toBeUndefined()
  })
  it("município de duas palavras", () => {
    expect(r.municipio).toBe("ZE DOCA/MA")
  })
  it("atividade pelos blocos: só revenda de mercadorias → Comércio / Anexo I", () => {
    expect(r.atividade).toBe("Comércio")
    expect(r.anexo).toBe("Anexo I")
    expect(r.atividades).toHaveLength(2)
  })
  it("na tela: DAS 2.487,27, alíquota 2,8132% e carga = DAS/receita", () => {
    const { next, taxes } = importar({ regime: "Simples Nacional", atividade: "Serviços", anexo: "" }, r)
    const das = taxes.find((t) => t.tax === "DAS")
    expect(n(das.value)).toBeCloseTo(2487.27, 2)
    expect(n(das.rate)).toBeCloseTo((2487.27 / 88414.69) * 100, 4)
    const R = resumoApuracao(taxes, calculateTotalRevenue(next))
    expect(R.totalRecolherMes).toBeCloseTo(2487.27, 2)
  })
})

describe("PGDAS-D real — rodapé no resumo, empresa com RBT12 (01/2024)", () => {
  const r = parsePGDASD(fx("pgdas-rodape-no-resumo-2.txt"))
  it("DAS = 9.210,60 (não 8.960,69 da 1ª atividade)", () => {
    expect(n(r.das)).toBeCloseTo(9210.6, 2)
    expect(r.repart.total).toBeCloseTo(9210.6, 2)
  })
  it("RBT12 = 1.099.842,00; RBT12p vazia (não a RBA 107.883,27)", () => {
    expect(n(r.rbt12)).toBeCloseTo(1099842, 2)
    expect(r.rbt12p).toBeUndefined()
  })
  it("painéis (Fator R / alíquota / sublimite) usam a RBT12, não a RBA", () => {
    const { next } = importar({ regime: "Simples Nacional", atividade: "Comércio", anexo: "Anexo I" }, r)
    expect(rbtFatorR(next)).toBeCloseTo(1099842, 2)
  })
  it("município de uma palavra continua funcionando", () => {
    expect(r.municipio).toBe("ARAGUANA/MA")
  })
})

describe("PGDAS-D real — rodapé no meio da tabela 2.8 (10/2021)", () => {
  const r = parsePGDASD(fx("pgdas-rodape-na-tabela-2-8.txt"))
  it("DAS e repartição do Total Geral mesmo com o rodapé entre o cabeçalho e os valores", () => {
    expect(n(r.das)).toBeCloseTo(6925.32, 2)
    expect(r.repart).toMatchObject({ IRPJ: 385.57, CSLL: 245.36, COFINS: 893.13, PIS: 193.49, CPP: 2944.37, ICMS: 2263.4 })
    expect(r.repart.total).toBeCloseTo(6925.32, 2)
  })
  it("RBT12p vazia (RBA 967.667,03 não vira RBT12p)", () => {
    expect(r.rbt12p).toBeUndefined()
    expect(n(r.rbt12)).toBeCloseTo(1148434.74, 2)
  })
})

describe("PGDAS-D real — revenda + mercadoria industrializada (09/2025)", () => {
  const r = parsePGDASD(fx("pgdas-revenda-e-industria.txt"))
  it("DAS 9.516,30 com IPI 27,17 da atividade industrial", () => {
    expect(n(r.das)).toBeCloseTo(9516.3, 2)
    expect(r.repart.IPI).toBeCloseTo(27.17, 2)
    expect(r.repart.total).toBeCloseTo(9516.3, 2)
  })
  it("município de quatro palavras", () => {
    expect(r.municipio).toBe("SANTA LUZIA DO PARUA/MA")
  })
  it("3 blocos de atividade; predominante = revenda → Comércio; anexo não é presumido (I e II)", () => {
    expect(r.atividades.map((a) => a.tipo)).toEqual(["Comércio", "Comércio", "Indústria"])
    expect(r.atividade).toBe("Comércio")
    expect(r.anexo).toBeUndefined()
  })
  it("evolução: 12 meses com a competência = RPA", () => {
    expect(r.evolucao).toHaveLength(12)
    expect(r.evolucao[11]).toEqual({ ym: "09/2025", receita: 117984.12 })
  })
})

describe("Importação na tela — atividade do cadastro", () => {
  it("PGDAS com serviços + comércio ('Ambos', inexistente no Simples) mantém a atividade do cadastro", () => {
    const next = aplicarPgdasD({ regime: "Simples Nacional", atividade: "Serviços", clientId: "x" }, { atividade: "Ambos", rpa: "1,00" })
    expect(next.atividade).toBe("Serviços")
  })
  it("PGDAS sem blocos de atividade (sem certeza) não troca a atividade", () => {
    const next = aplicarPgdasD({ regime: "Simples Nacional", atividade: "Comércio" }, { rpa: "1,00" })
    expect(next.atividade).toBe("Comércio")
  })
  it("PGDAS só de revenda troca Serviços → Comércio", () => {
    const next = aplicarPgdasD({ regime: "Simples Nacional", atividade: "Serviços" }, { atividade: "Comércio" })
    expect(next.atividade).toBe("Comércio")
  })
})
