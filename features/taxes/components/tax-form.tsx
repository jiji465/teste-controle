"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { X, AlertCircle, AlertTriangle, Flag } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { Tax, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { taxSchema, type TaxFormData } from "@/features/taxes/schemas"

type TaxFormProps = {
  tax?: Tax
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (tax: Tax) => void
}

const ALL_REGIMES = Object.keys(TAX_REGIME_LABELS) as TaxRegime[]

export function TaxForm({ tax, open, onOpenChange, onSave }: TaxFormProps) {
  const [newTag, setNewTag] = useState("")

  const form = useForm<TaxFormData>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      name: "",
      scope: undefined,
      description: "",
      federalTaxCode: "",
      dueDay: undefined,
      status: "pending",
      priority: "medium",
      recurrence: "monthly",
      recurrenceInterval: 1,
      autoGenerate: false,
      weekendRule: "postpone",
      assignedTo: "",
      protocol: "",
      notes: "",
      tags: [],
      applicableRegimes: [],
    },
  })

  useEffect(() => {
    if (open) {
      if (tax) {
        form.reset({
          id: tax.id,
          name: tax.name,
          scope: tax.scope,
          description: tax.description || "",
          federalTaxCode: tax.federalTaxCode || "",
          dueDay: tax.dueDay,
          status: tax.status,
          priority: tax.priority,
          recurrence: tax.recurrence || "monthly",
          recurrenceInterval: tax.recurrenceInterval || 1,
          recurrenceEndDate: tax.recurrenceEndDate || "",
          autoGenerate: tax.autoGenerate || false,
          weekendRule: tax.weekendRule || "postpone",
          assignedTo: tax.assignedTo || "",
          protocol: tax.protocol || "",
          notes: tax.notes || "",
          tags: tax.tags || [],
          applicableRegimes: tax.applicableRegimes || [],
          completedAt: tax.completedAt,
          completedBy: tax.completedBy,
          createdAt: tax.createdAt,
        })
      } else {
        form.reset({
          name: "",
          scope: undefined,
          description: "",
          federalTaxCode: "",
          dueDay: undefined,
          status: "pending",
          priority: "medium",
          recurrence: "monthly",
          recurrenceInterval: 1,
          autoGenerate: false,
          weekendRule: "postpone",
          assignedTo: "",
          protocol: "",
          notes: "",
          tags: [],
          applicableRegimes: [],
        })
      }
      setNewTag("")
    }
  }, [tax, open, form])

  const onSubmit = (data: TaxFormData) => {
    const taxData: Tax = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      scope: data.scope,
      description: data.description || undefined,
      federalTaxCode: data.federalTaxCode || undefined,
      dueDay: data.dueDay && data.dueDay > 0 ? Number(data.dueDay) : undefined,
      status: data.status,
      priority: data.priority,
      recurrence: data.recurrence,
      recurrenceInterval: data.recurrenceInterval,
      recurrenceEndDate: data.recurrenceEndDate || undefined,
      autoGenerate: data.autoGenerate,
      weekendRule: data.weekendRule,
      assignedTo: data.assignedTo || undefined,
      protocol: data.protocol || undefined,
      notes: data.notes || undefined,
      tags: data.tags,
      applicableRegimes: data.applicableRegimes as TaxRegime[],
      completedAt: data.completedAt,
      completedBy: data.completedBy,
      createdAt: data.createdAt || new Date().toISOString(),
    }
    onSave(taxData)
    onOpenChange(false)
  }

  const addTag = () => {
    const currentTags = form.getValues("tags") || []
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      form.setValue("tags", [...currentTags, newTag.trim()], { shouldValidate: true })
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags") || []
    form.setValue(
      "tags",
      currentTags.filter((t) => t !== tagToRemove),
      { shouldValidate: true }
    )
  }

  const toggleRegime = (regime: TaxRegime) => {
    const current = form.getValues("applicableRegimes") || []
    const updated = current.includes(regime) 
      ? current.filter((r) => r !== regime) 
      : [...current, regime]
    form.setValue("applicableRegimes", updated as TaxRegime[], { shouldValidate: true })
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="size-4 text-red-600" />
      case "high":
        return <AlertTriangle className="size-4 text-orange-600" />
      case "medium":
        return <Flag className="size-4 text-yellow-600" />
      default:
        return <Flag className="size-4 text-blue-600" />
    }
  }

  const selectedRegimes = form.watch("applicableRegimes") || []
  const appliesToAll = selectedRegimes.length === 0
  const isCustomRecurrence = form.watch("recurrence") === "custom"
  const isAutoGenerate = form.watch("autoGenerate")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tax ? "Editar Imposto" : "Novo Imposto"}</DialogTitle>
          <DialogDescription>Configure o imposto com todas as regras, regimes e vencimentos.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Informações Básicas
              </h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Imposto / Obrigação *</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder="Ex: ICMS, ISS, IRPJ, DCTF, EFD-REINF" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Esfera</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a esfera" />
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
                  name="federalTaxCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código DARF / GPS / GARE</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva o imposto..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Regimes Tributários Aplicáveis */}
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Regimes Tributários Aplicáveis</h3>
                {appliesToAll ? (
                  <Badge variant="secondary" className="text-xs">Todos os regimes</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">{selectedRegimes.length} selecionado(s)</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione os regimes para os quais este imposto se aplica. Deixe todos desmarcados para aplicar a todos os clientes.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ALL_REGIMES.map((regime) => (
                  <label
                    key={regime}
                    className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedRegimes.includes(regime)}
                      onCheckedChange={() => toggleRegime(regime)}
                    />
                    <span className="text-sm">{TAX_REGIME_LABELS[regime]}</span>
                  </label>
                ))}
              </div>
              {selectedRegimes.length > 0 && (
               <div className="flex flex-wrap gap-1 pt-1">
                  {selectedRegimes.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAX_REGIME_COLORS[r as TaxRegime]}`}
                    >
                      {TAX_REGIME_LABELS[r as TaxRegime]}
                      <button type="button" onClick={() => toggleRegime(r as TaxRegime)} className="ml-0.5 hover:opacity-70">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Gestão e Controle */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gestão e Controle</h3>

              <div className="grid sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Prioridade * {getPriorityIcon(field.value)}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                          <SelectItem value="overdue">Atrasado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do responsável" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocolo/Processo</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do protocolo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Configuração de Recorrência */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h3 className="text-sm font-semibold">Configuração de Recorrência</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Recorrência *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isCustomRecurrence && (
                  <FormField
                    control={form.control}
                    name="recurrenceInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intervalo (meses)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="autoGenerate"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Gerar Automaticamente</FormLabel>
                      <DialogDescription>
                        Criar próximas ocorrências automaticamente
                      </DialogDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isAutoGenerate && (
                <FormField
                  control={form.control}
                  name="recurrenceEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Final (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <DialogDescription>
                        Deixe em branco para recorrência indefinida
                      </DialogDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Vencimentos */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vencimentos</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dueDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do Vencimento</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={31} placeholder="Ex: 15" {...field} />
                      </FormControl>
                      <DialogDescription>
                        Dia padrão de vencimento (pode ser sobrescrito)
                      </DialogDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weekendRule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regra de Final de Semana *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="postpone">Postergar (próximo útil)</SelectItem>
                          <SelectItem value="anticipate">Antecipar (útil anterior)</SelectItem>
                          <SelectItem value="keep">Manter</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Informações Adicionais
              </h3>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações adicionais, comentários internos..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="Adicionar tag..."
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Adicionar
                  </Button>
                </div>
                {form.watch("tags")?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.watch("tags").map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Imposto</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
