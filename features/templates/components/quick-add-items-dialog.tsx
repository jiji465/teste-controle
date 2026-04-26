"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import {
  TEMPLATE_ITEM_CATALOG,
  groupedCatalog,
  type CatalogItem,
} from "@/lib/template-item-catalog"
import type { ObligationTemplate } from "@/lib/obligation-templates"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Itens já presentes no template — pra mostrar quais já estão lá (cinza) e evitar duplicar */
  existingNames?: Set<string>
  onAdd: (items: ObligationTemplate[]) => void
}

const SCOPE_BADGE: Record<string, { label: string; color: string }> = {
  federal: { label: "Federal", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  estadual: { label: "Estadual", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  municipal: { label: "Municipal", color: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
}

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  custom: "Personalizado",
}

export function QuickAddItemsDialog({ open, onOpenChange, existingNames, onAdd }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")

  const filtered = useMemo<CatalogItem[]>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return TEMPLATE_ITEM_CATALOG
    return TEMPLATE_ITEM_CATALOG.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    )
  }, [search])

  const grouped = useMemo(() => {
    if (!search.trim()) return groupedCatalog()
    const map = new Map<string, CatalogItem[]>()
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return map
  }, [filtered, search])

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleAdd = () => {
    const items = TEMPLATE_ITEM_CATALOG.filter((c) => selected.has(c.name)).map<ObligationTemplate>((c) => ({
      name: c.name,
      description: c.description,
      category: c.category,
      scope: c.scope,
      dueDay: c.dueDay,
      frequency: c.frequency,
      recurrence: c.recurrence,
      weekendRule: c.weekendRule,
      priority: c.priority,
    }))
    onAdd(items)
    setSelected(new Set())
    setSearch("")
    onOpenChange(false)
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      setSelected(new Set())
      setSearch("")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col p-0">
        <div className="p-6 border-b">
          <DialogHeader>
            <DialogTitle>Adicionar itens do catálogo</DialogTitle>
            <DialogDescription>
              Selecione vários itens prontos com defaults sensatos. Você pode editar qualquer campo depois.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar (DAS, ISS, ICMS…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {Array.from(grouped.entries()).map(([groupName, items]) => (
            <div key={groupName}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {groupName}
              </h4>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const isSelected = selected.has(item.name)
                  const isExisting = existingNames?.has(item.name) ?? false
                  const scopeMeta = item.scope ? SCOPE_BADGE[item.scope] : null
                  return (
                    <label
                      key={item.name}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : isExisting
                            ? "border-border bg-muted/30 opacity-60"
                            : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(item.name)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{item.name}</span>
                          {scopeMeta && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${scopeMeta.color}`}
                            >
                              {scopeMeta.label}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {FREQ_LABELS[item.frequency]} · Dia {item.dueDay}
                          </span>
                          {isExisting && (
                            <Badge variant="outline" className="text-[10px]">
                              já no template
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              Nenhum item encontrado para "{search}"
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/10">
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0}>
              Adicionar {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
