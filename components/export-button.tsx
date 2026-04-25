"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileText, File } from "lucide-react"
import { exportToXlsx, exportToPdf, exportToCsv, timestampFilename, type ExportColumn } from "@/lib/export-utils"
import { toast } from "sonner"

type Props<T> = {
  /** Prefixo do arquivo (ex: "impostos", "parcelamentos") */
  filenamePrefix: string
  /** Título do PDF */
  pdfTitle: string
  /** Subtítulo opcional do PDF (ex: filtros aplicados) */
  pdfSubtitle?: string
  /** Nome da aba do Excel */
  sheetName?: string
  columns: ExportColumn<T>[]
  rows: T[]
  /** Texto do botão. Padrão: "Exportar" */
  label?: string
  /** Esconde o label em telas pequenas */
  responsive?: boolean
  variant?: "default" | "outline" | "secondary" | "ghost"
}

export function ExportButton<T>({
  filenamePrefix,
  pdfTitle,
  pdfSubtitle,
  sheetName,
  columns,
  rows,
  label = "Exportar",
  responsive = true,
  variant = "outline",
}: Props<T>) {
  const handleExport = (fmt: "xlsx" | "pdf" | "csv") => {
    if (rows.length === 0) {
      toast.error("Nada para exportar com os filtros atuais")
      return
    }
    const filename = timestampFilename(filenamePrefix)
    try {
      if (fmt === "xlsx") exportToXlsx({ filename, sheetName: sheetName ?? pdfTitle, columns, rows })
      else if (fmt === "csv") exportToCsv({ filename, columns, rows })
      else exportToPdf({ filename, title: pdfTitle, subtitle: pdfSubtitle, columns, rows })
      toast.success(`${rows.length} registros exportados`)
    } catch (err) {
      console.error("[export]", err)
      toast.error("Falha ao gerar arquivo")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className="gap-2">
          <Download className="size-4" />
          <span className={responsive ? "hidden sm:inline" : undefined}>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          <FileSpreadsheet className="size-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="size-4 mr-2" /> PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <File className="size-4 mr-2" /> CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
