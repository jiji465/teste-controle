
export type ExportColumn<T> = {
  header: string
  /** Largura aproximada em "letras" (Excel) — opcional */
  width?: number
  /** Função que extrai o valor da linha. Pode retornar string, number ou Date. */
  accessor: (row: T) => string | number | Date | null | undefined
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
  const { filename, sheetName = "Dados", columns, rows } = opts
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  // Limita nome a 31 chars (limite do Excel) e remove caracteres proibidos
  const ws = wb.addWorksheet(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Dados")
  ws.columns = columns.map((c) => ({
    header: c.header,
    width: c.width ?? Math.max(c.header.length + 2, 12),
  }))
  for (const row of rows) {
    ws.addRow(
      columns.map((col) => {
        const v = col.accessor(row)
        return v === null || v === undefined ? "" : v
      }),
    )
  }
  const header = ws.getRow(1)
  header.font = { bold: true }
  ws.views = [{ state: "frozen", ySplit: 1 }]
  columns.forEach((col, i) => {
    // Datas no formato brasileiro
    if (rows.some((r) => col.accessor(r) instanceof Date)) ws.getColumn(i + 1).numFmt = "dd/mm/yyyy"
  })
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    ensureExt(filename, "xlsx"),
  )
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
  const { filename, title, subtitle, columns, rows } = opts
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
    didDrawPage: () => {
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
