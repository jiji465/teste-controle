"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, FileText, Receipt, Loader2, Sparkles, Layers, CalendarRange } from "lucide-react"
import Link from "next/link"
import {
  getCustomTemplates,
  findBestTemplateMatch,
  type ObligationTemplate,
  type BusinessActivity,
  type CustomTemplatePackage,
  type TemplateItem,
  getApplicableTaxesForClient,
  taxToTemplateItem,
  BUSINESS_ACTIVITY_LABELS,
} from "@/lib/obligation-templates"
import { previewApplyTemplate, type CompetencyRange } from "@/lib/template-applier"
import type { Tax, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  regime: TaxRegime
  activity: BusinessActivity
  /** Todos os impostos cadastrados. O dialog filtra os aplicáveis ao regime. */
  taxes?: Tax[]
  onConfirm: (selected: TemplateItem[], range: CompetencyRange) => Promise<void>
}

/** Retorna o mês corrente como "YYYY-MM" (ex: "2026-04"). */
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Retorna dezembro do ano corrente como "YYYY-MM". */
function endOfYear(): string {
  return `${new Date().getFullYear()}-12`
}

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  custom: "Personalizado",
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
}

const itemKey = (item: TemplateItem): string => item.sourceTaxId ?? `tpl:${item.name}`

export function TemplateApplyDialog({
  open,
  onOpenChange,
  clientName,
  regime,
  activity,
  taxes = [],
  onConfirm,
}: Props) {
  const [customPackages, setCustomPackages] = useState<CustomTemplatePackage[]>([])
  const [activePackageId, setActivePackageId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [competencyStart, setCompetencyStart] = useState<string>(currentMonth())
  const [competencyEnd, setCompetencyEnd] = useState<string>(endOfYear())
  const [rangeError, setRangeError] = useState<string>("")

  useEffect(() => {
    if (!open) return
    const packages = getCustomTemplates()
    setCustomPackages(packages)
    // Pré-seleciona o template que combina com regime+atividade do cliente
    const match = findBestTemplateMatch(packages, regime, activity)
    setActivePackageId(match?.id ?? packages[0]?.id ?? "")
    // Reseta competências sempre que abre
    setCompetencyStart(currentMonth())
    setCompetencyEnd(endOfYear())
    setRangeError("")
  }, [open, regime, activity])

  const baseTemplates: ObligationTemplate[] = useMemo(() => {
    if (!activePackageId) return []
    return customPackages.find((p) => p.id === activePackageId)?.obligations || []
  }, [activePackageId, customPackages])

  const applicableTaxItems: TemplateItem[] = useMemo(() => {
    return getApplicableTaxesForClient(regime, taxes).map(taxToTemplateItem)
  }, [regime, taxes])

  const allItems: TemplateItem[] = useMemo(() => {
    const seenNames = new Set<string>()
    const merged: TemplateItem[] = []
    for (const t of baseTemplates) {
      seenNames.add(t.name.toLowerCase())
      merged.push({ ...t })
    }
    // Evita duplicar quando o template do sistema já cobre o nome do imposto
    for (const t of applicableTaxItems) {
      if (!seenNames.has(t.name.toLowerCase())) merged.push(t)
    }
    return merged
  }, [baseTemplates, applicableTaxItems])

  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelected(new Set(allItems.map(itemKey)))
  }, [allItems])

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const validateRange = (): boolean => {
    if (!/^\d{4}-\d{2}$/.test(competencyStart) || !/^\d{4}-\d{2}$/.test(competencyEnd)) {
      setRangeError("Selecione mês inicial e final.")
      return false
    }
    if (competencyStart > competencyEnd) {
      setRangeError("Competência inicial não pode ser maior que a final.")
      return false
    }
    setRangeError("")
    return true
  }

  const handleConfirm = async () => {
    if (!validateRange()) return
    setLoading(true)
    try {
      const chosen = allItems.filter((t) => selected.has(itemKey(t)))
      await onConfirm(chosen, { start: competencyStart, end: competencyEnd })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  // Prévia: quantas instâncias serão criadas no intervalo escolhido
  const preview = useMemo(() => {
    const chosen = allItems.filter((t) => selected.has(itemKey(t)))
    if (!chosen.length || !competencyStart || !competencyEnd || competencyStart > competencyEnd) {
      return { taxes: 0, obligations: 0, total: 0 }
    }
    return previewApplyTemplate(chosen, { start: competencyStart, end: competencyEnd })
  }, [allItems, selected, competencyStart, competencyEnd])

  // Seção 1: TODOS os itens de imposto/guia (categoria tax_guide), independente da origem
  // Seção 2: TODOS os demais (declarações, sped, obrigações acessórias)
  const impostoItems = allItems.filter((t) => t.category === "tax_guide")
  const obrigacaoItems = allItems.filter((t) => t.category !== "tax_guide")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Aplicar Template</DialogTitle>
              <DialogDescription>
                Impostos vão para <strong>/impostos</strong>, obrigações vão para <strong>/obrigações</strong>. Selecione o que aplicar para <strong>{clientName}</strong>.
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TAX_REGIME_COLORS[regime]}`}>
              {TAX_REGIME_LABELS[regime]}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {BUSINESS_ACTIVITY_LABELS[activity]}
            </span>
          </div>
        </DialogHeader>

        {/* Intervalo de competências */}
        <div className="px-6 py-3 bg-blue-50/50 dark:bg-blue-950/20 border-b">
          <div className="flex items-center gap-2 mb-2">
            <CalendarRange className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium">Intervalo de Competências</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="competency-start" className="text-xs">De</Label>
              <Input
                id="competency-start"
                type="month"
                value={competencyStart}
                onChange={(e) => setCompetencyStart(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="competency-end" className="text-xs">Até</Label>
              <Input
                id="competency-end"
                type="month"
                value={competencyEnd}
                onChange={(e) => setCompetencyEnd(e.target.value)}
                className="h-8"
              />
            </div>
          </div>
          {rangeError && <p className="text-xs text-red-600 mt-1">{rangeError}</p>}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Vai gerar uma instância para cada mês de competência conforme a recorrência de cada item (mensal = 1/mês, trimestral = 1 a cada 3 meses, anual = 1 só).
          </p>
        </div>

        {customPackages.length > 0 && (
          <div className="px-6 py-3 bg-muted/30 border-b">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Template:</span>
              <Select value={activePackageId} onValueChange={setActivePackageId}>
                <SelectTrigger className="w-[340px] h-8 text-xs">
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {/* Templates do mesmo regime do cliente aparecem primeiro, marcados */}
                  {sortPackagesForClient(customPackages, regime, activity).map((pkg) => {
                    const isMatch = pkg.regime === regime && pkg.activity === activity
                    const isPartialMatch = !isMatch && pkg.regime === regime
                    return (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        <div className="flex items-center gap-2">
                          {isMatch && <span className="text-emerald-600">✓</span>}
                          {isPartialMatch && <span className="text-amber-600">~</span>}
                          <span>{pkg.name}</span>
                          <span className="text-muted-foreground">({pkg.obligations.length})</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const active = customPackages.find((p) => p.id === activePackageId)
              if (!active?.regime) return null
              const isMatch = active.regime === regime && active.activity === activity
              return (
                <p className={`text-xs mt-1.5 ${isMatch ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {isMatch
                    ? "✓ Template combina exatamente com o regime e atividade da empresa"
                    : `⚠ Template é de outro perfil — você pode trocar acima ou continuar`}
                </p>
              )
            })()}
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-2 border-b text-sm">
          <span className="text-muted-foreground">
            {selected.size} de {allItems.length} selecionados
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelected(new Set(allItems.map(itemKey)))}
            >
              Marcar todos
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Desmarcar todos
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <Layers className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Nada para aplicar ainda</p>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Crie um template em <Link href="/templates" className="text-primary underline">Meus Templates</Link> ou cadastre impostos com regimes aplicáveis.
                </p>
              </div>
            </div>
          ) : (
          <div className="space-y-4 py-2">
            {impostoItems.length > 0 && (
              <Section
                title="Impostos / Guias a Recolher"
                icon={<Receipt className="size-3.5" />}
                subtitle={`${impostoItems.filter(t => t.sourceTaxId).length} vinculados ao cadastro de impostos`}
                items={impostoItems}
                selected={selected}
                onToggle={toggle}
              />
            )}
            {obrigacaoItems.length > 0 && (
              <Section
                title="Obrigações Acessórias"
                icon={<FileText className="size-3.5" />}
                items={obrigacaoItems}
                selected={selected}
                onToggle={toggle}
              />
            )}
          </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
          {selected.size > 0 && preview.total > 0 && (
            <p className="text-xs text-muted-foreground sm:mr-auto">
              Vai criar <strong>{preview.total}</strong> instância{preview.total > 1 ? "s" : ""}
              {preview.taxes > 0 && preview.obligations > 0 && (
                <> ({preview.taxes} guia{preview.taxes > 1 ? "s" : ""} + {preview.obligations} acessória{preview.obligations > 1 ? "s" : ""})</>
              )}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || selected.size === 0 || preview.total === 0}>
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" /> Aplicando...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 mr-2" />
                Aplicar {preview.total > 0 ? `${preview.total} instância${preview.total > 1 ? "s" : ""}` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type SectionProps = {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  items: TemplateItem[]
  selected: Set<string>
  onToggle: (key: string) => void
}

function Section({ title, subtitle, icon, items, selected, onToggle }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title} ({items.length})
        </h4>
        {subtitle && <span className="text-[10px] text-muted-foreground ml-1">· {subtitle}</span>}
      </div>
      <div className="space-y-1.5">
        {items.map((t) => {
          const key = itemKey(t)
          const isSelected = selected.has(key)
          return (
            <label
              key={key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:border-muted-foreground/30 opacity-60"
              }`}
            >
              <Checkbox checked={isSelected} onCheckedChange={() => onToggle(key)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{t.name}</span>
                  {t.sourceTaxId && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      vinculado ao imposto
                    </span>
                  )}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[t.priority]}`}>
                    {t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "medium" ? "Média" : "Baixa"}
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {FREQ_LABELS[t.frequency]} · Dia {t.dueDay}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Ordena os templates colocando os que combinam com o cliente no topo:
 * 1. Match exato regime+atividade
 * 2. Match só de regime
 * 3. Demais
 */
function sortPackagesForClient(
  packages: CustomTemplatePackage[],
  regime: TaxRegime,
  activity: BusinessActivity,
): CustomTemplatePackage[] {
  return [...packages].sort((a, b) => {
    const score = (p: CustomTemplatePackage): number => {
      if (p.regime === regime && p.activity === activity) return 0
      if (p.regime === regime) return 1
      return 2
    }
    const diff = score(a) - score(b)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}
