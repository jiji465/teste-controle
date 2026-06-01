/**
 * Gerador de PDF EXECUTIVO para a aba Relatórios — jsPDF + jspdf-autotable
 * (já instalados). Consome o mesmo ReportData do Excel, então os números
 * batem entre os dois formatos.
 *
 * Estrutura: faixa de marca no topo de toda página → resumo executivo em
 * caixas (KPIs) → seções (por cliente, por tipo, atrasadas, a vencer) →
 * rodapé "Página X de Y" + escritório.
 */
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { ESCRITORIO, BRAND, REPORT_TITLE } from "./report-config"
import type { ReportData } from "./report-types"

const MARGIN = 40
const BRAND_RGB = BRAND.rgb
const ZEBRA_RGB = BRAND.zebraRgb
const INK = 15
const MUTED = 110

export function exportRelatorioPdf(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()

  // ── Cabeçalho de marca (desenhado em cada página via didDrawPage) ──
  const drawHeader = () => {
    doc.setFillColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2])
    doc.rect(0, 0, pageW, 54, "F")
    doc.setTextColor(255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(15)
    doc.text(ESCRITORIO.nome, MARGIN, 26)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(REPORT_TITLE, MARGIN, 42)
    // direita: período + gerado em
    doc.setFontSize(8)
    doc.text(`Período: ${data.periodoLabel}`, pageW - MARGIN, 24, { align: "right" })
    doc.text(`Gerado em ${data.geradoEm}`, pageW - MARGIN, 38, { align: "right" })
    doc.setTextColor(INK)
  }

  const drawFooter = () => {
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text(ESCRITORIO.nome, MARGIN, pageH - 18)
    const page = doc.getNumberOfPages()
    doc.text(`Página ${page}`, pageW - MARGIN, pageH - 18, { align: "right" })
    doc.setTextColor(INK)
  }

  // ── Resumo executivo: 4 caixas de KPI ──
  drawHeader()
  let y = 78
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("Resumo executivo", MARGIN, y)
  y += 14

  const kpis: [string, string][] = [
    ["Total de itens", String(data.kpis.totalGeral)],
    ["Concluídos", String(data.kpis.concluidasGeral)],
    ["Taxa de conclusão", `${data.kpis.taxaConclusao}%`],
    ["Taxa no prazo", `${data.kpis.taxaNoPrazo}%`],
  ]
  const gap = 12
  const boxW = (pageW - MARGIN * 2 - gap * 3) / 4
  const boxH = 50
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + gap)
    doc.setDrawColor(220)
    doc.setFillColor(ZEBRA_RGB[0], ZEBRA_RGB[1], ZEBRA_RGB[2])
    doc.roundedRect(x, y, boxW, boxH, 4, 4, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text(label.toUpperCase(), x + 10, y + 16)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.setTextColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2])
    doc.text(value, x + 10, y + 38)
    doc.setTextColor(INK)
  })
  y += boxH + 22

  const baseTable = {
    styles: { fontSize: 8, cellPadding: 4, textColor: INK },
    headStyles: { fillColor: BRAND_RGB, textColor: 255, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: ZEBRA_RGB },
    margin: { left: MARGIN, right: MARGIN, top: 64, bottom: 32 },
    didDrawPage: () => {
      drawHeader()
      drawFooter()
    },
  }

  const sectionTitle = (title: string, startY: number) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(INK)
    doc.text(title, MARGIN, startY)
  }

  // ── Por cliente ──
  sectionTitle("Detalhamento por cliente", y)
  autoTable(doc, {
    ...baseTable,
    startY: y + 8,
    head: [["Cliente", "Total", "Concl.", "Andam.", "Pend.", "Atras.", "Taxa %", "Nota"]],
    body: data.porCliente.map((r) => [
      r.cliente, r.total, r.concluidas, r.emAndamento, r.pendentes, r.atrasadas, `${r.taxa}%`, r.nota,
    ]),
  })

  // ── Por tipo de imposto ──
  let afterY = (doc as any).lastAutoTable.finalY + 24
  sectionTitle("Obrigações por tipo de imposto", afterY)
  autoTable(doc, {
    ...baseTable,
    startY: afterY + 8,
    head: [["Imposto", "Total", "Concluídas", "Atrasadas"]],
    body: data.porTipo.map((r) => [r.nome, r.total, r.concluidas, r.atrasadas]),
  })

  // ── Atrasadas ──
  afterY = (doc as any).lastAutoTable.finalY + 24
  sectionTitle(`Itens atrasados (${data.atrasadas.length})`, afterY)
  autoTable(doc, {
    ...baseTable,
    startY: afterY + 8,
    head: [["Tipo", "Item", "Cliente", "Vencimento", "Prioridade", "Competência"]],
    body: data.atrasadas.map((r) => [r.tipo, r.nome, r.cliente, r.vencimento, r.prioridade, r.competencia]),
  })

  // ── A vencer ──
  afterY = (doc as any).lastAutoTable.finalY + 24
  sectionTitle(`Itens a vencer no período (${data.aVencer.length})`, afterY)
  autoTable(doc, {
    ...baseTable,
    startY: afterY + 8,
    head: [["Tipo", "Item", "Cliente", "Vencimento", "Prioridade", "Competência"]],
    body: data.aVencer.map((r) => [r.tipo, r.nome, r.cliente, r.vencimento, r.prioridade, r.competencia]),
  })

  // Rodapé na 1ª página (as demais já recebem via didDrawPage)
  drawFooter()

  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  doc.save(`relatorio_fiscal_${stamp}.pdf`)
}
