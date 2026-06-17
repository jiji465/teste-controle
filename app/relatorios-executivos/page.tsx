"use client"

// Módulo "Relatório Executivo" — editor + visualização do PDF executivo.
// Lê as empresas do controle fiscal (useData) e guarda a apuração mensal
// (camada financeira) para alimentar a evolução. A apuração em si continua no Domínio.
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Building2, Calculator, FileText, Printer, Save, Trash2, TrendingUp, Sparkles, Upload, Scale,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useData } from "@/contexts/data-context"
import { TAX_REGIME_LABELS } from "@/lib/types"
import { ESCRITORIO } from "@/lib/report-config"
import { computeApuracao, fmtBRL, fmtCNPJ, fmtPct, maskBRL, parseBR } from "@/features/apuracao/lib/engine"
import { parsePGDAS } from "@/features/apuracao/lib/pgdas"
import { gerarInsights } from "@/features/apuracao/lib/insights"
import type { ClientData, HistPoint } from "@/features/apuracao/lib/types"
import { RelatorioExecutivo } from "@/features/apuracao/components/RelatorioExecutivo"
import { deleteApuracao, getApuracoes, saveApuracao, toHistPoints, type ApuracaoRecord } from "@/features/apuracao/services"

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real"]
const ATIVIDADES = ["Serviços", "Comércio", "Indústria"]
const ANEXOS = ["Anexo I", "Anexo III", "Anexo V"]

function mapAtividade(b?: string): string {
  if (!b) return "Serviços"
  if (b.startsWith("com")) return "Comércio"
  if (b.startsWith("ind")) return "Indústria"
  return "Serviços"
}

function blankCd(): ClientData {
  return {
    regime: "Simples Nacional", atividade: "Serviços", anexo: "Anexo III", issRate: "5,00",
    compYear: String(new Date().getFullYear()), ret: {}, extraTaxes: [],
    officeName: ESCRITORIO.nome, officeCRC: "", officeEmail: "", officePhone: "", officeAddress: "",
  }
}

/* ---- input monetário ---- */
function Money({ value, onChange, placeholder = "0,00" }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <Input inputMode="decimal" value={value || ""} onChange={(e) => onChange(maskBRL(e.target.value))} placeholder={placeholder} />
}

export default function RelatoriosExecutivosPage() {
  const { clients } = useData()
  const [clientId, setClientId] = useState<string>("")
  const [cd, setCd] = useState<ClientData>(blankCd())
  const [records, setRecords] = useState<ApuracaoRecord[]>([])
  const [pgdasText, setPgdasText] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState("editar")

  const upd = (k: keyof ClientData, v: any) =>
    setCd((p) => {
      const next = { ...p, [k]: v }
      if (["revenue", "rbt12", "anexo", "atividade", "regime"].includes(k as string)) delete next.repartManual
      return next
    })
  const updRet = (tax: string, v: string) => setCd((p) => ({ ...p, ret: { ...(p.ret || {}), [tax]: v } }))

  const isSN = cd.regime === "Simples Nacional"
  const isLP = cd.regime === "Lucro Presumido" || cd.regime === "Lucro Real"

  const ap = useMemo(() => computeApuracao(cd), [cd])
  const history: HistPoint[] = useMemo(() => {
    const map: Record<string, HistPoint> = {}
    toHistPoints(records).forEach((h) => (map[h.key] = h))
    if (cd.compMonth && cd.compYear && ap.revenue > 0) {
      const key = cd.compYear + "-" + String(cd.compMonth).padStart(2, "0")
      map[key] = { key, faturamento: ap.revenue, tributos: ap.totPagar, totPagar: ap.totPagar, aliquota: ap.aliqEfetiva, economia: ap.economiaTributaria + ap.economiaCaixa }
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-12)
  }, [records, ap, cd.compMonth, cd.compYear])
  const insights = useMemo(() => gerarInsights(cd, ap, history), [cd, ap, history])

  // ---- selecionar empresa: prefill + carregar histórico ----
  async function selectClient(id: string) {
    setClientId(id)
    const c = clients.find((x) => x.id === id)
    if (!c) return
    setCd((p) => ({
      ...p,
      clientId: id,
      clientName: c.name,
      cnpj: c.cnpj ? fmtCNPJ(c.cnpj) : "",
      regime: c.taxRegime ? TAX_REGIME_LABELS[c.taxRegime] : p.regime,
      atividade: mapAtividade(c.businessActivity),
    }))
    try {
      const recs = await getApuracoes(id)
      setRecords(recs)
    } catch {
      setRecords([])
    }
  }

  // ---- reabrir competência salva ao trocar mês ----
  useEffect(() => {
    if (!clientId || !cd.compMonth || !cd.compYear) return
    const key = cd.compYear + "-" + String(cd.compMonth).padStart(2, "0")
    const rec = records.find((r) => r.compKey === key)
    if (rec?.payload) setCd((p) => ({ ...p, ...rec.payload, clientId }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cd.compMonth, cd.compYear])

  // ---- aplicar PGDAS (texto) ----
  function applyPgdas(raw: string): boolean {
    const res = parsePGDAS(raw)
    if (!res) {
      toast.error("Não consegui identificar. Cole/anexe a Declaração ou Extrato do PGDAS-D.")
      return false
    }
    const f = res.fields
    const comp = f.compMonth && f.compYear ? String(f.compMonth).padStart(2, "0") + "/" + f.compYear : cd.competenceShort
    setCd((p) => ({
      ...p,
      regime: "Simples Nacional",
      clientName: f.clientName || p.clientName,
      cnpj: f.cnpj ? fmtCNPJ(f.cnpj) : p.cnpj,
      compMonth: f.compMonth || p.compMonth,
      compYear: f.compYear || p.compYear,
      competenceShort: comp,
      atividade: f.atividade || p.atividade || "Serviços",
      anexo: f.anexo || p.anexo || "Anexo III",
      revenue: f.revenue || p.revenue,
      rbt12: f.rbt12 || p.rbt12,
      folha12m: f.folha12m || p.folha12m,
      repartManual: res.repart,
      dasOfficial: f.dasOfficial || "",
    }))
    toast.success(`Identificado: ${f.clientName || "empresa"} • ${comp || ""} • DAS ${f.dasOfficial ? "R$ " + f.dasOfficial : ""}`)
    return true
  }

  // ---- ler PDF do PGDAS ----
  async function readPdf(file?: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const pdfjs: any = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      const buf = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: buf }).promise
      let txt = ""
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const tc = await page.getTextContent()
        tc.items.forEach((it: any) => {
          txt += it.str + (it.hasEOL ? "\n" : " ")
        })
        txt += "\n"
      }
      if (txt.replace(/\s/g, "").length < 30) toast.error("PDF sem texto selecionável (digitalizado). Cole o texto manualmente.")
      else applyPgdas(txt)
    } catch (e) {
      console.error(e)
      toast.error("Não consegui ler o PDF. Tente colar o texto.")
    }
    setBusy(false)
  }

  // ---- salvar / excluir competência ----
  async function saveComp() {
    if (!clientId) { toast.error("Selecione a empresa."); return }
    if (!cd.compMonth || !cd.compYear) { toast.error("Selecione a competência."); return }
    if (ap.revenue <= 0) { toast.error("Informe o faturamento."); return }
    const compKey = cd.compYear + "-" + String(cd.compMonth).padStart(2, "0")
    const rec: ApuracaoRecord = {
      clientId, compKey, competenceShort: String(cd.compMonth).padStart(2, "0") + "/" + cd.compYear,
      regime: ap.regime, anexo: cd.anexo, atividade: ap.atividade,
      faturamento: ap.revenue, rbt12: parseBR(cd.rbt12), folha12m: parseBR(cd.folha12m), proLabore: parseBR(cd.proLabore),
      totalTributos: ap.totPagar, totalPagar: ap.totPagar, aliquotaEfetiva: ap.aliqEfetiva, economia: ap.economiaTributaria + ap.economiaCaixa, das: ap.sn?.das || 0,
      payload: cd,
    }
    try {
      await saveApuracao(rec)
      const recs = await getApuracoes(clientId)
      setRecords(recs)
      toast.success(`Competência ${rec.competenceShort} salva.`)
    } catch {
      toast.error("Erro ao salvar.")
    }
  }
  async function delComp(compKey: string) {
    try {
      await deleteApuracao(clientId, compKey)
      setRecords(await getApuracoes(clientId))
      toast.success("Competência removida.")
    } catch {
      toast.error("Erro ao remover.")
    }
  }

  const retEligible = ap.taxes.filter((t) => !t.manual && ["IRPJ", "CSLL", "PIS", "COFINS", "ISS", "DAS"].includes(t.tax))
  const dasOk = cd.dasOfficial && ap.sn ? Math.abs(ap.sn.das - parseBR(cd.dasOfficial)) <= 0.05 : false

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <div className="flex items-center justify-between gap-3 mb-5 no-print">
        <PageHeader
          icon={TrendingUp}
          title="Relatório Executivo"
          description="Apuração mensal e relatório executivo em PDF para o cliente. A apuração detalhada continua no Domínio."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveComp}><Save className="h-4 w-4 mr-1.5" /> Salvar competência</Button>
          {tab === "visualizar" && <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Imprimir / PDF</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print mb-4">
          <TabsTrigger value="editar"><FileText className="h-4 w-4 mr-1.5" /> Editar</TabsTrigger>
          <TabsTrigger value="visualizar"><Calculator className="h-4 w-4 mr-1.5" /> Visualizar</TabsTrigger>
        </TabsList>

        {/* ===================== EDITAR ===================== */}
        <TabsContent value="editar" className="space-y-5">
          {/* Empresa + competência */}
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><Building2 className="h-5 w-5" /> Empresa & competência</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>Empresa (do controle fiscal)</Label>
                <Select value={clientId} onValueChange={selectClient}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.cnpj ? ` — ${fmtCNPJ(c.cnpj)}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mês</Label>
                <Select value={cd.compMonth || ""} onValueChange={(v) => { upd("compMonth", v); upd("competenceShort", v.padStart(2, "0") + "/" + (cd.compYear || "")) }}>
                  <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={cd.compYear || ""} onValueChange={(v) => upd("compYear", v)}>
                  <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                  <SelectContent>{[2024, 2025, 2026, 2027, 2028].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Regime</Label>
                <Select value={cd.regime} onValueChange={(v) => upd("regime", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REGIMES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Atividade</Label>
                <Select value={cd.atividade} onValueChange={(v) => upd("atividade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ATIVIDADES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {isSN && (
                <div>
                  <Label>Anexo</Label>
                  <Select value={cd.anexo || ""} onValueChange={(v) => upd("anexo", v)}>
                    <SelectTrigger><SelectValue placeholder="Anexo" /></SelectTrigger>
                    <SelectContent>{ANEXOS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Card>

          {/* Importar PGDAS-D */}
          {isSN && (
            <Card className="p-5">
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2"><Upload className="h-5 w-5" /> Importar PGDAS-D <Badge variant="secondary">identifica sozinho</Badge></h2>
              <p className="text-xs text-muted-foreground mb-3">Anexe o PDF da Declaração/Extrato do PGDAS-D ou cole o texto. O sistema preenche faturamento, RBT12, folha, anexo e a repartição exata do DAS.</p>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Button asChild variant="outline" disabled={busy}>
                  <label className="cursor-pointer"><Upload className="h-4 w-4 mr-1.5" /> {busy ? "Lendo PDF..." : "Anexar PDF"}<input type="file" accept="application/pdf" className="hidden" onChange={(e) => readPdf(e.target.files?.[0])} /></label>
                </Button>
                {dasOk && <span className="text-xs font-semibold text-emerald-600">✓ DAS calculado {fmtBRL(ap.sn!.das)} confere com o PGDAS</span>}
                {cd.dasOfficial && !dasOk && <span className="text-xs font-semibold text-amber-600">DAS difere do extrato ({fmtBRL(cd.dasOfficial)})</span>}
              </div>
              <Textarea value={pgdasText} onChange={(e) => setPgdasText(e.target.value)} placeholder="...ou cole aqui o texto do PGDAS-D" className="font-mono text-xs min-h-[80px]" />
              <Button size="sm" className="mt-2" onClick={() => { if (applyPgdas(pgdasText)) setPgdasText("") }}><Sparkles className="h-4 w-4 mr-1.5" /> Preencher</Button>
            </Card>
          )}

          {/* Dados do mês */}
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><Calculator className="h-5 w-5" /> Dados do mês</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Faturamento do mês (R$)</Label><Money value={cd.revenue} onChange={(v) => upd("revenue", v)} /></div>
              {isSN && <div><Label>RBT12 (R$)</Label><Money value={cd.rbt12} onChange={(v) => upd("rbt12", v)} /></div>}
              {isSN && (cd.anexo === "Anexo III" || cd.anexo === "Anexo V") && <div><Label>Folha + Pró-labore 12m (Fator R)</Label><Money value={cd.folha12m} onChange={(v) => upd("folha12m", v)} /></div>}
              {isLP && <div><Label>Folha de salários do mês (R$)</Label><Money value={cd.folhaMensal} onChange={(v) => upd("folhaMensal", v)} /></div>}
              {isLP && cd.atividade === "Serviços" && <div><Label>Alíquota ISS (%)</Label><Input value={cd.issRate ?? "5,00"} onChange={(e) => upd("issRate", e.target.value)} /></div>}
              <div><Label>Pró-labore do mês (R$)</Label><Money value={cd.proLabore} onChange={(v) => upd("proLabore", v)} /></div>
            </div>
            {isLP && cd.atividade === "Serviços" && (
              <label className="mt-4 flex items-center gap-3 rounded-lg border p-3 cursor-pointer bg-emerald-50/60 dark:bg-emerald-950/30">
                <Switch checked={!!cd.equipHospitalar} onCheckedChange={(v) => upd("equipHospitalar", v)} />
                <span className="text-xs"><b>Equiparação hospitalar</b> — presunção 8%/12% em vez de 32%. O relatório mostra a economia.</span>
              </label>
            )}
          </Card>

          {/* Fator R / Insights ao vivo */}
          {isSN && ap.sn && (cd.anexo === "Anexo III" || cd.anexo === "Anexo V") && ap.sn.rbt12 > 0 && (
            <Card className={"p-5 " + (ap.sn.fatorR >= 28 ? "border-emerald-300" : "border-amber-300")}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Scale className="h-4 w-4" /> Análise do Fator R</h3>
                <Badge className={ap.sn.fatorR >= 28 ? "bg-emerald-600" : "bg-amber-500"}>{ap.sn.fatorR >= 28 ? "Anexo III aplicado" : "Anexo V aplicado"}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Fator R</p><p className={"text-xl font-bold " + (ap.sn.fatorR >= 28 ? "text-emerald-600" : "text-amber-600")}>{ap.sn.fatorR.toFixed(2).replace(".", ",")}%</p></div>
                <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Alíquota efetiva</p><p className="text-xl font-bold">{ap.sn.rate.toFixed(2).replace(".", ",")}%</p></div>
                <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">DAS do mês</p><p className="text-xl font-bold">{fmtBRL(ap.sn.das)}</p></div>
              </div>
            </Card>
          )}

          {insights.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-amber-500" /> Análise inteligente</h3>
              <div className="space-y-2">
                {insights.map((it, i) => (
                  <div key={i} className={"rounded-lg border p-3 " + (it.nivel === "oportunidade" ? "bg-emerald-50 dark:bg-emerald-950/30" : it.nivel === "alerta" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/40")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold">{it.titulo}</p>
                      {it.valor ? <span className="text-xs font-extrabold text-emerald-700 whitespace-nowrap">≈ {fmtBRL(it.valor)}/ano</span> : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{it.texto}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Retenções (opcional) */}
          {retEligible.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-1">Retenções na fonte (opcional)</h3>
              <p className="text-xs text-muted-foreground mb-3">O que já foi retido pelo tomador. O sistema abate do valor a pagar.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {retEligible.map((t) => (
                  <div key={t.tax}><Label className="text-xs">{t.tax} retido</Label><Money value={(cd.ret || {})[t.tax]} onChange={(v) => updRet(t.tax, v)} /></div>
                ))}
              </div>
            </Card>
          )}

          {/* Campos opcionais do design (faturamento por tipo + despesas) */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-1">Quadros opcionais do relatório</h3>
            <p className="text-xs text-muted-foreground mb-3">Se preencher, o relatório mostra "Faturamento por tipo" e "Resultado/Margem". Se deixar em branco, usa a repartição do DAS e a carga efetiva.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label className="text-xs">Receita — produtos</Label><Money value={cd.recProdutos} onChange={(v) => upd("recProdutos", v)} /></div>
              <div><Label className="text-xs">Receita — serviços</Label><Money value={cd.recServicos} onChange={(v) => upd("recServicos", v)} /></div>
              <div><Label className="text-xs">Outras receitas</Label><Money value={cd.recOutras} onChange={(v) => upd("recOutras", v)} /></div>
              <div><Label className="text-xs">Despesas/custos do mês</Label><Money value={cd.despesas} onChange={(v) => upd("despesas", v)} /></div>
            </div>
          </Card>

          {/* Escritório + observações */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Escritório & observações</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div><Label className="text-xs">Nome do escritório</Label><Input value={cd.officeName || ""} onChange={(e) => upd("officeName", e.target.value)} /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={cd.officePhone || ""} onChange={(e) => upd("officePhone", e.target.value)} placeholder="(11) 0000-0000" /></div>
              <div><Label className="text-xs">E-mail</Label><Input value={cd.officeEmail || ""} onChange={(e) => upd("officeEmail", e.target.value)} /></div>
              <div><Label className="text-xs">CRC</Label><Input value={cd.officeCRC || ""} onChange={(e) => upd("officeCRC", e.target.value)} placeholder="CRC/SP 000000/O" /></div>
              <div className="md:col-span-2"><Label className="text-xs">Endereço</Label><Input value={cd.officeAddress || ""} onChange={(e) => upd("officeAddress", e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Observações para o cliente</Label><Textarea value={cd.observations || ""} onChange={(e) => upd("observations", e.target.value)} className="min-h-[60px]" /></div>
          </Card>

          {/* Histórico */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Save className="h-4 w-4" /> Histórico (evolução)</h3>
            {records.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma competência salva para esta empresa.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {records.slice().sort((a, b) => a.compKey.localeCompare(b.compKey)).map((r) => (
                  <span key={r.compKey} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium">
                    {r.competenceShort} · {fmtBRL(r.faturamento)}
                    <button onClick={() => delComp(r.compKey)} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ===================== VISUALIZAR ===================== */}
        <TabsContent value="visualizar">
          {ap.revenue > 0 ? (
            <div className="overflow-auto">
              <RelatorioExecutivo cd={cd} ap={ap} evolution={history} insights={insights} />
            </div>
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">Selecione a empresa, a competência e informe o faturamento (ou importe o PGDAS-D) para ver o relatório.</Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
