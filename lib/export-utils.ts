import type { Workbook } from "exceljs"
import type { jsPDF } from "jspdf"

export type ExportColumn<T> = {
  header: string
  /** Largura aproximada em "letras" (Excel) — opcional */
  width?: number
  /** Função que extrai o valor da linha. Pode retornar string, number ou Date. */
  accessor: (row: T) => string | number | Date | null | undefined
}

/** Formato de data das células do Excel (pt-BR). */
export const EXCEL_DATE_FORMAT = "dd/mm/yyyy"

/**
 * Converte um Date (instante) numa data de CALENDÁRIO pro Excel.
 *
 * O Excel não tem fuso: o ExcelJS grava o serial a partir dos componentes
 * UTC do Date. Uma conclusão às 22:30 de 13/10 no Brasil é 01:30Z de 14/10
 * e aparecia como 14/10 na planilha. Aqui pegamos o dia LOCAL e montamos
 * meia-noite UTC desse dia (sem horário).
 */
export function toExcelDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/** "YYYY-MM-DD" (dia de calendário) → data do Excel. "" / inválido → null. */
export function isoDayToExcelDate(iso: string | null | undefined): Date | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

/** Dispara o download de um Blob no navegador. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Monta a planilha (sem baixar) — separado pra ser testável. */
export async function buildXlsxWorkbook<T>(opts: {
  sheetName?: string
  columns: ExportColumn<T>[]
  rows: T[]
}): Promise<Workbook> {
  const { sheetName = "Dados", columns, rows } = opts
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  // Limita nome a 31 chars (limite do Excel) e remove caracteres proibidos
  const ws = wb.addWorksheet(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Dados")
  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? Math.max(c.header.length + 2, 12),
  }))
  const dateCols = new Set<number>()
  for (const row of rows) {
    ws.addRow(
      columns.map((col, i) => {
        const v = col.accessor(row)
        if (v === null || v === undefined) return ""
        if (v instanceof Date) {
          if (Number.isNaN(v.getTime())) return ""
          dateCols.add(i)
          return toExcelDate(v)
        }
        return v
      }),
    )
  }
  const header = ws.getRow(1)
  header.font = { bold: true }
  ws.views = [{ state: "frozen", ySplit: 1 }]
  // Datas no formato brasileiro (dd/mm/yyyy, sem horário)
  for (const i of dateCols) ws.getColumn(i + 1).numFmt = EXCEL_DATE_FORMAT
  return wb
}

/**
 * Exporta uma lista de objetos para .xlsx (ExcelJS — a mesma lib dos
 * relatórios; a antiga `xlsx` do npm tinha vulnerabilidades sem correção).
 * ExcelJS é carregado sob demanda: não pesa no carregamento das páginas.
 */
export async function exportToXlsx<T>(opts: {
  filename: string
  sheetName?: string
  columns: ExportColumn<T>[]
  rows: T[]
}): Promise<void> {
  const wb = await buildXlsxWorkbook(opts)
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    ensureExt(opts.filename, "xlsx"),
  )
}

/** Monta o PDF tabular (sem salvar) — separado pra ser testável. */
export async function buildTablePdf<T>(opts: {
  title: string
  subtitle?: string
  columns: ExportColumn<T>[]
  rows: T[]
}): Promise<jsPDF> {
  const { title, subtitle, columns, rows } = opts
  // jsPDF carregado sob demanda (só quem exporta paga o custo)
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Cabeçalho
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(title, 40, 40)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const generatedAt = new Date().toLocaleString("pt-BR")
  doc.setTextColor(120)
  doc.text(`Gerado em ${generatedAt} · ${rows.length} registro${rows.length === 1 ? "" : "s"}`, 40, 56)
  if (subtitle) {
    doc.text(subtitle, 40, 70)
  }
  doc.setTextColor(0)

  autoTable(doc, {
    startY: subtitle ? 86 : 72,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((col) => {
        const v = col.accessor(row)
        if (v === null || v === undefined) return ""
        if (v instanceof Date) return v.toLocaleDateString("pt-BR")
        return String(v)
      }),
    ),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  })

  // Paginação desenhada UMA vez por página, no fim (didDrawPage roda a cada
  // tabela/página e duplicava o texto).
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Página ${p} de ${total}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" })
  }
  return doc
}

/**
 * Exporta uma lista para PDF tabelar usando jsPDF + autoTable.
 * Inclui título, subtitle (filtros) e contagem.
 */
export async function exportToPdf<T>(opts: {
  filename: string
  title: string
  subtitle?: string
  columns: ExportColumn<T>[]
  rows: T[]
}): Promise<void> {
  const doc = await buildTablePdf(opts)
  doc.save(ensureExt(opts.filename, "pdf"))
}

/**
 * Neutraliza "CSV/formula injection": um texto que começa com = + - @ TAB ou
 * CR é interpretado como fórmula pelo Excel/LibreOffice ao abrir o .csv.
 * Prefixa com apóstrofo (o Excel mostra o texto literal). Só vale pra textos
 * — números (inclusive negativos) são escritos como estão.
 */
export function csvSafeText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

/** Monta o conteúdo do CSV (com BOM) — separado pra ser testável. */
export function buildCsv<T>(opts: { columns: ExportColumn<T>[]; rows: T[] }): string {
  const { columns, rows } = opts
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = columns.map((c) => escape(csvSafeText(c.header))).join(";")
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const v = col.accessor(row)
        if (v === null || v === undefined) return '""'
        if (v instanceof Date) return escape(v.toLocaleDateString("pt-BR"))
        if (typeof v === "number") return escape(String(v))
        return escape(csvSafeText(String(v)))
      })
      .join(";"),
  )
  return "﻿" + [header, ...dataRows].join("\n")
}

/**
 * Exporta para CSV simples (compatível com Excel BR — usa ; como separador,
 * que é o padrão pt-BR. Adiciona BOM para UTF-8 ser reconhecido.)
 */
export function exportToCsv<T>(opts: {
  filename: string
  columns: ExportColumn<T>[]
  rows: T[]
}): void {
  const csv = buildCsv(opts)
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), ensureExt(opts.filename, "csv"))
}

function ensureExt(name: string, ext: string): string {
  if (name.toLowerCase().endsWith(`.${ext}`)) return name
  return `${name}.${ext}`
}

export function timestampFilename(prefix: string): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${prefix}_${yyyy}-${mm}-${dd}`
}
