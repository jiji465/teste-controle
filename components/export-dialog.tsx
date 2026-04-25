"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Download, FileSpreadsheet, FileText, File } from "lucide-react"
import type { ObligationWithDetails, Client } from "@/lib/types"
import { TAX_REGIME_LABELS } from "@/lib/types"
import { exportToXlsx, exportToPdf, exportToCsv, timestampFilename, type ExportColumn } from "@/lib/export-utils"
import { toast } from "sonner"

type ExportFmt = "xlsx" | "csv" | "pdf"

type ExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  obligations: ObligationWithDetails[]
  clients: Client[]
}

export function ExportDialog({ open, onOpenChange, obligations, clients }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFmt>("xlsx")
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [selectedClient, setSelectedClient] = useState<string>("all")

  const filteredData = useMemo(() => {
    let data = obligations
    if (selectedClient !== "all") data = data.filter((o) => o.clientId === selectedClient)
    if (!includeCompleted) data = data.filter((o) => o.status !== "completed")
    if (dateStart && dateEnd) {
      const s = new Date(dateStart)
      const e = new Date(dateEnd)
      data = data.filter((o) => {
        const due = new Date(o.calculatedDueDate)
        return due >= s && due <= e
      })
    }
    return data
  }, [obligations, selectedClient, includeCompleted, dateStart, dateEnd])

  const columns: ExportColumn<ObligationWithDetails>[] = [
    { header: "Obrigação", width: 32, accessor: (o) => o.name },
    { header: "Cliente", width: 30, accessor: (o) => o.client.name },
    { header: "CNPJ", width: 18, accessor: (o) => o.client.cnpj || "" },
    { header: "Regime", width: 18, accessor: (o) => (o.client.taxRegime ? TAX_REGIME_LABELS[o.client.taxRegime] : "") },
    { header: "Vencimento", width: 12, accessor: (o) => new Date(o.calculatedDueDate) },
    { header: "Status", width: 12, accessor: (o) => statusLabel(o.status) },
    { header: "Prioridade", width: 10, accessor: (o) => priorityLabel(o.priority) },
    { header: "Responsável", width: 16, accessor: (o) => o.assignedTo || "" },
    { header: "Concluída em", width: 14, accessor: (o) => (o.completedAt ? new Date(o.completedAt) : "") },
  ]

  const handleExport = () => {
    if (filteredData.length === 0) {
      toast.error("Nenhuma obrigação encontrada com esses filtros")
      return
    }

    const filename = timestampFilename("obrigacoes")
    const subtitleParts: string[] = []
    if (selectedClient !== "all") {
      const c = clients.find((x) => x.id === selectedClient)
      if (c) subtitleParts.push(`Cliente: ${c.name}`)
    }
    if (dateStart && dateEnd) subtitleParts.push(`Período: ${formatBR(dateStart)} → ${formatBR(dateEnd)}`)
    if (!includeCompleted) subtitleParts.push("Sem concluídas")
    const subtitle = subtitleParts.length > 0 ? subtitleParts.join("  ·  ") : undefined

    try {
      if (format === "xlsx") {
        exportToXlsx({ filename, sheetName: "Obrigações", columns, rows: filteredData })
      } else if (format === "csv") {
        exportToCsv({ filename, columns, rows: filteredData })
      } else {
        exportToPdf({
          filename,
          title: "Relatório de Obrigações",
          subtitle,
          columns,
          rows: filteredData,
        })
      }
      toast.success(`${filteredData.length} registros exportados`)
      onOpenChange(false)
    } catch (err) {
      console.error("[export]", err)
      toast.error("Falha ao gerar arquivo. Tente outro formato.")
    }
  }

  const fmtIcon = format === "xlsx"
    ? <FileSpreadsheet className="size-4" />
    : format === "pdf"
      ? <FileText className="size-4" />
      : <File className="size-4" />

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Exportar Obrigações
          </DialogTitle>
          <DialogDescription>Configure os filtros e o formato do arquivo</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="format">Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFmt)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">
                  <div className="flex items-center gap-2"><FileSpreadsheet className="size-4" /> Excel (.xlsx)</div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2"><FileText className="size-4" /> PDF (.pdf)</div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2"><File className="size-4" /> CSV (.csv)</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="client">Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger id="client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dateStart">De</Label>
              <Input id="dateStart" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateEnd">Até</Label>
              <Input id="dateEnd" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label htmlFor="includeCompleted">Incluir concluídas</Label>
              <p className="text-xs text-muted-foreground">Exportar também obrigações já entregues</p>
            </div>
            <Switch id="includeCompleted" checked={includeCompleted} onCheckedChange={setIncludeCompleted} />
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>{filteredData.length}</strong> obrigaç{filteredData.length === 1 ? "ão será exportada" : "ões serão exportadas"} com os filtros atuais
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} className="gap-2" disabled={filteredData.length === 0}>
            {fmtIcon}
            Exportar {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending": return "Pendente"
    case "in_progress": return "Em andamento"
    case "completed": return "Concluída"
    case "overdue": return "Atrasada"
    default: return s
  }
}

function priorityLabel(p: string): string {
  switch (p) {
    case "urgent": return "Urgente"
    case "high": return "Alta"
    case "medium": return "Média"
    case "low": return "Baixa"
    default: return p
  }
}

function formatBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  return `${d}/${m}/${y}`
}
