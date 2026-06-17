// Leitor do extrato/declaração do PGDAS-D — portado de Relatorio Fiscal Mensal.html.
// Recebe o texto extraído do PDF e devolve os campos + a repartição exata dos tributos.
import { parseBR } from "./engine"

export interface PgdasResult {
  fields: {
    cnpj?: string
    clientName?: string
    compMonth?: string
    compYear?: string
    revenue?: string
    rbt12?: string
    folha12m?: string
    anexo?: string
    fatorRDecl?: string
    dasOfficial?: string
    atividade?: string
  }
  repart: Record<string, string>
}

export function parsePGDAS(raw: string): PgdasResult | null {
  if (!raw || raw.trim().length < 20) return null
  const text = raw.replace(/ /g, " ")
  const f: PgdasResult["fields"] = {}
  const repart: Record<string, string> = {}
  const money = (re: RegExp): string | undefined => {
    const m = text.match(re)
    return m ? m[1] : undefined
  }

  const cnpj = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
  if (cnpj) f.cnpj = cnpj[1]

  let m = text.match(/Nome\s+empresarial[:\s]*([^\n]+)/i)
  if (m) f.clientName = m[1].split(/\s{2,}|Data\s+de\s+abertura|Optante/i)[0].replace(/\s+/g, " ").trim()

  m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*\d{2}\/\d{2}\/\d{4}/)
  if (m) {
    f.compMonth = String(parseInt(m[2], 10))
    f.compYear = m[3]
  }

  f.revenue = money(/RPA\)[\s\S]{0,60}?([\d.]+,\d{2})/i) || money(/Receita\s+Bruta\s+do\s+PA[\s\S]{0,60}?([\d.]+,\d{2})/i)
  f.rbt12 = money(/\(RBT12\)\s*([\d.]+,\d{2})/i) || money(/doze\s+meses\s+anteriores\s*([\d.]+,\d{2})/i)
  f.folha12m = money(/Total\s+de\s+Folhas?[\s\S]{0,80}?([\d.]+,\d{2})/i)

  m = text.match(/Anexo\s+(IV|V|III|II|I)\b/i)
  if (m) f.anexo = "Anexo " + m[1].toUpperCase()
  m = text.match(/Fator\s*r[\s=]*([\d,]+)/i)
  if (m) f.fatorRDecl = m[1]

  // Repartição: 9 números após o cabeçalho "IRPJ CSLL COFINS ... ISS Total"
  const idx = text.search(/IRPJ\s+CSLL\s+COFINS/i)
  if (idx >= 0) {
    const nums = text.slice(idx).match(/\d[\d.]*,\d{2}/g)
    if (nums && nums.length >= 9) {
      const [irpj, csll, cofins, pis, inss, icms, , iss, total] = nums
      repart.IRPJ = irpj
      repart.CSLL = csll
      repart.COFINS = cofins
      repart["PIS/PASEP"] = pis
      repart.CPP = inss
      repart.ICMS = icms
      repart.ISS = iss
      f.dasOfficial = total
      f.atividade = parseBR(iss) > 0 ? "Serviços" : parseBR(icms) > 0 ? "Comércio" : "Serviços"
      if (!f.anexo) f.anexo = parseBR(iss) > 0 ? "Anexo III" : "Anexo I"
    }
  }
  if (!f.revenue) return null
  return { fields: f, repart }
}
