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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { getClients, getTaxes, saveInstallment } from "@/lib/supabase/database"
import type { Installment, Client, Tax, WeekendRule, Priority, RecurrenceType } from "@/lib/types"
import { AlertCircle, Flame, TrendingUp, Zap } from "lucide-react"
import { installmentSchema, type InstallmentFormData } from "@/features/installments/schemas"

interface InstallmentFormProps {
  installment?: Installment
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function InstallmentForm({ installment, open, onOpenChange, onSave }: InstallmentFormProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])

  const form = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      taxId: "none",
      installmentCount: 1,
      currentInstallment: 1,
      dueDay: 10,
      firstDueDate: "",
      weekendRule: "postpone",
      status: "pending",
      priority: "medium",
      assignedTo: "",
      protocol: "",
      notes: "",
      tags: [],
      paymentMethod: "",
      referenceNumber: "",
      autoGenerate: true,
      recurrence: "monthly",
      recurrenceInterval: 1,
      totalAmount: undefined,
      installmentAmount: undefined,
    },
  })

  useEffect(() => {
    const loadOptions = async () => {
      const [cls, txs] = await Promise.all([getClients(), getTaxes()])
      setClients(cls)
      setTaxes(txs)
    }
    loadOptions()
  }, [])

  useEffect(() => {
    if (open) {
      if (installment) {
        form.reset({
          id: installment.id,
          name: installment.name,
          description: installment.description || "",
          clientId: installment.clientId,
          taxId: installment.taxId || "none",
          installmentCount: installment.installmentCount,
          currentInstallment: installment.currentInstallment,
          dueDay: installment.dueDay,
          firstDueDate: installment.firstDueDate,
          weekendRule: installment.weekendRule,
          status: installment.status,
          priority: installment.priority,
          assignedTo: installment.assignedTo || "",
          protocol: installment.protocol || "",
          notes: installment.notes || "",
          tags: installment.tags || [],
          paymentMethod: installment.paymentMethod || "",
          referenceNumber: installment.referenceNumber || "",
          autoGenerate: installment.autoGenerate,
          recurrence: installment.recurrence || "monthly",
          recurrenceInterval: installment.recurrenceInterval || 1,
          totalAmount: installment.totalAmount,
          installmentAmount: installment.installmentAmount,
          realizationDate: installment.realizationDate || "",
          createdAt: installment.createdAt,
        })
      } else {
        form.reset({
          name: "",
          description: "",
          clientId: "",
          taxId: "none",
          installmentCount: 1,
          currentInstallment: 1,
          dueDay: 10,
          firstDueDate: "",
          weekendRule: "postpone",
          status: "pending",
          priority: "medium",
          assignedTo: "",
          protocol: "",
          notes: "",
          tags: [],
          paymentMethod: "",
          referenceNumber: "",
          autoGenerate: true,
          recurrence: "monthly",
          recurrenceInterval: 1,
          totalAmount: undefined,
          installmentAmount: undefined,
        })
      }
    }
  }, [installment, open, form])

  // Auto-calculate installment amount whenever totalAmount or count changes
  const handleTotalAmountChange = (total: number | undefined, count: number | undefined) => {
    if (total && count && count > 0) {
      const perInstallment = Number((total / count).toFixed(2))
      form.setValue("totalAmount", total, { shouldValidate: true })
      form.setValue("installmentAmount", perInstallment, { shouldValidate: true })
    } else {
      form.setValue("totalAmount", total, { shouldValidate: true })
    }
  }

  const onSubmit = async (data: InstallmentFormData) => {
    const installmentData: Installment = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      description: data.description || undefined,
      clientId: data.clientId,
      taxId: data.taxId === "none" || !data.taxId ? undefined : data.taxId,
      installmentCount: data.installmentCount,
      currentInstallment: data.currentInstallment,
      dueDay: data.dueDay,
      firstDueDate: data.firstDueDate,
      weekendRule: data.weekendRule as WeekendRule,
      status: data.status as any,
      priority: data.priority as Priority,
      assignedTo: data.assignedTo || undefined,
      protocol: data.protocol || undefined,
      realizationDate: data.realizationDate || undefined,
      totalAmount: data.totalAmount ? Number(data.totalAmount) : undefined,
      installmentAmount: data.installmentAmount ? Number(data.installmentAmount) : undefined,
      notes: data.notes || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
      completedAt: installment?.completedAt,
      completedBy: installment?.completedBy,
      history: installment?.history || [],
      tags: data.tags || [],
      paymentMethod: data.paymentMethod || undefined,
      referenceNumber: data.referenceNumber || undefined,
      autoGenerate: data.autoGenerate,
      recurrence: data.recurrence as RecurrenceType,
      recurrenceInterval: data.recurrenceInterval,
    }

    await saveInstallment(installmentData)
    onSave()
    onOpenChange(false)
  }

  const priorityIcons = {
    low: <TrendingUp className="h-4 w-4" />,
    medium: <AlertCircle className="h-4 w-4" />,
    high: <Flame className="h-4 w-4" />,
    urgent: <Zap className="h-4 w-4" />,
  }

  const isCustomRecurrence = form.watch("recurrence") === "custom"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{installment ? "Editar Parcelamento" : "Novo Parcelamento"}</DialogTitle>
          <DialogDescription>Gerencie parcelamentos de impostos e obrigações fiscais</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Informações Básicas</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Parcelamento *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imposto Relacionado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o imposto (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {taxes.map((tax) => (
                          <SelectItem key={tax.id} value={tax.id}>
                            {tax.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valores do Parcelamento */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Valores</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0,00"
                          value={field.value || ""}
                          onChange={(e) =>
                            handleTotalAmountChange(
                              e.target.value ? Number(e.target.value) : undefined,
                              form.getValues("installmentCount")
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="installmentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor da Parcela (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Calculado automaticamente"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <DialogDescription className="text-xs">
                        Calculado automaticamente ao preencher valor total e n° de parcelas
                      </DialogDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Controle de Parcelas */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Controle de Parcelas</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="installmentCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade de Parcelas *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => {
                            const count = Number.parseInt(e.target.value)
                            field.onChange(count)
                            handleTotalAmountChange(form.getValues("totalAmount"), count)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentInstallment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcela Atual *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={form.getValues("installmentCount")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Boleto, Débito Automático" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Recorrência Automática */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Recorrência Automática</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="autoGenerate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gerar Automaticamente</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "yes")}
                        defaultValue={field.value ? "yes" : "no"}
                        value={field.value ? "yes" : "no"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="yes">Sim</SelectItem>
                          <SelectItem value="no">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
            </div>

            {/* Vencimentos */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Vencimentos</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="firstDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primeiro Vencimento *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>Dia de Vencimento *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={31} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weekendRule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regra de Final de Semana/Feriado *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="postpone">Postergar (próximo dia útil)</SelectItem>
                          <SelectItem value="anticipate">Antecipar (dia útil anterior)</SelectItem>
                          <SelectItem value="keep">Manter (mesmo dia)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Gestão e Controle */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Gestão e Controle</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2">
                              {priorityIcons.low}
                              <span>Baixa</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2">
                              {priorityIcons.medium}
                              <span>Média</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2">
                              {priorityIcons.high}
                              <span>Alta</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="urgent">
                            <div className="flex items-center gap-2">
                              {priorityIcons.urgent}
                              <span>Urgente</span>
                            </div>
                          </SelectItem>
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

                <FormField
                  control={form.control}
                  name="protocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocolo/Número</FormLabel>
                      <FormControl>
                        <Input placeholder="Número do protocolo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="referenceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Referência</FormLabel>
                    <FormControl>
                      <Input placeholder="Código de barras, linha digitável, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Informações Adicionais */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Informações Adicionais</h3>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Observações adicionais sobre o parcelamento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Parcelamento</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
