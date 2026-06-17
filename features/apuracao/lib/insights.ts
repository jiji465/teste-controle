// Motor de análise inteligente — portado de Relatorio Fiscal Mensal.html.
// Gera alertas / oportunidades / conferências a partir da apuração + histórico.
import { calcSN, fmtBRL, fmtPct, parseBR, SN_TAB } from "./engine"
import type { Apuracao, ClientData, HistPoint, Insight, InsightLevel } from "./types"

export function gerarInsights(cd: ClientData, ap: Apuracao, history: HistPoint[]): Insight[] {
  const out: Insight[] = []
  const push = (nivel: InsightLevel, icon: string, titulo: string, texto: string, valor?: number | null, cliente?: boolean) =>
    out.push({ nivel, icon, titulo, texto, valor: valor || null, cliente: !!cliente })
  const hist = (history || []).slice().sort((a, b) => a.key.localeCompare(b.key))
  const curKey = cd.compYear && cd.compMonth ? cd.compYear + "-" + String(cd.compMonth).padStart(2, "0") : null

  // ---- SIMPLES: Fator R ----
  if (ap.sn && (ap.sn.anexoBase === "Anexo III" || ap.sn.anexoBase === "Anexo V") && ap.sn.rbt12 > 0) {
    const rbt12 = ap.sn.rbt12
    const folha = ap.sn.folha12
    const fr = ap.sn.fatorR
    const rIII = calcSN(rbt12, "Anexo III").rate
    const rV = calcSN(rbt12, "Anexo V").rate
    const ecoMes = (ap.revenue * (rV - rIII)) / 100
    if (folha > 0) {
      if (fr >= 28) {
        const folga = folha - 0.28 * rbt12
        if (fr < 30)
          push("alerta", "Scale", "Fator R no limite", `O Fator R está em ${fr.toFixed(2).replace(".", ",")}%, pouco acima dos 28%. Uma queda de ${fmtBRL(folga)} na folha/pró-labore (12 meses) levaria a empresa ao Anexo V, aumentando o imposto em cerca de ${fmtBRL(ecoMes)}/mês. Recomenda-se manter a folha estável.`, null, true)
        else
          push("ok", "CheckCircle2", "Fator R confortável", `Fator R em ${fr.toFixed(2).replace(".", ",")}%, com folga de ${fmtBRL(folga)} antes de cair para o Anexo V. Enquadramento no Anexo III seguro.`)
      } else {
        const falta = 0.28 * rbt12 - folha
        push("oportunidade", "TrendingUp", "Oportunidade no Fator R", `Faltam ${fmtBRL(falta)} de folha/pró-labore (12 meses) — cerca de ${fmtBRL(falta / 12)}/mês — para atingir 28% e migrar do Anexo V para o III. Isso reduziria o imposto em aproximadamente ${fmtBRL(ecoMes)}/mês.`, ecoMes * 12, true)
      }
    }
  }

  // ---- SIMPLES: mudança de faixa próxima ----
  if (ap.sn && ap.sn.rbt12 > 0 && SN_TAB[ap.sn.anexoEf]) {
    const tab = SN_TAB[ap.sn.anexoEf]
    const fi = tab.findIndex((f) => ap.sn!.rbt12 <= f[0])
    if (fi >= 0 && fi < tab.length - 1) {
      const falta = tab[fi][0] - ap.sn.rbt12
      if (falta <= tab[fi][0] * 0.08)
        push("info", "BarChart3", "Mudança de faixa próxima", `O RBT12 (${fmtBRL(ap.sn.rbt12)}) está a ${fmtBRL(falta)} de subir de faixa no ${ap.sn.anexoEf}, quando a alíquota nominal passa para ${tab[fi + 1][1].toFixed(2).replace(".", ",")}%. A carga tende a aumentar.`)
    }
  }

  // ---- SIMPLES: sublimite / teto ----
  if (ap.sn && ap.sn.rbt12 > 0) {
    if (ap.sn.rbt12 > 4320000)
      push("alerta", "AlertTriangle", "Risco de exclusão do Simples", `RBT12 em ${fmtBRL(ap.sn.rbt12)}, próximo do teto de R$ 4.800.000. Ultrapassá-lo exclui a empresa do Simples Nacional no ano seguinte.`, null, true)
    else if (ap.sn.rbt12 > 3600000)
      push("alerta", "AlertTriangle", "Sublimite de ICMS/ISS", `RBT12 em ${fmtBRL(ap.sn.rbt12)}, acima de R$ 3.600.000: ICMS e ISS passam a ser recolhidos por fora do DAS.`, null, true)
  }

  // ---- TENDÊNCIA (histórico) ----
  if (hist.length >= 2 && ap.revenue > 0) {
    const prev = hist.filter((h) => h.key !== curKey)
    if (prev.length >= 2) {
      const media = prev.reduce((s, h) => s + (h.faturamento || 0), 0) / prev.length
      if (media > 0) {
        const dif = ((ap.revenue - media) / media) * 100
        if (dif >= 30) push("info", "TrendingUp", "Faturamento acima da média", `O faturamento de ${fmtBRL(ap.revenue)} está ${dif.toFixed(0)}% acima da média dos meses anteriores (${fmtBRL(media)}).`)
        else if (dif <= -30) push("info", "TrendingDown", "Queda no faturamento", `O faturamento caiu ${Math.abs(dif).toFixed(0)}% frente à média recente (${fmtBRL(media)}).`)
      }
      const last3 = [...prev.slice(-2), { aliquota: ap.aliqEfetiva } as HistPoint]
      if (last3.length === 3 && last3[0].aliquota < last3[1].aliquota && last3[1].aliquota < last3[2].aliquota)
        push("info", "TrendingUp", "Carga tributária subindo", `A alíquota efetiva vem crescendo nos últimos meses (atual ${fmtPct(ap.aliqEfetiva)}), reflexo do avanço de faixa no Simples.`)
    }
  }

  // ---- LP: equiparação hospitalar sugerida ----
  if (
    ap.lp && cd.atividade === "Serviços" && !cd.equipHospitalar && ap.revenue > 0 &&
    /cl[ií]nic|hospital|m[eé]dic|sa[uú]de|odonto|laborat|fisio|terapeut|radiolog|diagn[oó]st|enfermagem|imagem|ultrassom/i.test(cd.clientName || "")
  ) {
    const b32 = ap.revenue * 0.32
    const eco =
      b32 * 0.15 + Math.max(0, b32 - 20000) * 0.1 + b32 * 0.09 -
      (ap.revenue * 0.08 * 0.15 + Math.max(0, ap.revenue * 0.08 - 20000) * 0.1 + ap.revenue * 0.12 * 0.09)
    if (eco > 0)
      push("oportunidade", "Stethoscope", "Possível equiparação hospitalar", `A atividade aparenta ser da área da saúde. Cumprindo os requisitos (sociedade empresária + normas da Anvisa), a presunção cai de 32% para 8%/12%, economizando cerca de ${fmtBRL(eco)}/mês. Ative a opção "Equiparação hospitalar".`, eco * 12, true)
  }

  // ---- CONFERÊNCIAS / DADOS ----
  if (cd.dasOfficial && ap.sn) {
    const ok = Math.abs(ap.sn.das - parseBR(cd.dasOfficial)) <= 0.05
    if (ok) push("ok", "CheckCircle2", "DAS conferido com o PGDAS-D", `O DAS calculado (${fmtBRL(ap.sn.das)}) confere com o extrato oficial.`)
    else push("alerta", "AlertTriangle", "DAS diverge do extrato", `O sistema calculou ${fmtBRL(ap.sn.das)}, mas o extrato indica ${fmtBRL(cd.dasOfficial)}. Revise faturamento, RBT12 e anexo.`)
  }
  if (ap.sn && (cd.anexo === "Anexo III" || cd.anexo === "Anexo V") && parseBR(cd.folha12m) <= 0)
    push("info", "Info", "Informe a folha de 12 meses", "Sem a folha + pró-labore dos últimos 12 meses, o Fator R não consegue definir entre Anexo III e V.")
  if (ap.sn && parseBR(cd.proLabore) <= 0 && ap.revenue > 0)
    push("info", "Info", "Pró-labore não informado", "Não há pró-labore no mês, então não foi gerada a guia de INSS (11%). Confirme se houve retirada dos sócios.")

  const ordem: Record<InsightLevel, number> = { oportunidade: 0, alerta: 1, info: 2, ok: 3 }
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel])
}
