"use client"

import { useMemo, useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Sparkles, Plus } from "lucide-react"
import {
  TEMPLATE_ITEM_CATALOG,
  groupedCatalog,
  type CatalogItem,
} from "@/lib/template-item-catalog"
import type { CustomTemplatePackage, ObligationTemplate } from "@/lib/obligation-templates"
import { saveCustomTemplateAsync } from "@/features/templates/services"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Templates onde os itens serão adicionados */
  targets: CustomTemplatePackage[]
  onSuccess: () => void
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

const emptyCustom = (): ObligationTemplate => ({
  name: "",
  description: "",
  category: "tax_guide",
  scope: "federal",
  dueDay: 20,
  frequency: "monthly",
  recurrence: "monthly",
  weekendRule: "anticipate",
  priority: "high",
})

export function BulkAddItemToTemplatesDialog({ open, onOpenChange, targets, onSuccess }: Props) {
  const [tab, setTab] = useState<"catalog" | "custom">("catalog")
  const [search, setSearch] = useState("")
  const [catalogSelected, setCatalogSelected] = useState<Set<string>>(new Set())
  const [customItem, setCustomItem] = useState<ObligationTemplate>(emptyCustom())
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Reset ao reabrir
  useEffect(() => {
    if (open) {
      setTab("catalog")
      setSearch("")
      setCatalogSelected(new Set())
      setCustomItem(emptyCustom())
      setSkipDuplicates(true)
    }
  }, [open])

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

  const toggleCatalog = (name: string) => {
    setCatalogSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // ─── Apply: monta lista de itens, adiciona a cada template, salva ─────────
  const handleApply = async () => {
    let itemsToAdd: ObligationTemplate[] = []
    if (tab === "catalog") {
      itemsToAdd = TEMPLATE_ITEM_CATALOG
        .filter((c) => catalogSelected.has(c.name))
        .map<ObligationTemplate>((c) => ({
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
    } else {
      if (!customItem.name.trim()) {
        toast.error("Nome do item é obrigatório")
        return
      }
      itemsToAdd = [{ ...customItem, name: customItem.name.trim() }]
    }

    if (itemsToAdd.length === 0 || targets.length === 0) {
      toast.error("Selecione pelo menos um item e um template")
      return
    }

    setIsSaving(true)
    try {
      let totalAdded = 0
      let totalSkipped = 0
      const now = new Date().toISOString()

      for (const tpl of targets) {
        const existingNames = new Set(tpl.obligations.map((o) => o.name))
        const newItems = skipDuplicates
          ? itemsToAdd.filter((it) => !existingNames.has(it.name))
          : itemsToAdd
        const skipped = itemsToAdd.length - newItems.length

        if (newItems.length === 0) {
          totalSkipped += skipped
          continue
        }

        const updated: CustomTemplatePackage = {
          ...tpl,
          obligations: [...tpl.obligations, ...newItems],
          updatedAt: now,
        }
        await saveCustomTemplateAsync(updated)
        totalAdded += newItems.length
        totalSkipped += skipped
      }

      toast.success(
        `${totalAdded} item${totalAdded !== 1 ? "s" : ""} adicionado${totalAdded !== 1 ? "s" : ""} em ${targets.length} template${targets.length > 1 ? "s" : ""}` +
          (totalSkipped > 0 ? ` · ${totalSkipped} duplicado${totalSkipped > 1 ? "s ignorados" : " ignorado"}` : ""),
      )
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(`Falha ao salvar: ${err instanceof Error ? err.message : "erro desconhecido"}`)
    } finally {
      setIsSaving(false)
    }
  }

  const canApply =
    targets.length > 0 &&
    !isSaving &&
    (tab === "catalog" ? catalogSelected.size > 0 : customItem.name.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col p-0">
        <div className="p-6 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Adicionar item a {targets.length} template{targets.length > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Adiciona o mesmo item em todos os templates selecionados de uma vez.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "catalog" | "custom")}>
            <TabsList className="grid grid-cols-2 w-full max-w-[420px]">
              <TabsTrigger value="catalog" className="gap-1.5">
                <Sparkles className="size-3.5" /> Do catálogo
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-1.5">
                <Plus className="size-3.5" /> Item personalizado
              </TabsTrigger>
            </TabsList>

            {/* TAB: catálogo */}
            <TabsContent value="catalog" className="space-y-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar (DAS, ISS, ICMS…)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-4">
                {Array.from(grouped.entries()).map(([groupName, items]) => (
                  <div key={groupName}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {groupName}
                    </h4>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const isSelected = catalogSelected.has(item.name)
                        const scopeMeta = item.scope ? SCOPE_BADGE[item.scope] : null
                        return (
                          <label
                            key={item.name}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary/40 bg-primary/5"
                                : "border-border hover:border-muted-foreground/30"
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCatalog(item.name)}
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
            </TabsContent>

            {/* TAB: personalizado */}
            <TabsContent value="custom" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={customItem.category === "tax_guide" ? "tax" : "obligation"}
                      onValueChange={(v) =>
                        setCustomItem({ ...customItem, category: v === "tax" ? "tax_guide" : "declaration" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tax">Imposto / Guia</SelectItem>
                        <SelectItem value="obligation">Obrigação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Esfera</Label>
                    <Select
                      value={customItem.scope}
                      onValueChange={(v) =>
                        setCustomItem({
                          ...customItem,
                          scope: v as ObligationTemplate["scope"],
                          // Auto: federal antecipa, estadual/municipal posterga
                          weekendRule: v === "federal" ? "anticipate" : "postpone",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="federal">Federal</SelectItem>
                        <SelectItem value="estadual">Estadual</SelectItem>
                        <SelectItem value="municipal">Municipal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    placeholder="Ex: ISS Retido, GNRE, IPVA Frota…"
                    value={customItem.name}
                    onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Input
                    placeholder="Detalhe curto"
                    value={customItem.description}
                    onChange={(e) => setCustomItem({ ...customItem, description: e.target.value })}
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dia do venc. *</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={customItem.dueDay}
                      onChange={(e) =>
                        setCustomItem({ ...customItem, dueDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Recorrência</Label>
                    <Select
                      value={customItem.recurrence}
                      onValueChange={(v) =>
                        setCustomItem({
                          ...customItem,
                          recurrence: v as ObligationTemplate["recurrence"],
                          frequency:
                            v === "monthly"
                              ? "monthly"
                              : v === "quarterly"
                                ? "quarterly"
                                : v === "annual"
                                  ? "annual"
                                  : "custom",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="bimonthly">Bimestral</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade</Label>
                    <Select
                      value={customItem.priority}
                      onValueChange={(v) =>
                        setCustomItem({ ...customItem, priority: v as ObligationTemplate["priority"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Fim de semana / feriado</Label>
                  <Select
                    value={customItem.weekendRule}
                    onValueChange={(v) =>
                      setCustomItem({ ...customItem, weekendRule: v as ObligationTemplate["weekendRule"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anticipate">Antecipa pro último dia útil</SelectItem>
                      <SelectItem value="postpone">Posterga pro próximo dia útil</SelectItem>
                      <SelectItem value="keep">Mantém na data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-6 border-t bg-muted/10 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={skipDuplicates}
              onCheckedChange={(c) => setSkipDuplicates(c === true)}
            />
            <span className="text-sm text-muted-foreground">
              Pular itens com nome igual ao já existente no template
            </span>
          </label>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleApply} disabled={!canApply}>
              {isSaving
                ? "Aplicando…"
                : `Aplicar em ${targets.length} template${targets.length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
