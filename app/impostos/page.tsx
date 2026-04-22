"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { TaxForm } from "@/features/taxes/components/tax-form"
import { GlobalSearch } from "@/components/global-search"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getTaxes, saveTax, deleteTax, getClients, getObligations } from "@/lib/supabase/database"
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Tag,
} from "lucide-react"
import type { Tax, Client, Obligation } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { useData } from "@/contexts/data-context"

export default function ImpostosPage() {
  const { taxes, clients, obligations, refreshData } = useData()
  const [editingTax, setEditingTax] = useState<Tax | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [searchOpen, setSearchOpen] = useState(false)

  const updateData = async () => {
    await refreshData()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSave = async (tax: Tax) => {
    try {
      await saveTax(tax)
      await updateData()
      setEditingTax(undefined)
      setIsFormOpen(false)
    } catch (error) {
      console.error("[v0] Error saving tax:", error)
      alert("Erro ao salvar imposto. Tente novamente.")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este imposto?")) {
      try {
        await deleteTax(id)
        await updateData()
      } catch (error) {
        console.error("[v0] Error deleting tax:", error)
        alert("Erro ao excluir imposto. Tente novamente.")
      }
    }
  }

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax)
    setIsFormOpen(true)
  }

  const handleNew = () => {
    setEditingTax(undefined)
    setIsFormOpen(true)
  }

  const handleStartTax = async (tax: Tax) => {
    try {
      const updatedTax = { ...tax, status: "in_progress" as const }
      await saveTax(updatedTax)
      await updateData()
    } catch (error) {
      console.error("[v0] Error starting tax:", error)
    }
  }

  const handleCompleteTax = async (tax: Tax) => {
    try {
      const updatedTax = {
        ...tax,
        status: "completed" as const,
        completedAt: new Date().toISOString(),
      }
      await saveTax(updatedTax)
      await updateData()
    } catch (error) {
      console.error("[v0] Error completing tax:", error)
    }
  }

  const pendingTaxes = taxes.filter((t) => t.status === "pending")
  const inProgressTaxes = taxes.filter((t) => t.status === "in_progress")
  const completedTaxes = taxes.filter((t) => t.status === "completed")
  const overdueTaxes = taxes.filter((t) => t.status === "overdue")

  const getFilteredTaxes = () => {
    switch (activeTab) {
      case "pending":
        return pendingTaxes
      case "in_progress":
        return inProgressTaxes
      case "completed":
        return completedTaxes
      case "overdue":
        return overdueTaxes
      default:
        return taxes
    }
  }

  const getStatusBadge = (status: Tax["status"], completedAt?: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="size-3 mr-1" />
            Concluída {completedAt && `em ${new Date(completedAt).toLocaleDateString("pt-BR")}`}
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <PlayCircle className="size-3 mr-1" />
            Em Andamento
          </Badge>
        )
      case "overdue":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="size-3 mr-1" />
            Atrasada
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
            <Clock className="size-3 mr-1" />
            Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-balance">Impostos</h1>
              <p className="text-lg text-muted-foreground">Gerencie todos os impostos e seus vencimentos</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
                <Search className="size-4" />
                Buscar
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <Button onClick={handleNew}>
                <Plus className="size-4 mr-2" />
                Novo Imposto
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
                <span className="text-sm font-medium">Todos</span>
                <Badge variant="secondary" className="text-xs">
                  {taxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span className="text-sm font-medium">Pendentes</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {pendingTaxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <PlayCircle className="size-3.5" />
                  <span className="text-sm font-medium">Em Andamento</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  {inProgressTaxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-sm font-medium">Concluídos</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                >
                  {completedTaxes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-sm font-medium">Atrasados</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  {overdueTaxes.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <Card className="p-6">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                    <TableHead>Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Regimes</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações Rápidas</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredTaxes().length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum imposto encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        getFilteredTaxes().map((tax) => (
                          <TableRow key={tax.id}>
                            <TableCell className="font-medium">{tax.name}</TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{tax.description || "—"}</TableCell>
                            <TableCell>
                              {tax.applicableRegimes && tax.applicableRegimes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {tax.applicableRegimes.map((r) => (
                                    <span
                                      key={r}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TAX_REGIME_COLORS[r]}`}
                                    >
                                      {TAX_REGIME_LABELS[r]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Tag className="size-3" /> Todos
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{tax.dueDay ? `Dia ${tax.dueDay}` : "—"}</TableCell>
                            <TableCell>{getStatusBadge(tax.status, tax.completedAt)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {tax.status === "pending" && (
                                  <Button size="sm" variant="outline" onClick={() => handleStartTax(tax)}>
                                    <PlayCircle className="size-3 mr-1" />
                                    Iniciar
                                  </Button>
                                )}
                                {tax.status === "in_progress" && (
                                  <Button size="sm" variant="outline" onClick={() => handleCompleteTax(tax)}>
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Concluir
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(tax)}>
                                    <Pencil className="size-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(tax.id)} className="text-destructive">
                                    <Trash2 className="size-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <TaxForm tax={editingTax} open={isFormOpen} onOpenChange={setIsFormOpen} onSave={handleSave} />
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        clients={clients}
        taxes={taxes}
        obligations={obligations}
      />
    </div>
  )
}
