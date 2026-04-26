"use client"

import { useState, useEffect, useMemo } from "react"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  Layers,
  RotateCcw,
  Copy,
  Database,
  Eraser,
  Search,
  Filter,
} from "lucide-react"
import {
  seedDefaultTemplates,
  resetDefaultTemplates,
  cloneCustomTemplate,
  BUSINESS_ACTIVITY_LABELS,
  type CustomTemplatePackage,
  type BusinessActivity,
} from "@/lib/obligation-templates"
import { getCustomTemplatesAsync, deleteCustomTemplateAsync } from "@/features/templates/services"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS, type TaxRegime } from "@/lib/types"
import { seedDemoData, clearAllData } from "@/lib/seed-demo"
import { toast } from "sonner"
import { TemplatePackageForm } from "@/features/templates/components/template-package-form"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { matchesText } from "@/lib/utils"

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CustomTemplatePackage[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplatePackage | undefined>()
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [regimeFilter, setRegimeFilter] = useState<string>("all")
  const [activityFilter, setActivityFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  const loadTemplates = async () => {
    const list = await getCustomTemplatesAsync()
    setTemplates(list)
  }

  useEffect(() => {
    void (async () => {
      const { migrateLocalTemplatesToSupabase } = await import("@/features/templates/services")
      const result = await migrateLocalTemplatesToSupabase()
      if (result.migrated > 0) {
        toast.success(
          `${result.migrated} template${result.migrated > 1 ? "s" : ""} sincronizado${result.migrated > 1 ? "s" : ""} com a nuvem`,
        )
      }
      await seedDefaultTemplates()
      await loadTemplates()
    })()
  }, [])

  // ─── Filtros + busca ────────────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    const q = search.trim()
    return templates.filter((t) => {
      if (q) {
        const hit =
          matchesText(t.name, q) ||
          matchesText(t.description, q) ||
          (t.regime ? matchesText(TAX_REGIME_LABELS[t.regime], q) : false) ||
          (t.activity ? matchesText(BUSINESS_ACTIVITY_LABELS[t.activity], q) : false) ||
          t.obligations.some((o) => matchesText(o.name, q))
        if (!hit) return false
      }
      if (regimeFilter !== "all" && t.regime !== regimeFilter) return false
      if (activityFilter !== "all" && t.activity !== activityFilter) return false
      return true
    })
  }, [templates, search, regimeFilter, activityFilter])

  const activeFilterCount = (regimeFilter !== "all" ? 1 : 0) + (activityFilter !== "all" ? 1 : 0)

  // ─── Seleção múltipla ───────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())
  const selectAllVisible = () => setSelectedIds(new Set(filteredTemplates.map((t) => t.id)))
  const allVisibleSelected =
    filteredTemplates.length > 0 && filteredTemplates.every((t) => selectedIds.has(t.id))

  // ─── Ações ──────────────────────────────────────────────────────────────────
  const handleOpenForm = (template?: CustomTemplatePackage) => {
    setEditingTemplate(template)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    const target = templates.find((t) => t.id === id)
    const isDefault = target?.name.startsWith("Padrão · ")
    setConfirmState({
      title: "Excluir template",
      description: isDefault
        ? "Esse é um template padrão. Ele não vai voltar mesmo se você clicar em 'Restaurar padrões'. Deseja continuar?"
        : "Tem certeza que deseja excluir este pacote de templates?",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteCustomTemplateAsync(id)
          await loadTemplates()
          toast.success("Template excluído")
        } catch (err) {
          toast.error(`Falha ao excluir: ${err instanceof Error ? err.message : "erro desconhecido"}`)
        }
      },
    })
  }

  const handleClone = async (id: string) => {
    const cloned = cloneCustomTemplate(id)
    if (cloned) {
      await new Promise((r) => setTimeout(r, 200))
      await loadTemplates()
      toast.success(`Template clonado como "${cloned.name}"`)
    }
  }

  // ─── Bulk actions ───────────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const targets = templates.filter((t) => ids.includes(t.id))
    const defaultsCount = targets.filter((t) => t.name.startsWith("Padrão · ")).length
    setConfirmState({
      title: `Excluir ${ids.length} template${ids.length > 1 ? "s" : ""}`,
      description:
        defaultsCount > 0
          ? `Atenção: ${defaultsCount} ${defaultsCount === 1 ? "é template padrão e não voltará" : "são templates padrão e não voltarão"} mesmo clicando em 'Restaurar padrões'. Continuar?`
          : "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir tudo",
      destructive: true,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await Promise.all(ids.map((id) => deleteCustomTemplateAsync(id).catch(() => {})))
          toast.success(`${ids.length} template${ids.length > 1 ? "s excluídos" : " excluído"}`)
          clearSelection()
          await loadTemplates()
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkDuplicate = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setBulkLoading(true)
    try {
      let count = 0
      for (const id of ids) {
        const cloned = cloneCustomTemplate(id)
        if (cloned) count++
      }
      // Aguarda Supabase confirmar saves background
      await new Promise((r) => setTimeout(r, 300 + ids.length * 100))
      await loadTemplates()
      toast.success(`${count} template${count > 1 ? "s duplicados" : " duplicado"}`)
      clearSelection()
    } finally {
      setBulkLoading(false)
    }
  }

  // ─── Ferramentas de teste ───────────────────────────────────────────────────
  const handleSeedDemo = () => {
    setConfirmState({
      title: "Carregar dados de exemplo",
      description:
        "Adiciona 30 empresas + impostos + ~150 obrigações + ~18 parcelamentos para testar com volume. Seus dados existentes NÃO serão apagados.",
      confirmLabel: "Carregar",
      onConfirm: () => {
        const res = seedDemoData()
        toast.success(
          `Carregados: ${res.clients} empresas, ${res.taxes} impostos, ${res.obligations} obrigações, ${res.installments} parcelamentos. Recarregando…`,
        )
        setTimeout(() => window.location.reload(), 1500)
      },
    })
  }

  const handleClearAll = () => {
    setConfirmState({
      title: "Apagar TODOS os dados",
      description:
        "Apaga todas as empresas, impostos, obrigações e parcelamentos do sistema. Os templates NÃO são apagados. Esta ação não pode ser desfeita.",
      confirmLabel: "Apagar tudo",
      destructive: true,
      onConfirm: () => {
        clearAllData()
        toast.success("Todos os dados apagados. Recarregando…")
        setTimeout(() => window.location.reload(), 1200)
      },
    })
  }

  const handleRestoreDefaults = () => {
    setConfirmState({
      title: "Restaurar templates padrão",
      description:
        "Apaga os templates que começam com 'Padrão · ' e recria as versões atualizadas. Seus templates personalizados não serão afetados.",
      confirmLabel: "Restaurar",
      onConfirm: async () => {
        await resetDefaultTemplates()
        await loadTemplates()
        toast.success("Templates padrão restaurados")
      },
    })
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="size-6 text-primary" />
              Meus Templates
            </h1>
            <p className="text-sm text-muted-foreground">
              Crie pacotes personalizados de obrigações para aplicar em lote nas suas empresas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRestoreDefaults} className="gap-2">
              <RotateCcw className="size-4" />
              Restaurar padrões
            </Button>
            <Button onClick={() => handleOpenForm()} className="gap-2">
              <Plus className="size-4" />
              Novo Template
            </Button>
          </div>
        </div>

        {/* Busca + Filtros + Selecionar todos */}
        {templates.length > 0 && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, descrição, regime, atividade ou item…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="size-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 size-5 rounded-full p-0 flex items-center justify-center"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                <Checkbox
                  id="select-all-templates"
                  checked={allVisibleSelected}
                  onCheckedChange={(c) => (c ? selectAllVisible() : clearSelection())}
                />
                <label
                  htmlFor="select-all-templates"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  Selecionar todos ({filteredTemplates.length})
                </label>
              </div>
            </div>

            {showFilters && (
              <div className="grid sm:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Regime tributário</label>
                  <Select value={regimeFilter} onValueChange={setRegimeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os regimes</SelectItem>
                      {(Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Atividade</label>
                  <Select value={activityFilter} onValueChange={setActivityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {(Object.entries(BUSINESS_ACTIVITY_LABELS) as [BusinessActivity, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
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
                {
                  label: "Duplicar",
                  icon: <Copy className="size-3.5" />,
                  onClick: handleBulkDuplicate,
                  disabled: bulkLoading,
                },
                {
                  label: "Excluir",
                  icon: <Trash2 className="size-3.5" />,
                  tone: "destructive",
                  onClick: handleBulkDelete,
                  disabled: bulkLoading,
                },
              ]}
            />
          </>
        )}

        {/* Cards */}
        {templates.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Layers className="size-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum template personalizado</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Crie pacotes de obrigações para aplicar rapidamente a empresas com perfis específicos
              (ex: Clínicas Médicas, Escolas, etc).
            </p>
            <Button onClick={() => handleOpenForm()}>Criar Primeiro Template</Button>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Search className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum template corresponde à busca</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajuste o termo de busca ou os filtros.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearch("")
                setRegimeFilter("all")
                setActivityFilter("all")
              }}
            >
              Limpar busca e filtros
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((pkg) => {
              const isSelected = selectedIds.has(pkg.id)
              return (
                <Card
                  key={pkg.id}
                  className={`flex flex-col transition-colors ${
                    isSelected ? "ring-2 ring-primary border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(pkg.id)}
                        className="mt-1"
                        aria-label={`Selecionar ${pkg.name}`}
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl">{pkg.name}</CardTitle>
                        {pkg.description && (
                          <CardDescription className="line-clamp-2 mt-1">{pkg.description}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <Badge variant="secondary">{pkg.obligations.length} itens</Badge>
                      {pkg.regime && (
                        <Badge className={`text-[10px] ${TAX_REGIME_COLORS[pkg.regime]}`}>
                          {TAX_REGIME_LABELS[pkg.regime]}
                        </Badge>
                      )}
                      {pkg.activity && (
                        <Badge variant="outline" className="text-[10px]">
                          {BUSINESS_ACTIVITY_LABELS[pkg.activity]}
                        </Badge>
                      )}
                    </div>
                    <ul className="text-sm space-y-2 text-muted-foreground line-clamp-4">
                      {pkg.obligations.slice(0, 4).map((o, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="size-1.5 rounded-full bg-primary/50" />
                          {o.name}
                        </li>
                      ))}
                      {pkg.obligations.length > 4 && (
                        <li className="text-xs italic">... e mais {pkg.obligations.length - 4}</li>
                      )}
                    </ul>
                  </CardContent>
                  <CardFooter className="border-t pt-4 gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => handleOpenForm(pkg)}>
                      <Pencil className="size-4" /> Editar
                    </Button>
                    <Button variant="outline" title="Duplicar template" onClick={() => handleClone(pkg.id)}>
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      title="Excluir template"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(pkg.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}

        {/* Ferramentas de teste */}
        <div className="mt-10 border-t pt-6">
          <div className="space-y-1 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ferramentas de teste
            </h2>
            <p className="text-xs text-muted-foreground">
              Use para simular o sistema com volume de dados ou zerar tudo. Só afeta o armazenamento local.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleSeedDemo} className="gap-2">
              <Database className="size-4" />
              Carregar 30 empresas de exemplo
            </Button>
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Eraser className="size-4" />
              Apagar todos os dados
            </Button>
          </div>
        </div>
      </div>

      <TemplatePackageForm
        template={editingTemplate}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={loadTemplates}
      />
    </div>
  )
}
