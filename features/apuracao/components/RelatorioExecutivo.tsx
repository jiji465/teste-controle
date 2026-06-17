"use client"

// Relatório Executivo (design v1) — portado de "Relatório Mensal SETE v1.html".
// 2 páginas A4, card-based, alimentado pelos dados reais da apuração.
// CSS escopado em .rep-doc + isolamento de impressão (visibility trick).
import { ESCRITORIO } from "@/lib/report-config"
import { fmtBRL, fmtPct, parseBR, simularLucroPresumido } from "../lib/engine"
import { GLOSSARY } from "../lib/glossario"
import type { Apuracao, ClientData, HistPoint, Insight } from "../lib/types"

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const fmtK = (v: number) => Math.round(v || 0).toLocaleString("pt-BR")

function guiaTag(tax: string) {
  if (tax === "DAS") return "DAS"
  if (tax === "FGTS") return "FGTS"
  if (/INSS/.test(tax)) return "GPS"
  if (/ISS/.test(tax)) return "ISS"
  if (/ICMS/.test(tax)) return "ICMS"
  return "DARF"
}

export interface RelatorioProps {
  cd: ClientData
  ap: Apuracao
  evolution: HistPoint[]
  insights: Insight[]
}

export function RelatorioExecutivo({ cd, ap, evolution, insights }: RelatorioProps) {
  const office = cd.officeName || ESCRITORIO.nome
  const officeEmail = cd.officeEmail || ""
  const officePhone = cd.officePhone || ""
  const officeCRC = cd.officeCRC || ""
  const officeAddr = cd.officeAddress || ""
  const monthName = cd.compMonth ? MONTHS[parseInt(cd.compMonth) - 1] : ""
  const compPretty = monthName ? `${monthName} / ${cd.compYear}` : cd.competenceShort || "—"
  const today = new Date().toLocaleDateString("pt-BR")
  const isSN = !!ap.sn
  const anexoFaixa = isSN ? `${ap.sn!.anexoEf} · ${ap.sn!.faixa}ª faixa` : ap.atividade

  const curKey = cd.compYear && cd.compMonth ? cd.compYear + "-" + String(cd.compMonth).padStart(2, "0") : ""
  const evo = (evolution || []).slice().sort((a, b) => a.key.localeCompare(b.key))
  const idxCur = evo.findIndex((e) => e.key === curKey)
  const fatTrend = idxCur > 0 && evo[idxCur - 1].faturamento > 0 ? ((ap.revenue - evo[idxCur - 1].faturamento) / evo[idxCur - 1].faturamento) * 100 : null
  const hasEvo = evo.length >= 2
  const evoMax = hasEvo ? Math.max(...evo.map((e) => e.faturamento || 0), 1) : 1
  const mediaFat = hasEvo ? evo.reduce((s, e) => s + (e.faturamento || 0), 0) / evo.length : 0
  const growth = hasEvo && evo[0].faturamento > 0 ? ((evo[evo.length - 1].faturamento - evo[0].faturamento) / evo[0].faturamento) * 100 : 0

  // comparação de regime (Simples × Presumido) — só p/ Simples
  const sim = isSN ? simularLucroPresumido(ap.revenue, ap.atividade, parseBR(cd.issRate) || 5) : null
  const regimeEconomia = sim ? sim.total - ap.sn!.das : 0
  const economiaMes = isSN && regimeEconomia > 0 ? regimeEconomia : ap.economiaTributaria + ap.economiaCaixa
  const economiaAno = evo.filter((e) => e.key.startsWith(String(cd.compYear))).reduce((s, e) => s + (e.economia || 0), 0)

  // faturamento por tipo (opcional) ou repartição do DAS
  const recProd = parseBR(cd.recProdutos), recServ = parseBR(cd.recServicos), recOut = parseBR(cd.recOutras)
  const hasRecBreak = recProd + recServ + recOut > 0
  const fatRows: { label: string; value: number }[] = hasRecBreak
    ? [
        { label: "Venda de produtos", value: recProd },
        { label: "Prestação de serviços", value: recServ },
        { label: "Outras receitas", value: recOut },
      ].filter((r) => r.value > 0)
    : isSN && ap.sn!.repart.length
      ? ap.sn!.repart.map((r) => ({ label: r.tax, value: r.value }))
      : Object.entries(
          ap.taxes.reduce<Record<string, number>>((m, t) => {
            const v = parseBR(t.value)
            if (v > 0) m[t.group] = (m[t.group] || 0) + v
            return m
          }, {}),
        ).map(([label, value]) => ({ label, value }))
  const fatRowsTitle = hasRecBreak ? "Faturamento" : isSN ? "Dentro do seu DAS" : "Composição dos tributos"
  const fatRowsTotalLabel = hasRecBreak ? "Faturamento bruto" : isSN ? "Total do DAS" : "Total a recolher"
  const fatRowsTotal = hasRecBreak ? ap.revenue : isSN ? ap.sn!.das : ap.totPagar

  // resultado / margem (opcional) ou carga efetiva
  const despesas = parseBR(cd.despesas)
  const hasResultado = despesas > 0 || hasRecBreak
  const resultado = ap.revenue - despesas - ap.totPagar
  const margem = ap.revenue > 0 ? (resultado / ap.revenue) * 100 : 0

  // tributos por guia (tabela página 1) — agrupado simples
  const taxRows = ap.taxes.filter((t) => parseBR(t.value) > 0)

  // vencimentos
  const withDue = ap.taxes.filter((t) => t.dueDate && parseBR(t.value) > 0)
  const groups: Record<string, typeof withDue> = {}
  withDue.forEach((t) => {
    ;(groups[t.dueDate] = groups[t.dueDate] || []).push(t)
  })
  const dayInfo = (s: string) => {
    const p = s.split("/")
    const d = new Date(+p[2], +p[1] - 1, +p[0])
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return { day: p[0], mo: MONTHS_SHORT[+p[1] - 1], diff: Math.ceil((d.getTime() - t.getTime()) / 86400000) }
  }
  const dueGroups = Object.entries(groups)
    .map(([date, items]) => ({ date, ...dayInfo(date), items, total: items.reduce((s, t) => s + parseBR(t.value), 0) }))
    .sort((a, b) => {
      const pa = a.date.split("/"), pb = b.date.split("/")
      return new Date(+pa[2], +pa[1] - 1, +pa[0]).getTime() - new Date(+pb[2], +pb[1] - 1, +pb[0]).getTime()
    })

  // glossário
  const glossItems = GLOSSARY.filter((g) => g.match.some((mt) => ap.taxes.map((t) => t.tax).includes(mt)))

  // observações = insights relevantes + observação manual
  const obsItems: { ic: string; gold?: boolean; titulo: string; texto: string }[] = []
  insights
    .filter((i) => i.cliente)
    .slice(0, 3)
    .forEach((i) => obsItems.push({ ic: i.nivel === "oportunidade" ? "↗" : i.nivel === "alerta" ? "!" : "✓", gold: i.nivel === "oportunidade", titulo: i.titulo, texto: i.texto }))
  if (cd.observations) obsItems.push({ ic: "✎", gold: true, titulo: "Observações", texto: cd.observations })
  if (obsItems.length === 0) obsItems.push({ ic: "✓", titulo: "Apuração concluída", texto: "Competência apurada e conferida. Em caso de dúvida sobre qualquer guia, estamos à disposição." })

  const css = STYLE

  return (
    <div className="rep-doc" id="rep-overlay">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ============ PÁGINA 1 ============ */}
      <div className="sheet">
        <div className="card hd">
          <div className="lock">
            <img src="/brand/icone.png" alt="SETE" />
            <div>
              <div className="nm">SETE</div>
              <div className="sb">Soluções Empresariais</div>
            </div>
          </div>
          <div className="dt">
            <div className="k">Relatório Mensal</div>
            <h1>Resumo Fiscal</h1>
            <div className="c">Competência {compPretty} · Emitido em {today}</div>
          </div>
        </div>

        <div className="card client">
          <div className="it"><div className="lbl">Cliente</div><div className="v">{cd.clientName || "—"}</div></div>
          <div className="it"><div className="lbl">CNPJ</div><div className="v num" style={{ fontWeight: 500 }}>{cd.cnpj || "—"}</div></div>
          <div className="it"><div className="lbl">Regime</div><div className="v" style={{ fontWeight: 500 }}>{ap.regime}</div></div>
          <div className="it"><div className="lbl">{isSN ? "Anexo / Faixa" : "Atividade"}</div><div className="v" style={{ fontWeight: 500 }}>{anexoFaixa}</div></div>
        </div>

        <div className="kpis">
          <div className="kc navy">
            <div className="kl">Faturamento</div>
            <div className="kv"><span className="cur">R$ </span>{fmtK(ap.revenue)}</div>
            <div className="kf">{fatTrend != null ? <><span className="up">{fatTrend >= 0 ? "▲" : "▼"} {Math.abs(fatTrend).toFixed(1).replace(".", ",")}%</span> vs. mês ant.</> : "bruto do mês"}</div>
          </div>
          <div className="kc w">
            <div className="kl">Impostos</div>
            <div className="kv"><span className="cur">R$ </span>{fmtK(ap.totPagar)}</div>
            <div className="kf">{(ap.revenue > 0 ? (ap.totPagar / ap.revenue) * 100 : 0).toFixed(2).replace(".", ",")}% s/ faturamento</div>
          </div>
          <div className="kc gold">
            <div className="kl">Economia</div>
            <div className="kv"><span className="cur">R$ </span>{fmtK(economiaMes)}</div>
            <div className="kf">{isSN ? <><span className="up">▲</span> vs. L. Presumido</> : "planejamento aplicado"}</div>
          </div>
          {hasResultado ? (
            <div className="kc w">
              <div className="kl">Resultado</div>
              <div className="kv"><span className="cur">R$ </span>{fmtK(resultado)}</div>
              <div className="kf">Margem líquida {margem.toFixed(1).replace(".", ",")}%</div>
            </div>
          ) : (
            <div className="kc w">
              <div className="kl">Carga efetiva</div>
              <div className="kv">{fmtPct(ap.aliqEfetiva)}</div>
              <div className="kf">{isSN ? `DAS a ${ap.sn!.rate.toFixed(2).replace(".", ",")}%` : "sobre faturamento"}</div>
            </div>
          )}
        </div>

        <div className="row2">
          <div className="card">
            <div className="ttl">{fatRowsTitle}</div>
            <table>
              <tbody>
                {fatRows.map((r, i) => (
                  <tr key={i}><td>{r.label}</td><td className="r">{fmtBRL(r.value)}</td></tr>
                ))}
                <tr className="tot"><td>{fatRowsTotalLabel}</td><td className="r">{fmtBRL(fatRowsTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="ttl">Impostos apurados</div>
            <table>
              <tbody>
                {taxRows.map((t, i) => (
                  <tr key={i}>
                    <td>{t.tax} <span className="tag">{guiaTag(t.tax)}</span></td>
                    <td className="r">{fmtBRL(t.value)}</td>
                  </tr>
                ))}
                <tr className="tot"><td>Total a recolher</td><td className="r">{fmtBRL(ap.totPagar)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="ttl">Evolução — últimos {evo.length || 0} {evo.length === 1 ? "mês" : "meses"}<span className="rt">faturamento × impostos</span></div>
          {hasEvo ? (
            <>
              <div className="chart">
                {evo.map((e, i) => (
                  <div className="mo" key={i}>
                    <div className="gb">
                      <div className="b f" style={{ height: `${((e.faturamento / evoMax) * 100).toFixed(1)}%` }} />
                      <div className="b i" style={{ height: `${((e.tributos / evoMax) * 100).toFixed(1)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="xax">
                {evo.map((e, i) => (
                  <div className={"x" + (e.key === curKey ? " cur" : "")} key={i}>{MONTHS_SHORT[parseInt(e.key.slice(5)) - 1]}</div>
                ))}
              </div>
              <div className="leg">
                <span><i style={{ background: "var(--navy)" }} /> Faturamento</span>
                <span><i style={{ background: "var(--gold)" }} /> Impostos</span>
                <span className="mm">Média R$ {fmtK(mediaFat)} · {growth >= 0 ? "+" : ""}{growth.toFixed(1).replace(".", ",")}% no período</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10.5, color: "var(--muted)", padding: "6px 0" }}>Salve esta competência e as próximas para o gráfico de evolução aparecer aqui.</div>
          )}
        </div>

        {dueGroups.length > 0 && (
          <div className="card">
            <div className="ttl">Vencimentos<span className="rt">{withDue.length} guia{withDue.length > 1 ? "s" : ""}</span></div>
            <div className="venc">
              {dueGroups.map((g, i) => (
                <div className={"vi" + (g.diff >= 0 && g.diff <= 5 ? " soon" : "")} key={i}>
                  <div className="vd"><div className="d">{g.day}</div><div className="m">{g.mo}</div></div>
                  <div className="vb">
                    <div className="t">{g.items.map((t) => t.tax).join(" + ")}</div>
                    <div className="s">{g.items.map((t) => guiaTag(t.tax)).filter((v, j, a) => a.indexOf(v) === j).join(" · ")}</div>
                  </div>
                  <div className="va">
                    <div className="a">{fmtBRL(g.total)}</div>
                    <div className={"st" + (g.diff < 0 || g.diff <= 5 ? "" : " ok")}>{g.diff < 0 ? "vencido" : g.diff === 0 ? "hoje" : g.diff <= 5 ? `${g.diff} dias` : "a vencer"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="foot">
          <div><b>{office}</b>{officeEmail ? ` · ${officeEmail}` : ""}{officePhone ? ` · ${officePhone}` : ""}</div>
          <div>{officeCRC ? `${officeCRC} · ` : ""}Página 1 de 2</div>
        </div>
      </div>

      {/* ============ PÁGINA 2 ============ */}
      <div className="sheet">
        <div className="card hd">
          <div className="lock">
            <img src="/brand/icone.png" alt="SETE" />
            <div>
              <div className="nm">SETE</div>
              <div className="sb">Soluções Empresariais</div>
            </div>
          </div>
          <div className="dt">
            <div className="k">Relatório Mensal</div>
            <h1>Economia &amp; Glossário</h1>
            <div className="c">{cd.clientName || "Empresa"} · {compPretty}</div>
          </div>
        </div>

        {isSN && sim && (
          <div className="card">
            <div className="ttl">Economia tributária — de onde vem<span className="rt">Simples Nacional × Lucro Presumido</span></div>
            <div className="ecHead">
              <div className="ecHero">
                <div className="el">Economia no mês</div>
                <div className="ev"><span className="cur">R$ </span>{fmtK(Math.max(0, regimeEconomia))}</div>
                <div className="ey">{economiaAno > 0 ? <>e <b>{fmtBRL(economiaAno)} no acumulado do ano</b> mantendo a empresa no regime mais vantajoso.</> : <>mantendo a empresa no regime mais vantajoso.</>}</div>
              </div>
              <div className="ecComp">
                <div className="bcomp cur">
                  <div className="bl"><b>Regime atual · Simples Nacional</b><span className="vv">{fmtBRL(ap.sn!.das)}</span></div>
                  <div className="track"><i style={{ width: `${Math.min(100, (ap.sn!.das / Math.max(ap.sn!.das, sim.total)) * 100).toFixed(1)}%` }} /></div>
                  <small>Tributo único (DAS) sobre a receita do mês</small>
                </div>
                <div className="bcomp sim">
                  <div className="bl"><b>Simulação · Lucro Presumido</b><span className="vv">{fmtBRL(sim.total)}</span></div>
                  <div className="track"><i style={{ width: `${Math.min(100, (sim.total / Math.max(ap.sn!.das, sim.total)) * 100).toFixed(1)}%` }} /></div>
                  <small>Soma de IRPJ, CSLL, PIS, COFINS e {sim.issIcmsLabel} na mesma operação</small>
                </div>
              </div>
            </div>
            <div className="ecDetail">
              <b>Como calculamos.</b> Reprojetamos o faturamento de {monthName.toLowerCase()} ({fmtBRL(ap.revenue)}) nas regras do Lucro Presumido. A diferença entre os dois regimes é a economia que o enquadramento atual gera para a sua empresa, todo mês. <span style={{ color: "var(--faint)" }}>Estimativa simplificada (ICMS de comércio não projetado).</span>
              <div className="pills">
                <span className="pill">IRPJ {fmtBRL(sim.irpj)}</span>
                <span className="pill">CSLL {fmtBRL(sim.csll)}</span>
                <span className="pill">PIS {fmtBRL(sim.pis)}</span>
                <span className="pill">COFINS {fmtBRL(sim.cofins)}</span>
                {sim.issIcms > 0 && <span className="pill">{sim.issIcmsLabel} {fmtBRL(sim.issIcms)}</span>}
              </div>
            </div>
          </div>
        )}

        {!isSN && ap.economias.filter((e) => e.valor > 0).length > 0 && (
          <div className="card">
            <div className="ttl">Economia tributária gerada<span className="rt">planejamento do escritório</span></div>
            <div className="ecHead">
              <div className="ecHero">
                <div className="el">Economia no mês</div>
                <div className="ev"><span className="cur">R$ </span>{fmtK(ap.economiaTributaria + ap.economiaCaixa)}</div>
                <div className="ey">{economiaAno > 0 ? <>e <b>{fmtBRL(economiaAno)} no acumulado do ano</b>.</> : null}</div>
              </div>
              <div className="ecComp">
                {ap.economias.filter((e) => e.de !== null && e.valor > 0).map((e, i) => (
                  <div className="bcomp sim" key={i}>
                    <div className="bl"><b>{e.titulo}</b><span className="vv">{fmtBRL(e.valor)}</span></div>
                    <div className="track"><i style={{ width: "100%" }} /></div>
                    <small>{e.deLabel} → {e.paraLabel}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="ecDetail"><b>Como calculamos.</b> Comparamos o cenário aplicado com o cenário sem o planejamento (presunção cheia / anexo desfavorável). A diferença é a economia gerada.</div>
          </div>
        )}

        {glossItems.length > 0 && (
          <div className="card">
            <div className="ttl">Glossário — entenda seu relatório<span className="rt">principais termos e siglas</span></div>
            <div className="gloss">
              {glossItems.map((g, i) => (
                <div className="gi" key={i}>
                  <div className="gt"><span className="ab">{g.sigla}</span>{g.nome}</div>
                  <div className="gd">{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="ttl">Observações &amp; recomendações</div>
          <div className="obs">
            {obsItems.map((o, i) => (
              <div className="ob" key={i}>
                <div className={"ic" + (o.gold ? " g" : "")}>{o.ic}</div>
                <div>
                  <div className="ot">{o.titulo}</div>
                  <div className="od">{o.texto}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="foot">
          <div><b>{office}</b>{officeEmail ? ` · ${officeEmail}` : ""}{officePhone ? ` · ${officePhone}` : ""}{officeAddr ? ` · ${officeAddr}` : ""}</div>
          <div>{officeCRC ? `${officeCRC} · ` : ""}Página 2 de 2</div>
        </div>
      </div>
    </div>
  )
}

/* ===== CSS do relatório (escopado em .rep-doc) ===== */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Spectral:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&display=swap');
.rep-doc{
  --paper:#eef0f3;--navy:#001D3D;--navy-2:#0a3160;--gold:#F79C04;--gold-2:#d4830a;--gold-deep:#b06f06;--tan:#D4A657;
  --gold-soft:#fcefd7;--navy-soft:#e7ecf3;--ink:#1a2230;--muted:#646d7c;--faint:#9aa2af;--line:#e9e6dd;--alert:#b5402b;--alert-soft:#f7e7e2;--pos:#1f7a4d;
  font-family:"Archivo",sans-serif;color:var(--ink);background:#dfe2e7;padding:24px 12px;-webkit-font-smoothing:antialiased;
}
.rep-doc *{box-sizing:border-box;margin:0;padding:0;}
.rep-doc .sheet{width:210mm;min-height:297mm;margin:0 auto 24px;background:var(--paper);box-shadow:0 1px 2px rgba(0,29,61,.08),0 18px 50px rgba(0,29,61,.14);padding:7mm;display:flex;flex-direction:column;gap:3.4mm;overflow:hidden;}
.rep-doc .card{background:#fff;border-radius:14px;padding:16px 19px;box-shadow:0 1px 2px rgba(0,29,61,.05),0 5px 16px rgba(0,29,61,.045);}
.rep-doc .hd{display:flex;justify-content:space-between;align-items:center;background:var(--navy);background-image:linear-gradient(110deg,rgba(0,12,28,.5),rgba(10,49,96,.3)),url('/brand/fundo.jpg');background-size:cover;background-position:center;color:#fff;}
.rep-doc .lock{display:flex;align-items:center;gap:12px;}
.rep-doc .lock img{height:46px;}
.rep-doc .lock .nm{font-family:"Spectral",serif;font-weight:700;font-size:26px;letter-spacing:4px;background:linear-gradient(178deg,#ffe9a8,#F79C04 52%,#a8690a);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:.9;}
.rep-doc .lock .sb{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:2.6px;font-size:8.5px;color:#e6c884;font-weight:600;margin-top:4px;white-space:nowrap;}
.rep-doc .dt{text-align:right;}
.rep-doc .dt .k{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:3px;font-size:9.5px;color:var(--gold);font-weight:600;white-space:nowrap;}
.rep-doc .dt h1{font-family:"Spectral",serif;font-weight:600;font-size:20px;margin-top:2px;color:#fff;}
.rep-doc .dt .c{font-size:10.5px;color:#b9c4d4;margin-top:3px;}
.rep-doc .client{display:flex;padding:12px 19px;}
.rep-doc .client .it{flex:1;}
.rep-doc .client .it + .it{border-left:1px solid var(--line);padding-left:18px;}
.rep-doc .lbl{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:1px;font-size:9px;color:var(--faint);font-weight:600;}
.rep-doc .client .v{font-size:12px;font-weight:600;margin-top:3px;}
.rep-doc .num{font-variant-numeric:tabular-nums;}
.rep-doc .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;}
.rep-doc .kc{border-radius:14px;padding:15px 16px;box-shadow:0 1px 2px rgba(0,29,61,.05),0 5px 16px rgba(0,29,61,.045);}
.rep-doc .kc.w{background:#fff;}.rep-doc .kc.navy{background:var(--navy);color:#fff;}.rep-doc .kc.gold{background:linear-gradient(160deg,#F79C04,#d4830a);color:#fff;}
.rep-doc .kc .kl{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:1px;font-size:9.5px;font-weight:600;opacity:.85;}
.rep-doc .kc.w .kl{color:var(--muted);opacity:1;}
.rep-doc .kc .kv{font-family:"Spectral",serif;font-weight:700;font-size:25px;margin-top:9px;line-height:1;}
.rep-doc .kc .kv .cur{font-size:12px;opacity:.7;}
.rep-doc .kc .kf{font-size:9.5px;margin-top:8px;opacity:.85;}.rep-doc .kc.w .kf{color:var(--muted);}
.rep-doc .up{font-weight:700;}
.rep-doc .ttl{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:1.5px;font-size:10px;color:var(--gold-2);font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:7px;}
.rep-doc .ttl::before{content:"";width:14px;height:2px;background:var(--gold);}
.rep-doc .ttl .rt{margin-left:auto;color:var(--faint);font-weight:500;letter-spacing:.5px;text-transform:none;font-family:"Archivo",sans-serif;font-size:9.5px;}
.rep-doc .row2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.rep-doc table{width:100%;border-collapse:collapse;font-size:11.5px;}
.rep-doc td{padding:6.5px 0;border-bottom:1px solid var(--line);}
.rep-doc tr:last-child td{border-bottom:none;}
.rep-doc .r{text-align:right;font-variant-numeric:tabular-nums;}
.rep-doc .tot td{font-weight:700;border-top:2px solid var(--navy);border-bottom:none;padding-top:8px;}
.rep-doc .tag{font-family:"Archivo Narrow",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;padding:2px 7px;border-radius:20px;text-transform:uppercase;background:var(--gold-soft);color:var(--gold-deep);}
.rep-doc .chart{display:flex;align-items:flex-end;gap:6px;height:104px;border-bottom:1.5px solid var(--line);padding-top:6px;}
.rep-doc .mo{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;}
.rep-doc .gb{display:flex;gap:2px;align-items:flex-end;width:100%;max-width:22px;height:100%;}
.rep-doc .gb .b{flex:1;border-radius:3px 3px 0 0;}
.rep-doc .b.f{background:var(--navy);}.rep-doc .b.i{background:var(--gold);}
.rep-doc .xax{display:flex;gap:6px;margin-top:5px;}.rep-doc .xax .x{flex:1;text-align:center;font-family:"Archivo Narrow",sans-serif;font-size:8px;color:var(--muted);font-weight:500;}.rep-doc .xax .x.cur{color:var(--gold-deep);font-weight:700;}
.rep-doc .leg{display:flex;gap:14px;margin-top:9px;font-size:10px;color:var(--muted);}
.rep-doc .leg span{display:flex;align-items:center;gap:5px;}.rep-doc .leg i{width:9px;height:9px;border-radius:2px;}
.rep-doc .leg .mm{margin-left:auto;color:var(--gold-deep);font-weight:600;}
.rep-doc .venc{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.rep-doc .vi{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;background:#f7f8fa;}
.rep-doc .vi.soon{background:var(--alert-soft);}
.rep-doc .vd{text-align:center;width:34px;flex-shrink:0;}.rep-doc .vd .d{font-family:"Spectral",serif;font-weight:700;font-size:17px;line-height:1;}.rep-doc .vd .m{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;font-size:7.5px;letter-spacing:1px;color:var(--muted);font-weight:600;}
.rep-doc .vb{flex:1;min-width:0;}.rep-doc .vb .t{font-size:11px;font-weight:600;}.rep-doc .vb .s{font-size:9px;color:var(--muted);}
.rep-doc .va{text-align:right;}.rep-doc .va .a{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;}.rep-doc .va .st{font-family:"Archivo Narrow",sans-serif;font-size:7.5px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;color:var(--alert);}.rep-doc .va .st.ok{color:var(--pos);}
.rep-doc .foot{display:flex;justify-content:space-between;align-items:center;font-size:9px;color:var(--muted);padding:2px 6px 0;margin-top:auto;}
.rep-doc .foot b{color:var(--ink);}
.rep-doc .ecHead{display:flex;align-items:stretch;gap:16px;}
.rep-doc .ecHero{flex:0 0 220px;background:linear-gradient(160deg,#fff,var(--gold-soft));border:1px solid var(--gold);border-radius:12px;padding:16px 17px;display:flex;flex-direction:column;justify-content:center;}
.rep-doc .ecHero .el{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:1.2px;font-size:9.5px;color:var(--gold-deep);font-weight:700;}
.rep-doc .ecHero .ev{font-family:"Spectral",serif;font-weight:700;font-size:38px;color:var(--gold-deep);line-height:1;margin-top:7px;}
.rep-doc .ecHero .ev .cur{font-size:16px;}
.rep-doc .ecHero .ey{font-size:10.5px;color:var(--ink);margin-top:9px;line-height:1.45;}.rep-doc .ecHero .ey b{color:var(--gold-deep);}
.rep-doc .ecComp{flex:1;display:flex;flex-direction:column;justify-content:center;gap:13px;}
.rep-doc .bcomp .bl{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;margin-bottom:5px;}
.rep-doc .bcomp .bl b{font-weight:600;}.rep-doc .bcomp .bl .vv{font-weight:700;font-variant-numeric:tabular-nums;font-size:13px;}
.rep-doc .track{height:22px;border-radius:6px;background:#f0f2f5;overflow:hidden;}
.rep-doc .track i{display:block;height:100%;border-radius:6px;}
.rep-doc .bcomp.cur i{background:var(--navy);}.rep-doc .bcomp.sim i{background:linear-gradient(90deg,var(--gold),var(--gold-2));}
.rep-doc .bcomp small{font-size:9px;color:var(--faint);}
.rep-doc .ecDetail{margin-top:13px;font-size:10.5px;color:var(--muted);line-height:1.5;border-top:1px dashed var(--line);padding-top:11px;}.rep-doc .ecDetail b{color:var(--ink);}
.rep-doc .ecDetail .pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.rep-doc .pill{font-family:"Archivo Narrow",sans-serif;font-size:9px;font-weight:600;letter-spacing:.3px;background:var(--navy-soft);color:var(--navy-2);padding:3px 9px;border-radius:20px;}
.rep-doc .gloss{display:grid;grid-template-columns:1fr 1fr;gap:10px 26px;}
.rep-doc .gi{display:flex;flex-direction:column;gap:2px;padding-bottom:9px;border-bottom:1px solid var(--line);}
.rep-doc .gi .gt{font-size:11px;font-weight:700;color:var(--navy);}
.rep-doc .gi .gt .ab{font-family:"Archivo Narrow",sans-serif;color:var(--gold-deep);font-weight:700;margin-right:5px;}
.rep-doc .gi .gd{font-size:10px;color:var(--muted);line-height:1.4;}
.rep-doc .obs{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.rep-doc .ob{display:flex;gap:10px;align-items:flex-start;}
.rep-doc .ob .ic{width:26px;height:26px;border-radius:8px;background:var(--navy-soft);color:var(--navy);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:"Spectral",serif;font-weight:700;font-size:13px;}
.rep-doc .ob .ic.g{background:var(--gold-soft);color:var(--gold-deep);}
.rep-doc .ob .ot{font-size:11px;font-weight:600;margin-bottom:2px;}
.rep-doc .ob .od{font-size:10px;color:var(--muted);line-height:1.45;}
@media print{
  @page{size:A4;margin:0;}
  body *{visibility:hidden!important;}
  #rep-overlay,#rep-overlay *{visibility:visible!important;}
  #rep-overlay{position:absolute;left:0;top:0;width:100%;background:#fff;padding:0!important;}
  .rep-doc{background:#fff!important;padding:0!important;}
  .rep-doc .sheet{box-shadow:none!important;margin:0!important;width:210mm;min-height:297mm;page-break-after:always;}
  .rep-doc .hd,.rep-doc .kc.navy,.rep-doc .kc.gold,.rep-doc .lock .nm{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
}
`
