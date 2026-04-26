"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResizableTableHead } from "@/components/ui/resizable-table-head"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { ClientForm } from "./client-form"
import { MoreVertical, Pencil, Trash2, Search, Plus, Building2, Sparkles, Filter, CheckCircle2, XCircle } from "lucide-react"
import type { Client, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { saveClient, deleteClient, DuplicateClientError } from "@/features/clients/services"
import { TemplateApplyDialog } from "@/components/template-apply-dialog"
import { type TemplateItem, type BusinessActivity, BUSINESS_ACTIVITY_LABELS } from "@/lib/obligation-templates"
import { applyTemplateToClient, summarizeApplyResult, type CompetencyRange } from "@/lib/template-applier"
import { useData } from "@/contexts/data-context"
import { toast } from "sonner"
import { matchesText, matchesCnpj } from "@/lib/utils"

type ClientListProps = {
  clients: Client[]
  onUpdate: () => void
}

export function ClientList({ clients, onUpdate }: ClientListProps) {
  const { taxes } = useData()
  const [search, setSearch] = useState("")
  const [editingClient, setEditingClient] = useState<Client | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [templateClient, setTemplateClient] = useState<Client | null>(null)
  const [bulkTemplateClients, setBulkTemplateClients] = useState<Client[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [regimeFilter, setRegimeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [activityFilter, setActivityFilter] = useState<string>("all")
  const [stateFilter, setStateFilter] = useState<string>("all")
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const activeFilterCount =
    (regimeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (activityFilter !== "all" ? 1 : 0) +
    (stateFilter !== "all" ? 1 : 0)

  const filteredClients = useMemo(() => {
    const q = search.trim()
    return clients.filter((client) => {
      if (!q) {
        // sem termo de busca, só aplica filtros
      } else {
        const textHit =
          matchesText(client.name, q) ||
          matchesText(client.tradeName, q) ||
          matchesText(client.email, q) ||
          matchesText(client.phone, q) ||
          matchesText(client.ie, q) ||
          matchesText(client.im, q) ||
          matchesText(client.notes, q) ||
          matchesText(client.cnaeCode, q) ||
          matchesText(client.cnaeDescription, q) ||
          matchesText(client.city, q) ||
          matchesText(client.state, q) ||
          (client.taxRegime ? matchesText(TAX_REGIME_LABELS[client.taxRegime], q) : false) ||
          (client.businessActivity
            ? matchesText(
                BUSINESS_ACTIVITY_LABELS[client.businessActivity as BusinessActivity],
                q,
              )
            : false)
        const cnpjHit = matchesCnpj(client.cnpj, q)
        if (!textHit && !cnpjHit) return false
      }
      if (regimeFilter !== "all" && client.taxRegime !== regimeFilter) return false
      if (statusFilter !== "all" && client.status !== statusFilter) return false
      if (activityFilter !== "all" && client.businessActivity !== activityFilter) return false
      if (stateFilter !== "all" && client.state !== stateFilter) return false
      return true
    })
  }, [clients, search, regimeFilter, statusFilter, activityFilter, stateFilter])

  // UFs disponíveis (apenas as que têm clientes cadastrados)
  const availableStates = useMemo(() => {
    const set = new Set<string>()
    clients.forEach((c) => {
      if (c.state) set.add(c.state.toUpperCase())
    })
    return [...set].sort()
  }, [clients])

  const handleSave = async (client: Client) => {
    try {
      await saveClient(client)
      toast.success("Empresa salva com sucesso")
      onUpdate()
      setEditingClient(undefined)
    } catch (error) {
      if (error instanceof DuplicateClientError) {
        toast.error(error.message)
      } else {
        toast.error("Erro ao salvar empresa. Tente novamente.")
        console.error("[clients] save error:", error)
      }
      throw error
    }
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir empresa",
      description: "Tem certeza que deseja excluir esta empresa? Todas as obrigações e parcelamentos vinculados também serão removidos.",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteClient(id)
          toast.success("Empresa excluída")
          onUpdate()
        } catch (error) {
          toast.error("Erro ao excluir empresa")
          console.error("[clients] delete error:", error)
        }
      },
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmState({
      title: `Excluir ${selectedIds.size} empresas`,
      description: "Atenção: as obrigações e parcelamentos associados também serão removidos. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir tudo",
      destructive: true,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await Promise.all(Array.from(selectedIds).map((id) => deleteClient(id)))
          toast.success(`${selectedIds.size} empresas excluídas`)
          clearSelection()
          onUpdate()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkSetStatus = (newStatus: "active" | "inactive") => {
    if (selectedIds.size === 0) return
    const verb = newStatus === "active" ? "ativar" : "desativar"
    const verbPast = newStatus === "active" ? "ativadas" : "desativadas"
    setConfirmState({
      title: `${newStatus === "active" ? "Ativar" : "Desativar"} ${selectedIds.size} empresas`,
      description: `Confirmar para ${verb} ${selectedIds.size} empresas?`,
      confirmLabel: newStatus === "active" ? "Ativar" : "Desativar",
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          const targets = clients.filter((c) => selectedIds.has(c.id) && c.status !== newStatus)
          await Promise.all(targets.map((c) => saveClient({ ...c, status: newStatus })))
          toast.success(`${targets.length} empresas ${verbPast}`)
          clearSelection()
          onUpdate()
        } catch (error) {
          toast.error(`Erro ao ${verb} empresas`)
          console.error(error)
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleOpenForm = (client?: Client) => {
    setEditingClient(client)
    setIsFormOpen(true)
  }

  const handleApplyTemplate = async (templatesSelected: TemplateItem[], range: CompetencyRange) => {
    if (!templateClient) return
    const result = await applyTemplateToClient(templateClient, templatesSelected, range)
    const summary = summarizeApplyResult(result)
    if (summary) toast.success(summary)
    else toast.info("Nenhum item novo: tudo já estava cadastrado")
    if (result.totalSkipped > 0) {
      toast.info(`${result.totalSkipped} já existia${result.totalSkipped > 1 ? "m" : ""} e foi ignorad${result.totalSkipped > 1 ? "as" : "a"}`)
    }
    setTemplateClient(null)
    onUpdate()
  }

  const openBulkApplyTemplate = () => {
    if (selectedIds.size === 0) return
    const targets = clients.filter((c) => selectedIds.has(c.id))
    setBulkTemplateClients(targets)
  }

  const handleBulkApplyTemplate = async (
    templatesSelected: TemplateItem[],
    range: CompetencyRange,
  ) => {
    if (!bulkTemplateClients || bulkTemplateClients.length === 0) return
    setBulkLoading(true)
    try {
      let totalCreated = 0
      let totalSkipped = 0
      for (const c of bulkTemplateClients) {
        const result = await applyTemplateToClient(c, templatesSelected, range)
        totalCreated += result.taxesCreated + result.obligationsCreated
        totalSkipped += result.totalSkipped
      }
      toast.success(
        `Template aplicado em ${bulkTemplateClients.length} empresa${bulkTemplateClients.length > 1 ? "s" : ""}: ${totalCreated} criado${totalCreated !== 1 ? "s" : ""}` +
          (totalSkipped > 0 ? ` · ${totalSkipped} já existia${totalSkipped > 1 ? "m" : ""}` : ""),
      )
      setBulkTemplateClients(null)
      clearSelection()
      onUpdate()
    } finally {
      setBulkLoading(false)
    }
  }

  // Group stats
  const activeCount = clients.filter((c) => c.status === "active").length
  const regimeCounts = clients.reduce(
    (acc, c) => {
      if (c.taxRegime) acc[c.taxRegime] = (acc[c.taxRegime] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-4">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      {/* Toolbar: search + stats + action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground">
            <Building2 className="size-3.5" />
            {clients.length} empresa{clients.length !== 1 ? "s" : ""} · {activeCount} ativa{activeCount !== 1 ? "s" : ""}
          </span>
          {(Object.entries(regimeCounts) as [keyof typeof TAX_REGIME_LABELS, number][]).map(([regime, count]) => (
            <span
              key={regime}
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${TAX_REGIME_COLORS[regime as keyof typeof TAX_REGIME_COLORS]}`}
            >
              {TAX_REGIME_LABELS[regime as keyof typeof TAX_REGIME_LABELS]}: {count}
            </span>
          ))}
        </div>
        <Button onClick={() => handleOpenForm()} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Nova Empresa
        </Button>
      </div>

      {/* Search bar + Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Nome, fantasia, CNPJ, e-mail, IE/IM, atividade, CNAE…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="size-4 mr-2" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 size-5 rounded-full p-0 flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="grid sm:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Regime tributário</label>
            <Select value={regimeFilter} onValueChange={setRegimeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os regimes</SelectItem>
                {(Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ativos e inativos</SelectItem>
                <SelectItem value="active">Apenas ativos</SelectItem>
                <SelectItem value="inactive">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Atividade</label>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(Object.entries(BUSINESS_ACTIVITY_LABELS) as [BusinessActivity, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Estado (UF)</label>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableStates.length === 0 && (
                  <SelectItem value="__none__" disabled>(nenhum estado cadastrado)</SelectItem>
                )}
                {availableStates.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        actions={[
          { label: "Aplicar Template", icon: <Sparkles className="size-3.5" />, tone: "success", onClick: openBulkApplyTemplate, disabled: bulkLoading },
          { label: "Ativar", icon: <CheckCircle2 className="size-3.5" />, onClick: () => handleBulkSetStatus("active"), disabled: bulkLoading },
          { label: "Desativar", icon: <XCircle className="size-3.5" />, onClick: () => handleBulkSetStatus("inactive"), disabled: bulkLoading },
          { label: "Excluir", icon: <Trash2 className="size-3.5" />, tone: "destructive", onClick: handleBulkDelete, disabled: bulkLoading },
        ]}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id))}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedIds(new Set(filteredClients.map((c) => c.id)))
                    else clearSelection()
                  }}
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <ResizableTableHead defaultWidth={280} storageKey="clientes-name">Nome / Razão Social</ResizableTableHead>
              <ResizableTableHead defaultWidth={170} storageKey="clientes-cnpj">CNPJ</ResizableTableHead>
              <ResizableTableHead defaultWidth={170} storageKey="clientes-regime">Regime Tributário</ResizableTableHead>
              <ResizableTableHead defaultWidth={220} storageKey="clientes-contact">E-mail / Telefone</ResizableTableHead>
              <ResizableTableHead defaultWidth={140} storageKey="clientes-estado">Estado</ResizableTableHead>
              <ResizableTableHead defaultWidth={110} storageKey="clientes-status">Status</ResizableTableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center justify-center text-center p-8">
                    <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-lg font-medium text-foreground">Nenhuma empresa encontrada</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm">
                      {search
                        ? "Tente ajustar o termo de busca."
                        : "Cadastre sua primeira empresa para começar a gerenciar suas obrigações fiscais."}
                    </p>
                    {!search && (
                      <Button onClick={() => handleOpenForm()} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" /> Cadastrar Empresa
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  data-state={selectedIds.has(client.id) ? "selected" : undefined}
                  className={selectedIds.has(client.id) ? "bg-primary/5" : ""}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={() => toggleSelect(client.id)}
                      aria-label={`Selecionar ${client.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      {(client.ie || client.im) && (
                        <p className="text-xs text-muted-foreground">
                          {client.ie && `IE: ${client.ie}`}
                          {client.ie && client.im && " · "}
                          {client.im && `IM: ${client.im}`}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{client.cnpj}</TableCell>
                  <TableCell>
                    {client.taxRegime ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TAX_REGIME_COLORS[client.taxRegime]}`}
                      >
                        {TAX_REGIME_LABELS[client.taxRegime]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {client.email && <p>{client.email}</p>}
                      {client.phone && <p className="text-muted-foreground">{client.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.state ? (
                      <div className="text-sm">
                        <p className="font-medium">{client.state.toUpperCase()}</p>
                        {client.city && (
                          <p className="text-xs text-muted-foreground truncate">{client.city}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={client.status === "active" ? "default" : "secondary"}
                      className={client.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {client.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(client.cnpj)}>
                          Copiar CNPJ
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenForm(client)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTemplateClient(client)}>
                          <Sparkles className="mr-2 h-4 w-4" /> Aplicar Template
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(client.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
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

      <ClientForm 
        client={editingClient} 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSave={handleSave} 
        onObligationsCreated={onUpdate}
      />

      {templateClient && (
        <TemplateApplyDialog
          open={!!templateClient}
          onOpenChange={(v) => { if (!v) setTemplateClient(null) }}
          clientName={templateClient.name}
          regime={templateClient.taxRegime || "simples_nacional"}
          activity={(templateClient.businessActivity as BusinessActivity) || "servicos"}
          taxes={taxes}
          onConfirm={handleApplyTemplate}
        />
      )}

      {bulkTemplateClients && bulkTemplateClients.length > 0 && (() => {
        // Pega o regime/atividade mais comum entre os selecionados pra default
        const regimeCounts = bulkTemplateClients.reduce(
          (acc, c) => {
            const r = c.taxRegime || "simples_nacional"
            acc[r] = (acc[r] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )
        const topRegime = Object.entries(regimeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as TaxRegime
        const activityCounts = bulkTemplateClients.reduce(
          (acc, c) => {
            const a = (c.businessActivity as BusinessActivity) || "servicos"
            acc[a] = (acc[a] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )
        const topActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as BusinessActivity
        return (
          <TemplateApplyDialog
            open={!!bulkTemplateClients}
            onOpenChange={(v) => { if (!v) setBulkTemplateClients(null) }}
            clientName={`${bulkTemplateClients.length} empresas selecionadas`}
            regime={topRegime || "simples_nacional"}
            activity={topActivity || "servicos"}
            taxes={taxes}
            onConfirm={handleBulkApplyTemplate}
          />
        )
      })()}
    </div>
  )
}
