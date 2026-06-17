// Motor de apuração — portado de Relatorio Fiscal Mensal.html.
// Lógica fiscal validada (Simples Anexo I/III/V com Fator R, Lucro Presumido,
// equiparação hospitalar, retenções). Valores monetários trafegam como string "pt-BR".
import type { Apuracao, ClientData, Economia, LpInfo, RepartItem, SnInfo, TaxRow } from "./types"

/* ===== Helpers de formatação ===== */
export const parseBR = (v: unknown): number => {
  if (typeof v === "number") return v
  if (!v) return 0
  return parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0
}
export const fmtBRL = (val: unknown): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseBR(val) || 0)
export const fmtNum = (num: unknown): string => {
  if (num === "" || num === null || num === undefined) return ""
  return parseBR(num).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export const fmtPct = (val: unknown): string => (parseBR(val) || 0).toFixed(2).replace(".", ",") + "%"
export const fmtCNPJ = (v: unknown): string => {
  const d = String(v || "").replace(/\D/g, "").slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}
/** Máscara de digitação monetária (centavos da direita p/ esquerda). */
export const maskBRL = (raw: unknown): string => {
  if (raw === "" || raw === null || raw === undefined) return ""
  const digits = String(raw).replace(/\D/g, "")
  if (!digits) return ""
  return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ===== Tabelas do Simples Nacional (LC 123/2006) — [limite RBT12, alíquota nominal %, parcela a deduzir] ===== */
export const SN_TAB: Record<string, [number, number, number][]> = {
  "Anexo I": [[180000, 4.0, 0], [360000, 7.3, 5940], [720000, 9.5, 13860], [1800000, 10.7, 22500], [3600000, 14.3, 87300], [4800000, 19.0, 378000]],
  "Anexo III": [[180000, 6.0, 0], [360000, 11.2, 9360], [720000, 13.5, 17640], [1800000, 16.0, 35640], [3600000, 21.0, 125640], [4800000, 33.0, 648000]],
  "Anexo V": [[180000, 15.5, 0], [360000, 18.0, 4500], [720000, 19.5, 9900], [1800000, 20.5, 17100], [3600000, 23.0, 62100], [4800000, 30.5, 540000]],
}
// Repartição dos tributos dentro do DAS (por faixa) — ordem: IRPJ, CSLL, COFINS, PIS, CPP, ICMS/ISS
export const SN_REPART: Record<string, [string | null, number[]][]> = {
  "Anexo I": [
    ["ICMS", [5.5, 3.5, 12.74, 2.76, 41.5, 34.0]],
    [null, [5.5, 3.5, 12.74, 2.76, 41.5, 34.0]],
    [null, [5.5, 3.5, 12.74, 2.76, 42.0, 33.5]],
    [null, [5.5, 3.5, 12.74, 2.76, 42.0, 33.5]],
    [null, [5.5, 3.5, 12.74, 2.76, 42.0, 33.5]],
    [null, [13.5, 10.0, 28.27, 6.13, 42.1, 0]],
  ],
  "Anexo III": [
    ["ISS", [4.0, 3.5, 12.82, 2.78, 43.4, 33.5]],
    [null, [4.0, 3.5, 14.05, 3.05, 43.4, 32.0]],
    [null, [4.0, 3.5, 13.64, 2.96, 43.4, 32.5]],
    [null, [4.0, 3.5, 13.64, 2.96, 43.4, 32.5]],
    [null, [4.0, 3.5, 12.82, 2.78, 43.4, 33.5]],
    [null, [35.0, 15.0, 16.03, 3.47, 30.5, 0]],
  ],
  "Anexo V": [
    ["ISS", [25.0, 15.0, 14.1, 3.05, 28.85, 14.0]],
    [null, [23.0, 15.0, 14.1, 3.05, 27.85, 17.0]],
    [null, [24.0, 15.0, 14.92, 3.23, 23.85, 19.0]],
    [null, [21.0, 15.0, 15.74, 3.41, 23.85, 21.0]],
    [null, [23.0, 12.5, 14.1, 3.05, 23.85, 23.5]],
    [null, [35.0, 15.5, 16.44, 3.56, 29.5, 0]],
  ],
}
export const REPART_LABELS = ["IRPJ", "CSLL", "COFINS", "PIS/PASEP", "CPP"] // + 6º (ICMS ou ISS)

export const calcSN = (rbt12: number, anexo: string) => {
  const tab = SN_TAB[anexo]
  if (!tab || rbt12 <= 0) return { rate: 0, nominal: 0, deducao: 0, faixa: 0 }
  const idx = tab.findIndex((f) => rbt12 <= f[0])
  const fi = idx === -1 ? tab.length - 1 : idx
  const f = tab[fi]
  const eff = ((rbt12 * (f[1] / 100)) - f[2]) / rbt12 * 100
  return { rate: Math.max(eff, 0), nominal: f[1], deducao: f[2], faixa: fi + 1 }
}
export const calcFatorR = (folha12: number, rbt12: number): number => (!rbt12 || rbt12 <= 0 ? 0 : (folha12 / rbt12) * 100)
export const anexoEfetivo = (anexo: string, fatorR: number): string => {
  if (anexo === "Anexo V" && fatorR >= 28) return "Anexo III"
  if (anexo === "Anexo III" && fatorR > 0 && fatorR < 28) return "Anexo V"
  return anexo
}
export const repartirDAS = (das: number, anexo: string, faixa: number): RepartItem[] => {
  const tab = SN_REPART[anexo]
  if (!tab || das <= 0) return []
  const perc = tab[Math.max(0, faixa - 1)][1]
  const sexto = anexo === "Anexo I" ? "ICMS" : "ISS"
  const nomes = [...REPART_LABELS, sexto]
  return nomes.map((nome, i) => ({ tax: nome, pct: perc[i], value: (das * perc[i]) / 100 })).filter((r) => r.value > 0.005)
}

/* ===== Vencimentos ===== */
const lastBizDay = (m: number, y: number): number => {
  const d = new Date(y, m, 0)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d.getDate()
}
export const adjustWeekend = (y: number, m: number, d: number, mode: "next" | "prev"): Date => {
  const dt = new Date(y, m - 1, d)
  const wd = dt.getDay()
  if (wd === 6) dt.setDate(dt.getDate() + (mode === "prev" ? -1 : 2))
  else if (wd === 0) dt.setDate(dt.getDate() + (mode === "prev" ? -2 : 1))
  return dt
}
export const dueDate = (compMonth?: string, compYear?: string, tax = ""): string => {
  if (!compMonth || !compYear) return ""
  const m = parseInt(compMonth)
  const y = parseInt(compYear)
  let nm = m + 1
  let ny = y
  if (nm > 12) { nm = 1; ny++ }
  const pad = (n: number) => String(n).padStart(2, "0")
  const fmt = (dt: Date) => `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`
  if (["IRPJ", "CSLL", "Adicional IRPJ"].includes(tax)) return `${pad(lastBizDay(nm, ny))}/${pad(nm)}/${ny}`
  const map: Record<string, number> = {
    PIS: 25, COFINS: 25, ISS: 10, "ISS (próprio)": 10, "INSS (Pró-labore)": 20,
    "CPP (Patronal)": 20, RAT: 20, Terceiros: 20, FGTS: 7, DAS: 20, ICMS: 20,
  }
  const dia = map[tax]
  if (!dia) return ""
  return fmt(adjustWeekend(ny, nm, dia, tax === "FGTS" ? "prev" : "next"))
}

/* ===== Presunções Lucro Presumido ===== */
const PRES_IRPJ: Record<string, number> = { Serviços: 0.32, Comércio: 0.08, Indústria: 0.08 }
const PRES_CSLL: Record<string, number> = { Serviços: 0.32, Comércio: 0.12, Indústria: 0.12 }

/* ===== Motor de apuração ===== */
export function computeApuracao(cd: ClientData): Apuracao {
  const regime = cd.regime || "Lucro Presumido"
  const atividade = cd.atividade || "Serviços"
  const revenue = parseBR(cd.revenue)
  const proLabore = parseBR(cd.proLabore)
  const folhaMensal = parseBR(cd.folhaMensal)
  const ret = cd.ret || {}
  const taxes: TaxRow[] = []

  // ---------- SIMPLES NACIONAL ----------
  let sn: SnInfo | null = null
  if (regime === "Simples Nacional") {
    const rbt12 = parseBR(cd.rbt12)
    const folha12 = parseBR(cd.folha12m)
    const fatorR = calcFatorR(folha12, rbt12)
    const anexoBase = cd.anexo || "Anexo III"
    const anexoEf = anexoEfetivo(anexoBase, fatorR)
    const r = calcSN(rbt12, anexoEf)
    const das = (revenue * r.rate) / 100
    sn = { rbt12, folha12, fatorR, anexoBase, anexoEf, ...r, das, repart: [] }

    taxes.push({
      tax: "DAS", base: fmtNum(revenue), rate: r.rate.toFixed(2).replace(".", ","),
      apurado: fmtNum(das), retido: "", value: fmtNum(das),
      dueDate: dueDate(cd.compMonth, cd.compYear, "DAS"),
      obs: `${anexoEf} • Faixa ${r.faixa} • Alíq. nominal ${r.nominal.toFixed(2).replace(".", ",")}%`,
      group: "DAS",
    })
    let repart = repartirDAS(das, anexoEf, r.faixa)
    if (cd.repartManual) {
      const rm = cd.repartManual
      repart = repart.map((x) => {
        const ov = rm[x.tax]
        return ov !== undefined && ov !== "" ? { ...x, value: parseBR(ov), pct: das > 0 ? (parseBR(ov) / das) * 100 : 0 } : x
      })
    }
    sn.repart = repart

    if (proLabore > 0) {
      taxes.push({
        tax: "INSS (Pró-labore)", base: fmtNum(proLabore), rate: "11,00",
        apurado: fmtNum(proLabore * 0.11), retido: "", value: fmtNum(proLabore * 0.11),
        dueDate: dueDate(cd.compMonth, cd.compYear, "INSS (Pró-labore)"),
        obs: "Retenção previdenciária do segurado sobre o pró-labore", group: "Folha",
      })
    }
  }

  // ---------- LUCRO PRESUMIDO / REAL ----------
  let lp: LpInfo | null = null
  if (regime === "Lucro Presumido" || regime === "Lucro Real") {
    const equip = !!cd.equipHospitalar && atividade === "Serviços"
    const pIrpj = equip ? 0.08 : PRES_IRPJ[atividade] ?? 0.32
    const pCsll = equip ? 0.12 : PRES_CSLL[atividade] ?? 0.32
    const baseIrpj = revenue * pIrpj
    const baseCsll = revenue * pCsll
    const irpj = baseIrpj * 0.15
    const adic = Math.max(0, baseIrpj - 20000) * 0.1
    const csll = baseCsll * 0.09
    const issRate = parseBR(cd.issRate || (atividade === "Serviços" ? "5,00" : "0"))
    lp = { equip, pIrpj, pCsll, baseIrpj, baseCsll, irpj, adic, csll, issRate }

    const pushLP = (tax: string, base: number, rate: number, valor: number, obs: string, group: string, dueTax?: string) => {
      taxes.push({
        tax, base: fmtNum(base), rate: rate.toFixed(2).replace(".", ","),
        apurado: fmtNum(valor), retido: "", value: fmtNum(valor),
        dueDate: dueDate(cd.compMonth, cd.compYear, dueTax || tax), obs, group,
      })
    }
    pushLP("PIS", revenue, 0.65, revenue * 0.0065, "Regime cumulativo (0,65%)", "PIS/COFINS")
    pushLP("COFINS", revenue, 3.0, revenue * 0.03, "Regime cumulativo (3%)", "PIS/COFINS")
    if (atividade === "Serviços" && issRate > 0)
      pushLP("ISS", revenue, issRate, (revenue * issRate) / 100, "Imposto municipal sobre serviços", "ISS", "ISS")
    pushLP("IRPJ", baseIrpj, 15.0, irpj, `Presunção ${(pIrpj * 100).toFixed(0)}%${equip ? " (equiparação hospitalar)" : ""} • venc. trimestral`, "IRPJ/CSLL", "IRPJ")
    if (adic > 0) pushLP("Adicional IRPJ", Math.max(0, baseIrpj - 20000), 10.0, adic, "Sobre base que excede R$ 20.000/mês", "IRPJ/CSLL", "IRPJ")
    pushLP("CSLL", baseCsll, 9.0, csll, `Presunção ${(pCsll * 100).toFixed(0)}%${equip ? " (equiparação hospitalar)" : ""} • venc. trimestral`, "IRPJ/CSLL", "CSLL")

    const baseFolha = folhaMensal + proLabore
    if (baseFolha > 0) {
      pushLP("CPP (Patronal)", baseFolha, 20.0, baseFolha * 0.2, "Contribuição previdenciária patronal", "Folha", "CPP (Patronal)")
      const ratRate = parseBR(cd.ratRate || "1,00")
      pushLP("RAT", baseFolha, ratRate, (baseFolha * ratRate) / 100, "Risco Ambiental do Trabalho", "Folha", "RAT")
      const terRate = parseBR(cd.terceirosRate || "5,80")
      pushLP("Terceiros", baseFolha, terRate, (baseFolha * terRate) / 100, "Sistema S (SESC, SENAC, SEBRAE...)", "Folha", "Terceiros")
    }
    if (folhaMensal > 0) pushLP("FGTS", folhaMensal, 8.0, folhaMensal * 0.08, "Fundo de Garantia (8% sobre a folha)", "Folha", "FGTS")
    if (proLabore > 0) pushLP("INSS (Pró-labore)", proLabore, 11.0, proLabore * 0.11, "Retenção do segurado sobre pró-labore", "Folha", "INSS (Pró-labore)")
  }

  // ---------- RETENÇÕES NA FONTE ----------
  taxes.forEach((t) => {
    const r = parseBR(ret[t.tax])
    if (r > 0) {
      t.retido = fmtNum(r)
      t.value = fmtNum(Math.max(0, parseBR(t.apurado) - r))
    }
  })

  // ---------- TRIBUTOS ADICIONAIS (manuais) ----------
  ;(cd.extraTaxes || []).forEach((e) => {
    if (!e.tax) return
    const apur = parseBR(e.value)
    taxes.push({
      tax: e.tax, base: e.base ? fmtNum(e.base) : "", rate: e.rate || "",
      apurado: fmtNum(apur), retido: e.retido ? fmtNum(e.retido) : "",
      value: fmtNum(Math.max(0, apur - parseBR(e.retido))),
      dueDate: e.dueDate || "", obs: e.obs || "", group: e.group || "Outros", manual: true,
    })
  })

  // ---------- TOTAIS ----------
  const totApurado = taxes.reduce((s, t) => s + parseBR(t.apurado), 0)
  const totRetido = taxes.reduce((s, t) => s + parseBR(t.retido), 0)
  const totPagar = taxes.reduce((s, t) => s + parseBR(t.value), 0)
  const aliqEfetiva = revenue > 0 ? (totApurado / revenue) * 100 : 0

  // ---------- ECONOMIAS ----------
  const economias: Economia[] = []
  if (sn && (sn.anexoBase === "Anexo III" || sn.anexoBase === "Anexo V") && sn.rbt12 > 0 && revenue > 0) {
    const rIII = calcSN(sn.rbt12, "Anexo III").rate
    const rV = calcSN(sn.rbt12, "Anexo V").rate
    const dasIII = (revenue * rIII) / 100
    const dasV = (revenue * rV) / 100
    const atingiu = sn.fatorR >= 28
    economias.push({
      tipo: "fatorr", titulo: "Fator R", icon: "Scale", positivo: atingiu,
      de: dasV, para: dasIII, valor: dasV - dasIII, atingiu, fatorR: sn.fatorR, deLabel: "Anexo V", paraLabel: "Anexo III",
      detalhe: atingiu
        ? `Com Fator R de ${sn.fatorR.toFixed(2).replace(".", ",")}% (≥ 28%), sua empresa é tributada no Anexo III, com alíquota menor.`
        : `Fator R de ${sn.fatorR.toFixed(2).replace(".", ",")}% (< 28%): empresa no Anexo V. Aumentar folha/pró-labore pode reduzir o imposto.`,
    })
  }
  if (lp && lp.equip && revenue > 0) {
    const base32 = revenue * 0.32
    const irpj32 = base32 * 0.15 + Math.max(0, base32 - 20000) * 0.1
    const csll32 = base32 * 0.09
    const irpjEq = lp.baseIrpj * 0.15 + lp.adic
    const csllEq = lp.csll
    const economia = irpj32 + csll32 - (irpjEq + csllEq)
    economias.push({
      tipo: "hospitalar", titulo: "Equiparação Hospitalar", icon: "Stethoscope", positivo: economia > 0,
      de: irpj32 + csll32, para: irpjEq + csllEq, valor: economia, deLabel: "Presunção 32%", paraLabel: "Presunção 8% / 12%",
      detalhe: "IRPJ e CSLL calculados com presunção reduzida (8% e 12%) por se tratar de serviço hospitalar/equiparado, em vez dos 32% padrão de serviços.",
    })
  }
  if (totRetido > 0) {
    economias.push({
      tipo: "retencao", titulo: "Retenções na Fonte", icon: "ShieldCheck", positivo: true,
      de: null, para: null, valor: totRetido, antecipacao: true,
      detalhe: "Parte dos tributos já foi retida e antecipada pelo tomador do serviço, reduzindo o valor a desembolsar neste mês.",
    })
  }
  const economiaTributaria = economias.filter((e) => e.tipo !== "retencao" && e.valor > 0).reduce((s, e) => s + e.valor, 0)
  const economiaCaixa = economias.filter((e) => e.tipo === "retencao").reduce((s, e) => s + e.valor, 0)

  return { regime, atividade, revenue, taxes, sn, lp, ret, totApurado, totRetido, totPagar, aliqEfetiva, economias, economiaTributaria, economiaCaixa }
}

/* ===== Simulação Lucro Presumido (p/ a comparação de regime do relatório) ===== */
export interface SimLP {
  pis: number
  cofins: number
  irpj: number
  csll: number
  issIcms: number
  issIcmsLabel: string
  total: number
}
/** Estimativa simplificada do que a empresa pagaria no Lucro Presumido sobre a mesma receita.
 *  ICMS (comércio) não é estimado com precisão (varia por estado/ST) → 0. */
export function simularLucroPresumido(revenue: number, atividade: string, issRate = 5): SimLP {
  const serv = atividade !== "Comércio"
  const pis = revenue * 0.0065
  const cofins = revenue * 0.03
  const baseIrpj = revenue * (serv ? 0.32 : 0.08)
  const irpj = baseIrpj * 0.15 + Math.max(0, baseIrpj - 20000) * 0.1
  const csll = revenue * (serv ? 0.32 : 0.12) * 0.09
  const issIcms = serv ? revenue * (issRate / 100) : 0
  const total = pis + cofins + irpj + csll + issIcms
  return { pis, cofins, irpj, csll, issIcms, issIcmsLabel: serv ? "ISS" : "ICMS", total }
}
