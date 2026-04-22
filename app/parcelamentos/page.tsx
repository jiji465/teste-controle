"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Navigation } from "@/components/navigation"
import { InstallmentForm } from "@/features/installments/components/installment-form"
import { getInstallments, getClients, getTaxes, saveInstallment, deleteInstallment } from "@/lib/supabase/database"
import type { Installment, Client, Tax } from "@/lib/types"
import { Plus, Search, Pencil, Trash2, Play, CheckCircle2, AlertCircle, Flame, TrendingUp, Zap, Clock, PlayCircle, AlertTriangle } from "lucide-react"
import { formatDate, adjustForWeekend } from "@/lib/date-utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"

export default function ParcelamentosPage() {
  const { installments, clients, taxes, isLoading: loading, refreshData } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  const loadData = async () => {
    await refreshData()
  }

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || "Cliente não encontrado"
  }

  const getTaxName = (taxId?: string) => {
    if (!taxId) return "-"
    return taxes.find((t) => t.id === taxId)?.name || "-"
  }

  const calculateDueDate = (installment: Installment): Date => {
    const firstDue = new Date(installment.firstDueDate)
    const monthsToAdd = installment.currentInstallment - 1
    const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + monthsToAdd, installment.dueDay)
    return adjustForWeekend(dueDate, installment.weekendRule)
  }

  const getStatus = (installment: Installment): "pending" | "in_progress" | "completed" | "overdue" => {
    if (installment.status === "completed") return "completed"
    const dueDate = calculateDueDate(installment)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dueDate < today) return "overdue"
    return installment.status
  }

  const filteredInstallments = useMemo(() => {
    return installments.filter((installment) => {
      const matchesSearch =
        installment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getClientName(installment.clientId).toLowerCase().includes(searchTerm.toLowerCase())

      const status = getStatus(installment)
      const matchesStatus = statusFilter === "all" || status === statusFilter
      const matchesClient = clientFilter === "all" || installment.clientId === clientFilter

      return matchesSearch && matchesStatus && matchesClient
    })
  }, [installments, searchTerm, statusFilter, clientFilter, clients])

  const statusCounts = useMemo(() => {
    const counts = {
      all: installments.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    }

    installments.forEach((installment) => {
      const status = getStatus(installment)
      counts[status]++
    })

    return counts
  }, [installments])

  const handleEdit = (installment: Installment) => {
    setSelectedInstallment(installment)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este parcelamento?")) {
      try {
        await deleteInstallment(id)
        await loadData()
      } catch (error) {
        console.error("[v0] Error deleting installment:", error)
        alert("Erro ao excluir parcelamento. Tente novamente.")
      }
    }
  }

  const handleStartInstallment = async (installment: Installment) => {
    try {
      const updated = { ...installment, status: "in_progress" as const }
      await saveInstallment(updated)
      await loadData()
    } catch (error) {
      console.error("[v0] Error starting installment:", error)
    }
  }

  const handleCompleteInstallment = async (installment: Installment) => {
    try {
      const updated = {
        ...installment,
        status: "completed" as const,
        completedAt: new Date().toISOString(),
      }
      await saveInstallment(updated)
      await loadData()
    } catch (error) {
      console.error("[v0] Error completing installment:", error)
    }
  }

  const getStatusBadge = (installment: Installment) => {
    const status = getStatus(installment)
    const dueDate = calculateDueDate(installment)

    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Concluída {installment.completedAt && `em ${formatDate(installment.completedAt)}`}
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="default" className="bg-info text-info-foreground">
            <Play className="mr-1 h-3 w-3" />
            Em Andamento
          </Badge>
        )
      case "overdue":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Atrasada
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        )
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Zap className="h-4 w-4 text-destructive" />
      case "high":
        return <Flame className="h-4 w-4 text-warning" />
      case "medium":
        return <AlertCircle className="h-4 w-4 text-info" />
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-balance">Parcelamentos</h1>
              <p className="text-lg text-muted-foreground">Gerencie parcelamentos de impostos e obrigações</p>
            </div>
          <Button
            onClick={() => {
              setSelectedInstallment(undefined)
              setIsFormOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Parcelamento
          </Button>
        </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
                <span className="text-sm font-medium">Todas</span>
                <Badge variant="secondary" className="text-xs">{statusCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span className="text-sm font-medium">Pendentes</span>
                </div>
                <Badge variant="secondary" className="text-xs">{statusCounts.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <PlayCircle className="size-3.5" />
                  <span className="text-sm font-medium">Em Andamento</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{statusCounts.in_progress}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-sm font-medium">Concluídas</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">{statusCounts.completed}</Badge>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-sm font-medium">Atrasadas</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{statusCounts.overdue}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar parcelamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por cliente" />
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

          <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Imposto</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstallments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Nenhum parcelamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredInstallments.map((installment) => {
                  const status = getStatus(installment)
                  const dueDate = calculateDueDate(installment)
                  return (
                    <TableRow key={installment.id} className={status === "overdue" ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{installment.name}</TableCell>
                      <TableCell>{getClientName(installment.clientId)}</TableCell>
                      <TableCell>{getTaxName(installment.taxId)}</TableCell>
                      <TableCell>
                        {installment.currentInstallment}/{installment.installmentCount}
                      </TableCell>
                      <TableCell>
                        {installment.installmentAmount != null
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(installment.installmentAmount)
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDate(dueDate)}</TableCell>
                      <TableCell>{getPriorityIcon(installment.priority)}</TableCell>
                      <TableCell>{getStatusBadge(installment)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => handleStartInstallment(installment)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {(status === "pending" || status === "in_progress") && (
                            <Button size="sm" variant="outline" onClick={() => handleCompleteInstallment(installment)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleEdit(installment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(installment.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </main>

      <InstallmentForm
        installment={selectedInstallment}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={loadData}
      />
    </div>
  )
}
