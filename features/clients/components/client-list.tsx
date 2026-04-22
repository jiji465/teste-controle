"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ClientForm } from "./client-form"
import { MoreVertical, Pencil, Trash2, Search, Plus, Building2 } from "lucide-react"
import type { Client } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { saveClient, deleteClient } from "@/features/clients/services"

type ClientListProps = {
  clients: Client[]
  onUpdate: () => void
}

export function ClientList({ clients, onUpdate }: ClientListProps) {
  const [search, setSearch] = useState("")
  const [editingClient, setEditingClient] = useState<Client | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.cnpj.includes(search) ||
      (client.taxRegime && TAX_REGIME_LABELS[client.taxRegime]?.toLowerCase().includes(search.toLowerCase())),
  )

  const handleSave = async (client: Client) => {
    await saveClient(client)
    onUpdate()
    setEditingClient(undefined)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      await deleteClient(id)
      onUpdate()
    }
  }

  const handleOpenForm = (client?: Client) => {
    setEditingClient(client)
    setIsFormOpen(true)
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

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CNPJ ou regime tributário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Razão Social</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Regime Tributário</TableHead>
              <TableHead>E-mail / Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                <TableRow key={client.id}>
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
    </div>
  )
}
