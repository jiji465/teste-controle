"use client"

import { useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Receipt, FileText, Sparkles, X } from "lucide-react"
import { type CustomTemplatePackage, type ObligationTemplate } from "@/lib/obligation-templates"
import { saveCustomTemplateAsync } from "@/features/templates/services"
import { QuickAddItemsDialog } from "./quick-add-items-dialog"
import { toast } from "sonner"
import { useState } from "react"

// No template mostramos só 2 tipos para o usuário: "Imposto" (guia a pagar) e "Obrigação" (declaração a transmitir).
// Internamente mapeamos para ObligationCategory.
type TemplateItemKind = "tax" | "obligation"

const obligationSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  description: z.string().optional().default(""),
  kind: z.enum(["tax", "obligation"]).default("tax"),
  scope: z.enum(["federal", "estadual", "municipal"]).optional(),
  dueDay: z.coerce.number().min(1, "Dia inválido").max(31, "Dia inválido"),
  recurrence: z.enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"]).default("monthly"),
  weekendRule: z.enum(["postpone", "anticipate", "keep"]).default("postpone"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
})

const templatePackageSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  description: z.string().optional().default(""),
  regime: z.enum(["simples_nacional", "lucro_presumido", "lucro_real", "mei", "imune_isento", ""]).optional().default(""),
  activity: z.enum(["servicos", "comercio", "industria", "misto", ""]).optional().default(""),
  obligations: z.array(obligationSchema).min(1, "Adicione ao menos um item"),
})

type FormData = z.infer<typeof templatePackageSchema>

// Derivação automática de frequency a partir da recurrence
function frequencyFromRecurrence(r: ObligationTemplate["recurrence"]): ObligationTemplate["frequency"] {
  if (r === "monthly") return "monthly"
  if (r === "quarterly") return "quarterly"
  if (r === "annual") return "annual"
  return "custom"
}

function kindToCategory(k: TemplateItemKind): ObligationTemplate["category"] {
  return k === "tax" ? "tax_guide" : "declaration"
}

function categoryToKind(c: ObligationTemplate["category"]): TemplateItemKind {
  return c === "tax_guide" ? "tax" : "obligation"
}

const newItem = (): z.infer<typeof obligationSchema> => ({
  name: "",
  description: "",
  kind: "tax",
  scope: "federal",
  dueDay: 20,
  recurrence: "monthly",
  weekendRule: "postpone",
  priority: "high",
})

type Props = {
  template?: CustomTemplatePackage
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function TemplatePackageForm({ template, open, onOpenChange, onSave }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(templatePackageSchema),
    defaultValues: { name: "", description: "", obligations: [] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "obligations",
  })

  useEffect(() => {
    if (!open) return
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        regime: (template.regime ?? "") as "" | "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei" | "imune_isento",
        activity: (template.activity ?? "") as "" | "servicos" | "comercio" | "industria" | "misto",
        obligations: template.obligations.map((o) => ({
          name: o.name,
          description: o.description || "",
          kind: categoryToKind(o.category),
          scope: o.scope,
          dueDay: o.dueDay,
          recurrence: o.recurrence,
          weekendRule: o.weekendRule,
          priority: o.priority,
        })),
      })
    } else {
      form.reset({ name: "", description: "", regime: "", activity: "", obligations: [newItem()] })
    }
  }, [template, open, form])

  const [isSaving, setIsSaving] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  /** Seleção por field.id (estável) — useFieldArray rebobina índices ao remover */
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  const toggleItemSelection = (fieldId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }
  const clearItemSelection = () => setSelectedItemIds(new Set())

  /** Mapeia field.id -> index atual (recalcula a cada render porque índice muda) */
  const fieldIndexById = (id: string) => fields.findIndex((f) => f.id === id)

  const handleQuickAdd = (items: ObligationTemplate[]) => {
    for (const it of items) {
      append({
        name: it.name,
        description: it.description || "",
        kind: it.category === "tax_guide" ? "tax" : "obligation",
        scope: it.scope,
        dueDay: it.dueDay,
        recurrence: it.recurrence,
        weekendRule: it.weekendRule,
        priority: it.priority,
      })
    }
    if (items.length > 0) {
      toast.success(`${items.length} ite${items.length > 1 ? "ns adicionados" : "m adicionado"}. Não esqueça de salvar o template.`)
    }
  }

  // Bulk apply nos itens selecionados
  const applyToSelected = (
    field: "priority" | "scope" | "weekendRule" | "recurrence" | "dueDay",
    value: string | number,
  ) => {
    if (selectedItemIds.size === 0) return
    const indexes = Array.from(selectedItemIds)
      .map(fieldIndexById)
      .filter((i) => i >= 0)
    for (const idx of indexes) {
      form.setValue(`obligations.${idx}.${field}` as any, value as any, { shouldDirty: true })
    }
    toast.success(`${indexes.length} item${indexes.length > 1 ? "s atualizados" : " atualizado"}`)
  }

  const removeSelected = () => {
    if (selectedItemIds.size === 0) return
    // Remove de trás pra frente pra índices não bagunçarem
    const indexes = Array.from(selectedItemIds)
      .map(fieldIndexById)
      .filter((i) => i >= 0)
      .sort((a, b) => b - a)
    for (const idx of indexes) remove(idx)
    toast.success(`${indexes.length} item${indexes.length > 1 ? "s removidos" : " removido"}`)
    clearItemSelection()
  }

  const existingItemNames = new Set(form.watch("obligations").map((o) => o.name).filter(Boolean))

  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    const now = new Date().toISOString()
    const pkg: CustomTemplatePackage = {
      id: template?.id || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      regime: data.regime ? (data.regime as CustomTemplatePackage["regime"]) : undefined,
      activity: data.activity ? (data.activity as CustomTemplatePackage["activity"]) : undefined,
      obligations: data.obligations.map<ObligationTemplate>((o) => ({
        name: o.name,
        description: o.description || "",
        category: kindToCategory(o.kind),
        scope: o.scope,
        dueDay: Number(o.dueDay),
        frequency: frequencyFromRecurrence(o.recurrence),
        recurrence: o.recurrence,
        weekendRule: o.weekendRule,
        priority: o.priority,
      })),
      createdAt: template?.createdAt || now,
      updatedAt: now,
    }
    try {
      // Aguarda Supabase confirmar antes de fechar — assim a edição "vai pra
      // valer" e a UI não fecha em cima de uma race condition.
      await saveCustomTemplateAsync(pkg)
      toast.success(template ? "Template atualizado" : "Template criado")
      onSave()
      onOpenChange(false)
    } catch (err) {
      toast.error(`Falha ao salvar: ${err instanceof Error ? err.message : "erro desconhecido"}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[90vh] flex flex-col p-0">
        <div className="p-6 border-b">
          <DialogHeader>
            <DialogTitle>{template ? "Editar Template" : "Novo Template"}</DialogTitle>
            <DialogDescription>
              Um pacote de impostos e obrigações que você pode aplicar em várias empresas de uma vez.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <Form {...form}>
            <form id="template-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Pacote *</FormLabel>
                      <FormControl>
                        <Input autoFocus placeholder="Ex: Clínica Médica Simples Nacional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Para quais empresas este template serve?" rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="regime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regime aplicável (Opcional)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v === "any" ? "" : v)} value={field.value || "any"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Qualquer regime" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="any">Qualquer regime</SelectItem>
                            <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                            <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                            <SelectItem value="lucro_real">Lucro Real</SelectItem>
                            <SelectItem value="mei">MEI</SelectItem>
                            <SelectItem value="imune_isento">Imune / Isento</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Quando preenchido, o sistema sugere automaticamente este template ao cadastrar empresas com este regime.
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="activity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Atividade (Opcional)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v === "any" ? "" : v)} value={field.value || "any"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Qualquer atividade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="any">Qualquer atividade</SelectItem>
                            <SelectItem value="servicos">Serviços</SelectItem>
                            <SelectItem value="comercio">Comércio / Varejo</SelectItem>
                            <SelectItem value="industria">Indústria</SelectItem>
                            <SelectItem value="misto">Misto (Serviços + Comércio)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-lg font-medium">Itens do Pacote</h3>
                    <p className="text-sm text-muted-foreground">
                      Escolha se é um <strong>imposto</strong> a pagar ou uma <strong>obrigação</strong> a transmitir.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickAddOpen(true)}
                    >
                      <Sparkles className="size-4 mr-2" /> Adicionar vários
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => append(newItem())}>
                      <Plus className="size-4 mr-2" /> Adicionar item
                    </Button>
                  </div>
                </div>

                {/* Bulk toolbar — aparece quando 1+ itens selecionados */}
                {selectedItemIds.size > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 sticky top-0 z-10 backdrop-blur-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {selectedItemIds.size} selecionado{selectedItemIds.size > 1 ? "s" : ""}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearItemSelection}
                        className="h-7 text-xs"
                      >
                        <X className="size-3 mr-1" /> Limpar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Select onValueChange={(v) => applyToSelected("priority", v)}>
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue placeholder="Prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select onValueChange={(v) => applyToSelected("scope", v)}>
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue placeholder="Esfera" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="federal">Federal</SelectItem>
                          <SelectItem value="estadual">Estadual</SelectItem>
                          <SelectItem value="municipal">Municipal</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select onValueChange={(v) => applyToSelected("weekendRule", v)}>
                        <SelectTrigger className="h-8 w-[160px]">
                          <SelectValue placeholder="Fim de semana" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anticipate">Antecipa</SelectItem>
                          <SelectItem value="postpone">Posterga</SelectItem>
                          <SelectItem value="keep">Mantém</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select onValueChange={(v) => applyToSelected("recurrence", v)}>
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue placeholder="Recorrência" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="bimonthly">Bimestral</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeSelected}
                        className="h-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <TemplateItemCard
                      key={field.id}
                      index={index}
                      form={form}
                      onRemove={() => remove(index)}
                      isSelected={selectedItemIds.has(field.id)}
                      onToggleSelect={() => toggleItemSelection(field.id)}
                    />
                  ))}

                  {fields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      Nenhum item adicionado. Adicione pelo menos um para salvar o template.
                    </div>
                  )}
                  {form.formState.errors.obligations?.root && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.obligations.root.message}
                    </p>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>

        <div className="p-6 border-t bg-muted/10">
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" form="template-form" disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar Template"}
            </Button>
          </DialogFooter>
        </div>

        <QuickAddItemsDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          existingNames={existingItemNames}
          onAdd={handleQuickAdd}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── Cartão de um item do pacote ────────────────────────────────────────────

type ItemCardProps = {
  index: number
  form: ReturnType<typeof useForm<FormData>>
  onRemove: () => void
  isSelected?: boolean
  onToggleSelect?: () => void
}

function TemplateItemCard({ index, form, onRemove, isSelected, onToggleSelect }: ItemCardProps) {
  const kind = form.watch(`obligations.${index}.kind`)

  return (
    <div
      className={`p-4 border rounded-lg relative transition-colors ${
        isSelected ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "bg-muted/20"
      }`}
    >
      {/* Checkbox de seleção (top-left) — só renderiza se onToggleSelect foi passado */}
      {onToggleSelect && (
        <div className="absolute left-3 top-3.5">
          <Checkbox
            checked={!!isSelected}
            onCheckedChange={onToggleSelect}
            aria-label="Selecionar item para edição em lote"
          />
        </div>
      )}

      <div className="absolute right-2 top-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={onRemove}
          aria-label="Remover item"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className={`space-y-4 pr-8 ${onToggleSelect ? "pl-8" : ""}`}>
        {/* Tipo (Imposto vs Obrigação) como tabs */}
        <FormField
          control={form.control}
          name={`obligations.${index}.kind`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Tipo</FormLabel>
              <Tabs
                value={field.value}
                onValueChange={(v) => field.onChange(v as TemplateItemKind)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 w-full max-w-[340px]">
                  <TabsTrigger value="tax" className="gap-1.5">
                    <Receipt className="size-3.5" /> Imposto / Guia
                  </TabsTrigger>
                  <TabsTrigger value="obligation" className="gap-1.5">
                    <FileText className="size-3.5" /> Obrigação
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`obligations.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Nome *</FormLabel>
              <FormControl>
                <Input
                  placeholder={kind === "tax" ? "Ex: DAS, IRPJ, ICMS, ISS…" : "Ex: DCTF, SPED Fiscal, DEFIS…"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`obligations.${index}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Descrição (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Detalhe curto sobre o item" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`obligations.${index}.scope`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Esfera</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Federal / Estadual / Municipal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="federal">Federal</SelectItem>
                    <SelectItem value="estadual">Estadual</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`obligations.${index}.priority`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Prioridade</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name={`obligations.${index}.dueDay`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Dia do vencimento *</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={31} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`obligations.${index}.recurrence`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Recorrência</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="bimonthly">Bimestral</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`obligations.${index}.weekendRule`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Regra de vencimento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="postpone">Postergar p/ próximo útil</SelectItem>
                    <SelectItem value="anticipate">Antecipar p/ dia útil anterior</SelectItem>
                    <SelectItem value="keep">Manter na data exata</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
}
