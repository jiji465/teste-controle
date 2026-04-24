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
import { Plus, Trash2, Receipt, FileText } from "lucide-react"
import { saveCustomTemplate, type CustomTemplatePackage, type ObligationTemplate } from "@/lib/obligation-templates"

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
      form.reset({ name: "", description: "", obligations: [newItem()] })
    }
  }, [template, open, form])

  const onSubmit = (data: FormData) => {
    const pkg: CustomTemplatePackage = {
      id: template?.id || crypto.randomUUID(),
      name: data.name,
      description: data.description,
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
      createdAt: template?.createdAt || new Date().toISOString(),
    }
    saveCustomTemplate(pkg)
    onSave()
    onOpenChange(false)
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
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Itens do Pacote</h3>
                    <p className="text-sm text-muted-foreground">
                      Escolha se é um <strong>imposto</strong> a pagar ou uma <strong>obrigação</strong> a transmitir.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => append(newItem())}>
                    <Plus className="size-4 mr-2" /> Adicionar item
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <TemplateItemCard
                      key={field.id}
                      index={index}
                      form={form}
                      onRemove={() => remove(index)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="template-form">
              Salvar Template
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cartão de um item do pacote ────────────────────────────────────────────

type ItemCardProps = {
  index: number
  form: ReturnType<typeof useForm<FormData>>
  onRemove: () => void
}

function TemplateItemCard({ index, form, onRemove }: ItemCardProps) {
  const kind = form.watch(`obligations.${index}.kind`)

  return (
    <div className="p-4 border rounded-lg bg-muted/20 relative">
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

      <div className="space-y-4 pr-8">
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
