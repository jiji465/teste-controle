"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
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
import type { Obligation, Client, Tax, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { obligationSchema, type ObligationFormData } from "@/features/obligations/schemas"

type ObligationFormProps = {
  obligation?: Obligation
  clients: Client[]
  taxes?: Tax[] // mantido para compatibilidade — não usado mais
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (obligation: Obligation) => void | Promise<void>
}

const ALL_REGIMES = Object.keys(TAX_REGIME_LABELS) as TaxRegime[]

export function ObligationForm({ obligation, clients, open, onOpenChange, onSave }: ObligationFormProps) {
  const [newTag, setNewTag] = useState("")

  const form = useForm<ObligationFormData>({
    resolver: zodResolver(obligationSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      scope: undefined,
      applicableRegimes: [],
      dueDay: 10,
      competencyMonth: "",
      frequency: "monthly",
      recurrence: "monthly",
      recurrenceInterval: 1,
      autoGenerate: false,
      weekendRule: "postpone",
      status: "pending",
      priority: "medium",
      protocol: "",
      notes: "",
      tags: [],
    },
  })

  useEffect(() => {
    if (open) {
      if (obligation) {
        form.reset({
          id: obligation.id,
          name: obligation.name,
          description: obligation.description || "",
          clientId: obligation.clientId,
          scope: obligation.scope,
          applicableRegimes: obligation.applicableRegimes || [],
          dueDay: obligation.dueDay,
          dueMonth: obligation.dueMonth,
          competencyMonth: obligation.competencyMonth || "",
          frequency: obligation.frequency || "monthly",
          recurrence: obligation.recurrence || "monthly",
          recurrenceInterval: obligation.recurrenceInterval || 1,
          recurrenceEndDate: obligation.recurrenceEndDate || "",
          autoGenerate: obligation.autoGenerate || false,
          weekendRule: obligation.weekendRule || "postpone",
          status: obligation.status,
          priority: obligation.priority,
          protocol: obligation.protocol || "",
          notes: obligation.notes || "",
          tags: obligation.tags || [],
          createdAt: obligation.createdAt,
        })
      } else {
        form.reset({
          name: "",
          description: "",
          clientId: "",
          scope: undefined,
          applicableRegimes: [],
          dueDay: 10,
          competencyMonth: "",
          frequency: "monthly",
          recurrence: "monthly",
          recurrenceInterval: 1,
          autoGenerate: false,
          weekendRule: "postpone",
          status: "pending",
          priority: "medium",
          protocol: "",
          notes: "",
          tags: [],
        })
      }
      setNewTag("")
    }
  }, [obligation, open, form])

  const [isSaving, setIsSaving] = useState(false)

  const onSubmit = async (data: ObligationFormData) => {
    const history = obligation?.history || []
    const newHistoryEntry = {
      id: crypto.randomUUID(),
      action: obligation ? ("updated" as const) : ("created" as const),
      description: obligation ? "Obrigação atualizada" : "Obrigação criada",
      timestamp: new Date().toISOString(),
    }

    const obligationData: Obligation = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      category: obligation?.category || "other",
      description: data.description || undefined,
      clientId: data.clientId,
      scope: data.scope,
      applicableRegimes: (data.applicableRegimes as TaxRegime[]) || [],
      dueDay: Number(data.dueDay),
      // dueMonth só faz sentido pra anual; ignora pra outras recorrências
      dueMonth: data.recurrence === "annual" && data.dueMonth ? Number(data.dueMonth) : undefined,
      competencyMonth: data.competencyMonth || undefined,
      frequency: data.frequency as any,
      recurrence: data.recurrence as any,
      recurrenceInterval: data.recurrenceInterval,
      recurrenceEndDate: data.recurrenceEndDate || undefined,
      autoGenerate: data.autoGenerate,
      weekendRule: data.weekendRule as any,
      status: data.status as any,
      priority: data.priority as any,
      protocol: data.protocol || undefined,
      notes: data.notes || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
      completedAt: obligation?.completedAt,
      completedBy: obligation?.completedBy,
      attachments: obligation?.attachments || [],
      history: [...history, newHistoryEntry],
      parentObligationId: obligation?.parentObligationId,
      generatedFor: obligation?.generatedFor,
      tags: data.tags || [],
    }

    setIsSaving(true)
    try {
      await onSave(obligationData)
      onOpenChange(false)
    } catch (err) {
      // Erro já é tratado com toast pelo caller; mantemos dialog aberto
      // pra usuário corrigir e tentar de novo.
      console.error("[obligation-form] save failed:", err)
    } finally {
      setIsSaving(false)
    }
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
    form.setValue("tags", currentTags.filter((t) => t !== tagToRemove), { shouldValidate: true })
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
  const isEditing = !!obligation

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obligation ? "Editar Obrigação Acessória" : "Nova Obrigação Acessória"}</DialogTitle>
          <DialogDescription>
            Cadastre uma obrigação acessória (declaração ou escrituração ao Fisco — DCTF, EFD, SPED, ECD, ECF, etc.).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
            {/* 1. Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Informações Básicas
              </h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Obrigação *</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder="Ex: DCTF, EFD-ICMS, SPED Fiscal, ECD, DIRF" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva a obrigação..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 2. Regimes Tributários */}
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
                Selecione os regimes para os quais esta obrigação se aplica. Deixe todos desmarcados para aplicar a todos.
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

            {/* 3. Recorrência */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h3 className="text-sm font-semibold">Recorrência</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
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
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                      <FormLabel>Gerar até (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* 4. Vencimento */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vencimento</h3>

              <div className="grid sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="competencyMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês de Competência</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do Vencimento *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={31} placeholder="1-31" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Mês fixo — só pra anual */}
                {form.watch("recurrence") === "annual" && (
                  <FormField
                    control={form.control}
                    name="dueMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Mês de vencimento{" "}
                          <span className="text-xs text-muted-foreground font-normal">(opcional, ano seguinte)</span>
                        </FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "auto" ? undefined : Number(v))}
                          value={field.value ? String(field.value) : "auto"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto">Mês seguinte à competência (padrão)</SelectItem>
                            <SelectItem value="1">Janeiro</SelectItem>
                            <SelectItem value="2">Fevereiro</SelectItem>
                            <SelectItem value="3">Março</SelectItem>
                            <SelectItem value="4">Abril</SelectItem>
                            <SelectItem value="5">Maio</SelectItem>
                            <SelectItem value="6">Junho</SelectItem>
                            <SelectItem value="7">Julho</SelectItem>
                            <SelectItem value="8">Agosto</SelectItem>
                            <SelectItem value="9">Setembro</SelectItem>
                            <SelectItem value="10">Outubro</SelectItem>
                            <SelectItem value="11">Novembro</SelectItem>
                            <SelectItem value="12">Dezembro</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="weekendRule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final de Semana *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="postpone">Postergar</SelectItem>
                          <SelectItem value="anticipate">Antecipar</SelectItem>
                          <SelectItem value="keep">Manter</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 5. Gestão */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gestão</h3>

              <div className={`grid gap-4 ${isEditing ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Prioridade {getPriorityIcon(field.value)}
                      </FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEditing && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="in_progress">Em Andamento</SelectItem>
                            <SelectItem value="completed">Transmitida</SelectItem>
                            <SelectItem value="overdue">Atrasada</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocolo de Transmissão</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do protocolo de envio" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 6. Observações e Tags */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Observações e Tags
              </h3>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações adicionais..." rows={3} {...field} />
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
                  <Button type="button" variant="outline" onClick={addTag}>Adicionar</Button>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Salvando…" : "Salvar Obrigação"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
