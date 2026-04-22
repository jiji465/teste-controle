"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, FileText, Receipt, BookOpen, Loader2, Sparkles } from "lucide-react"
import type { ObligationTemplate, BusinessActivity } from "@/lib/obligation-templates"
import type { TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { BUSINESS_ACTIVITY_LABELS } from "@/lib/obligation-templates"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  regime: TaxRegime
  activity: BusinessActivity
  templates: ObligationTemplate[]
  onConfirm: (selected: ObligationTemplate[]) => Promise<void>
}

const CATEGORY_LABELS: Record<string, string> = {
  tax_guide: "Guia de Imposto",
  declaration: "Declaração",
  sped: "SPED / Escrituração",
  certificate: "Certidão",
  other: "Outros",
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  tax_guide: <Receipt className="size-3.5" />,
  declaration: <FileText className="size-3.5" />,
  sped: <BookOpen className="size-3.5" />,
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

export function TemplateApplyDialog({ open, onOpenChange, clientName, regime, activity, templates, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(templates.map(t => t.name)))
  const [loading, setLoading] = useState(false)

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const chosen = templates.filter(t => selected.has(t.name))
      await onConfirm(chosen)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  // Group by category
  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, ObligationTemplate[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Template de Obrigações</DialogTitle>
              <DialogDescription>
                Selecione quais obrigações aplicar para <strong>{clientName}</strong>
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

        <div className="flex items-center justify-between py-2 border-b text-sm">
          <span className="text-muted-foreground">{selected.size} de {templates.length} selecionadas</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set(templates.map(t => t.name)))}>
              Marcar todas
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Desmarcar todas
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4 py-2">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-muted-foreground">{CATEGORY_ICONS[category]}</span>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {CATEGORY_LABELS[category] || category} ({items.length})
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {items.map(t => (
                    <label
                      key={t.name}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected.has(t.name)
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:border-muted-foreground/30 opacity-60"
                      }`}
                    >
                      <Checkbox
                        checked={selected.has(t.name)}
                        onCheckedChange={() => toggle(t.name)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{t.name}</span>
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || selected.size === 0}>
            {loading ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Criando...</>
            ) : (
              <><CheckCircle2 className="size-4 mr-2" /> Criar {selected.size} Obrigações</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
