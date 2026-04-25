"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Star, Trash2, Filter } from "lucide-react"
import type { SavedFilter } from "@/lib/types"

type SavedFiltersProps = {
  currentFilters: SavedFilter["filters"]
  onApplyFilter: (filters: SavedFilter["filters"]) => void
}

export function SavedFilters({ currentFilters, onApplyFilter }: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [filterName, setFilterName] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem("savedFilters")
    if (stored) {
      setSavedFilters(JSON.parse(stored))
    }
  }, [])

  const saveFilter = () => {
    if (!filterName.trim()) return

    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: filterName,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    }

    const updated = [...savedFilters, newFilter]
    setSavedFilters(updated)
    localStorage.setItem("savedFilters", JSON.stringify(updated))
    setFilterName("")
    setShowSaveDialog(false)
  }

  const deleteFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id)
    setSavedFilters(updated)
    localStorage.setItem("savedFilters", JSON.stringify(updated))
  }

  const getFilterDescription = (filter: SavedFilter) => {
    const parts: string[] = []
    if (filter.filters.status?.length) parts.push(`${filter.filters.status.length} status`)
    if (filter.filters.priority?.length) parts.push(`${filter.filters.priority.length} prioridades`)
    if (filter.filters.clientId) parts.push("1 cliente")
    if (filter.filters.search) parts.push("busca")
    return parts.join(", ") || "Sem filtros"
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Star className="size-4" />
            Filtros Salvos
            {savedFilters.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {savedFilters.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[300px]">
          {savedFilters.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum filtro salvo ainda</div>
          ) : (
            <>
              {savedFilters.map((filter) => (
                <DropdownMenuItem key={filter.id} className="flex items-start justify-between p-3 cursor-pointer">
                  <div className="flex-1" onClick={() => onApplyFilter(filter.filters)}>
                    <p className="font-medium text-sm">{filter.name}</p>
                    <p className="text-xs text-muted-foreground">{getFilterDescription(filter)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteFilter(filter.id)
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowSaveDialog(true)} className="gap-2">
            <Filter className="size-4" />
            Salvar Filtro Atual
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Salvar Filtro</DialogTitle>
            <DialogDescription>Dê um nome para salvar a combinação atual de filtros</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filterName">Nome do Filtro</Label>
              <Input
                id="filterName"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Ex: Urgentes desta semana"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    saveFilter()
                  }
                }}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Filtros atuais:</p>
              <p className="text-xs text-muted-foreground">
                {currentFilters.status?.length ? `Status: ${currentFilters.status.join(", ")}` : ""}
                {currentFilters.priority?.length ? ` | Prioridade: ${currentFilters.priority.join(", ")}` : ""}
                {currentFilters.search ? ` | Busca: "${currentFilters.search}"` : ""}
                {!currentFilters.status?.length && !currentFilters.priority?.length && !currentFilters.search
                  ? "Nenhum filtro ativo"
                  : ""}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveFilter} disabled={!filterName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
