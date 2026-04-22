"use client"

import { useState } from "react"
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
import type { ExportFormat, ObligationWithDetails, Client } from "@/lib/types"

type ExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  obligations: ObligationWithDetails[]
  clients: Client[]
}

export function ExportDialog({ open, onOpenChange, obligations, clients }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("excel")
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [selectedClient, setSelectedClient] = useState<string>("all")

  const handleExport = () => {
    let filteredData = obligations

    // Filter by client
    if (selectedClient !== "all") {
      filteredData = filteredData.filter((o) => o.clientId === selectedClient)
    }

    // Filter by completion status
    if (!includeCompleted) {
      filteredData = filteredData.filter((o) => o.status !== "completed")
    }

    // Filter by date range
    if (dateStart && dateEnd) {
      filteredData = filteredData.filter((o) => {
        const dueDate = new Date(o.calculatedDueDate)
        return dueDate >= new Date(dateStart) && dueDate <= new Date(dateEnd)
      })
    }

    // Generate export based on format
    if (format === "csv") {
      exportToCSV(filteredData)
    } else if (format === "excel") {
      exportToExcel(filteredData)
    } else if (format === "pdf") {
      exportToPDF(filteredData)
    }

    onOpenChange(false)
  }

  const exportToCSV = (data: ObligationWithDetails[]) => {
    const headers = ["Nome", "Cliente", "Status", "Prioridade", "Vencimento", "Responsável", "Valor"]
    const rows = data.map((o) => [
      o.name,
      o.client.name,
      o.status,
      o.priority,
      new Date(o.calculatedDueDate).toLocaleDateString("pt-BR"),
      o.assignedTo || "-",
      o.amount ? `R$ ${o.amount.toFixed(2)}` : "-",
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `obrigacoes_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const exportToExcel = (data: ObligationWithDetails[]) => {
    // Simulated Excel export (in real app, use a library like xlsx)
    const content = `
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cliente</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Vencimento</th>
            <th>Responsável</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (o) => `
            <tr>
              <td>${o.name}</td>
              <td>${o.client.name}</td>
              <td>${o.status}</td>
              <td>${o.priority}</td>
              <td>${new Date(o.calculatedDueDate).toLocaleDateString("pt-BR")}</td>
              <td>${o.assignedTo || "-"}</td>
              <td>${o.amount ? `R$ ${o.amount.toFixed(2)}` : "-"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `
    const blob = new Blob([content], { type: "application/vnd.ms-excel" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `obrigacoes_${new Date().toISOString().split("T")[0]}.xls`
    link.click()
  }

  const exportToPDF = (data: ObligationWithDetails[]) => {
    // Simulated PDF export (in real app, use a library like jsPDF)
    alert("Exportação para PDF será implementada com biblioteca jsPDF")
  }

  const getFormatIcon = (fmt: ExportFormat) => {
    switch (fmt) {
      case "excel":
        return <FileSpreadsheet className="size-4" />
      case "pdf":
        return <FileText className="size-4" />
      case "csv":
        return <File className="size-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Exportar Dados
          </DialogTitle>
          <DialogDescription>Configure as opções de exportação dos dados</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="format">Formato de Exportação</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    {getFormatIcon("excel")}
                    Excel (.xls)
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    {getFormatIcon("csv")}
                    CSV (.csv)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    {getFormatIcon("pdf")}
                    PDF (.pdf)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="client">Filtrar por Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger id="client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dateStart">Data Inicial</Label>
              <Input id="dateStart" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateEnd">Data Final</Label>
              <Input id="dateEnd" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label htmlFor="includeCompleted">Incluir Concluídas</Label>
              <p className="text-xs text-muted-foreground">Exportar obrigações já concluídas</p>
            </div>
            <Switch id="includeCompleted" checked={includeCompleted} onCheckedChange={setIncludeCompleted} />
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>{obligations.length}</strong> obrigações serão exportadas com os filtros atuais
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="size-4" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
