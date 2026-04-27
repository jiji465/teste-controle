import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export type ExportColumn<T> = {
  header: string
  /** Largura aproximada em "letras" (Excel) — opcional */
  width?: number
  /** Função que extrai o valor da linha. Pode retornar string, number ou Date. */
  accessor: (row: T) => string | number | Date | null | undefined
}

/**
 * Exporta uma lista de objetos para .xlsx usando SheetJS.
 * Faz download direto no browser.
 */
export function exportToXlsx<T>(opts: {
  filename: string
  sheetName?: string
  columns: ExportColumn<T>[]
  rows: T[]
}): void {
  const { filename, sheetName = "Dados", columns, rows } = opts
  const headerRow = columns.map((c) => c.header)
  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const v = col.accessor(row)
      if (v === null || v === undefined) return ""
      if (v instanceof Date) return v
      return v
    }),
  )
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  // Larguras de coluna (Excel)
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? Math.max(c.header.length + 2, 12) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, ensureExt(filename, "xlsx"))
}

/**
 * Exporta MÚLTIPLAS abas para um único arquivo .xlsx.
 * Útil pra relatórios consolidados (Resumo + Por Cliente + Por Imposto…).
 */
export function exportMultiSheetXlsx(opts: {
  filename: string
  sheets: Array<{
    name: string
    columns: ExportColumn<any>[]
    rows: any[]
  }>
}): void {
  const { filename, sheets } = opts
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const headerRow = sheet.columns.map((c) => c.header)
    const dataRows = sheet.rows.map((row) =>
      sheet.columns.map((col) => {
        const v = col.accessor(row)
        if (v === null || v === undefined) return ""
        if (v instanceof Date) return v
        return v
      }),
    )
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    ws["!cols"] = sheet.columns.map((c) => ({
      wch: c.width ?? Math.max(c.header.length + 2, 12),
    }))
    // Limita nome a 31 chars (limite do Excel)
    const safeName = sheet.name.length > 31 ? sheet.name.slice(0, 31) : sheet.name
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }
  XLSX.writeFile(wb, ensureExt(filename, "xlsx"))
}

/**
 * Exporta uma lista para PDF tabelar usando jsPDF + autoTable.
 * Inclui título, subtitle (filtros) e contagem.
 */
export function exportToPdf<T>(opts: {
  filename: string
  title: string
  subtitle?: string
  columns: ExportColumn<T>[]
  rows: T[]
}): void {
  const { filename, title, subtitle, columns, rows } = opts
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

  const tableStartY = subtitle ? 86 : 72

  autoTable(doc, {
    startY: tableStartY,
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
    didDrawPage: (data) => {
      // Footer com paginação
      const str = `Página ${doc.getNumberOfPages()}`
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(str, pageWidth - 60, doc.internal.pageSize.getHeight() - 20)
    },
  })

  doc.save(ensureExt(filename, "pdf"))
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
  const { filename, columns, rows } = opts
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = columns.map((c) => escape(c.header)).join(";")
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const v = col.accessor(row)
        if (v === null || v === undefined) return '""'
        if (v instanceof Date) return escape(v.toLocaleDateString("pt-BR"))
        return escape(String(v))
      })
      .join(";"),
  )
  const csv = "\uFEFF" + [header, ...dataRows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = ensureExt(filename, "csv")
  link.click()
  URL.revokeObjectURL(url)
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
