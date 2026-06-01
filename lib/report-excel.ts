/**
 * Gerador de Excel PROFISSIONAL para a aba Relatórios — usa ExcelJS (que,
 * diferente da lib `xlsx`, permite cores, negrito, bordas, congelar linha e
 * auto-filtro).
 *
 * Estrutura: Capa → Resumo (KPIs) → Por Cliente → Por Tipo → Pendências →
 * Concluídas. Consome o ReportData montado em reports-panel.tsx.
 *
 * ExcelJS é importado dinamicamente no chamador pra não pesar o bundle inicial.
 */
import type { Workbook, Worksheet } from "exceljs"
import { ESCRITORIO, BRAND, REPORT_TITLE } from "./report-config"
import type { ReportData, ReportTipoStats } from "./report-types"

const WHITE = "FFFFFFFF"
const HEADER_FILL = BRAND.argb
const ZEBRA = BRAND.zebraArgb
const BORDER = "FFD9DEE6"

type Col = { header: string; key: string; width: number; numeric?: boolean }

/** Aplica estilo de cabeçalho (faixa azul, texto branco, negrito, centralizado). */
function styleHeaderRow(ws: Worksheet, rowNumber: number, ncols: number) {
  const row = ws.getRow(rowNumber)
  row.height = 22
  for (let c = 1; c <= ncols; c++) {
    const cell = row.getCell(c)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 }
    cell.alignment = { vertical: "middle", horizontal: "left" }
    cell.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    }
  }
}

/** Monta uma planilha tabular padrão: título de seção + cabeçalho + linhas,
 *  com zebra, bordas, freeze e auto-filtro. */
function buildSheet(
  wb: Workbook,
  sheetName: string,
  sectionTitle: string,
  cols: Col[],
  rows: Record<string, string | number>[],
) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 3 }],
  })
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }))

  // Linha 1: título da seção
  ws.mergeCells(1, 1, 1, cols.length)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = sectionTitle
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } }
  ws.getRow(1).height = 24
  // Linha 2: vazia (respiro)
  ws.getRow(2).height = 6

  // Linha 3: cabeçalho
  const headerRowNum = 3
  const headerRow = ws.getRow(headerRowNum)
  cols.forEach((c, idx) => {
    headerRow.getCell(idx + 1).value = c.header
  })
  styleHeaderRow(ws, headerRowNum, cols.length)

  // Dados a partir da linha 4
  rows.forEach((r, i) => {
    const rowNum = headerRowNum + 1 + i
    const row = ws.getRow(rowNum)
    cols.forEach((c, idx) => {
      const cell = row.getCell(idx + 1)
      cell.value = r[c.key] ?? ""
      cell.alignment = { vertical: "middle", horizontal: c.numeric ? "center" : "left" }
      cell.border = {
        bottom: { style: "hair", color: { argb: BORDER } },
      }
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } }
      }
    })
  })

  // Auto-filtro sobre o cabeçalho + dados
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum + rows.length, column: cols.length },
  }
  // Congela título+cabeçalho
  ws.views = [{ state: "frozen", ySplit: headerRowNum }]
  return ws
}

/** Capa com identificação do escritório, título, período e totais-chave. */
function buildCover(wb: Workbook, data: ReportData) {
  const ws = wb.addWorksheet("Capa", { properties: { tabColor: { argb: HEADER_FILL } } })
  ws.columns = [{ width: 4 }, { width: 30 }, { width: 30 }, { width: 4 }]

  // Faixa de marca
  ws.mergeCells(2, 2, 2, 3)
  const brand = ws.getCell(2, 2)
  brand.value = ESCRITORIO.nome
  brand.font = { bold: true, size: 20, color: { argb: HEADER_FILL } }
  ws.getRow(2).height = 30

  if (ESCRITORIO.linha2) {
    ws.mergeCells(3, 2, 3, 3)
    const l2 = ws.getCell(3, 2)
    l2.value = ESCRITORIO.linha2
    l2.font = { size: 11, color: { argb: "FF64748B" } }
  }

  ws.mergeCells(5, 2, 5, 3)
  const title = ws.getCell(5, 2)
  title.value = REPORT_TITLE
  title.font = { bold: true, size: 16, color: { argb: "FF0F172A" } }
  ws.getRow(5).height = 24

  const meta: [string, string][] = [
    ["Período", data.periodoLabel],
    ["Gerado em", data.geradoEm],
    ["Total de itens", String(data.kpis.totalGeral)],
    ["Concluídos", String(data.kpis.concluidasGeral)],
    ["Taxa de conclusão", `${data.kpis.taxaConclusao}%`],
    ["Taxa no prazo", `${data.kpis.taxaNoPrazo}%`],
  ]
  let r = 7
  for (const [k, v] of meta) {
    const kc = ws.getCell(r, 2)
    kc.value = k
    kc.font = { bold: true, color: { argb: "FF475569" } }
    const vc = ws.getCell(r, 3)
    vc.value = v
    vc.alignment = { horizontal: "right" }
    r++
  }
}

const TIPO_COLS: Col[] = [
  { header: "Tipo", key: "tipo", width: 22 },
  { header: "Total", key: "total", width: 10, numeric: true },
  { header: "Concluídas", key: "concluidas", width: 12, numeric: true },
  { header: "Em andamento", key: "emAndamento", width: 14, numeric: true },
  { header: "Pendentes", key: "pendentes", width: 12, numeric: true },
  { header: "Atrasadas", key: "atrasadas", width: 12, numeric: true },
]

function tipoStatsRow(nome: string, s: ReportTipoStats) {
  return {
    tipo: nome,
    total: s.total,
    concluidas: s.concluidas,
    emAndamento: s.emAndamento,
    pendentes: s.pendentes,
    atrasadas: s.atrasadas,
  }
}

/** Gera e baixa o arquivo .xlsx. */
export async function exportRelatorioExcel(data: ReportData) {
  const ExcelJS = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  wb.creator = ESCRITORIO.nome
  wb.created = new Date()

  buildCover(wb, data)

  // Resumo por tipo
  buildSheet(wb, "Resumo", "Resumo por tipo de tarefa", TIPO_COLS, [
    tipoStatsRow("Obrigações", data.kpis.obrigacoes),
    tipoStatsRow("Guias de imposto", data.kpis.guias),
    tipoStatsRow("Parcelamentos", data.kpis.parcelas),
    tipoStatsRow("Serviços", data.kpis.servicos),
  ])

  // Por cliente
  buildSheet(
    wb,
    "Por Cliente",
    "Detalhamento por cliente",
    [
      { header: "Cliente", key: "cliente", width: 34 },
      { header: "Total", key: "total", width: 10, numeric: true },
      { header: "Concluídas", key: "concluidas", width: 12, numeric: true },
      { header: "Em andamento", key: "emAndamento", width: 14, numeric: true },
      { header: "Pendentes", key: "pendentes", width: 12, numeric: true },
      { header: "Atrasadas", key: "atrasadas", width: 12, numeric: true },
      { header: "Taxa %", key: "taxa", width: 10, numeric: true },
      { header: "Nota", key: "nota", width: 8, numeric: true },
    ],
    data.porCliente,
  )

  // Por tipo de imposto
  buildSheet(
    wb,
    "Por Imposto",
    "Obrigações por tipo de imposto",
    [
      { header: "Imposto", key: "nome", width: 34 },
      { header: "Total", key: "total", width: 10, numeric: true },
      { header: "Concluídas", key: "concluidas", width: 12, numeric: true },
      { header: "Atrasadas", key: "atrasadas", width: 12, numeric: true },
    ],
    data.porTipo,
  )

  // Por recorrência
  buildSheet(
    wb,
    "Por Recorrência",
    "Distribuição por recorrência",
    [
      { header: "Recorrência", key: "nome", width: 30 },
      { header: "Quantidade", key: "quantidade", width: 14, numeric: true },
    ],
    data.porRecorrencia,
  )

  // Evolução 12 meses
  buildSheet(
    wb,
    "Evolução 12 meses",
    "Evolução nos últimos 12 meses",
    [
      { header: "Mês", key: "mes", width: 12 },
      { header: "Concluídas", key: "concluidas", width: 12, numeric: true },
      { header: "Pendentes", key: "pendentes", width: 12, numeric: true },
      { header: "Atrasadas", key: "atrasadas", width: 12, numeric: true },
      { header: "Total", key: "total", width: 10, numeric: true },
      { header: "Taxa %", key: "taxa", width: 10, numeric: true },
    ],
    data.evolucao,
  )

  // Pendências
  const pendCols: Col[] = [
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Item", key: "nome", width: 34 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Vencimento", key: "vencimento", width: 14 },
    { header: "Prioridade", key: "prioridade", width: 12 },
    { header: "Competência", key: "competencia", width: 14 },
  ]
  buildSheet(wb, "Atrasadas", "Itens atrasados", pendCols, data.atrasadas)
  buildSheet(wb, "A Vencer", "Itens a vencer no período", pendCols, data.aVencer)

  // Concluídas
  buildSheet(
    wb,
    "Concluídas",
    "Itens concluídos no período",
    [
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Item", key: "nome", width: 36 },
      { header: "Cliente", key: "cliente", width: 28 },
      { header: "Concluída em", key: "concluidaEm", width: 14 },
    ],
    data.concluidas,
  )

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  link.download = `relatorio_fiscal_${stamp}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
