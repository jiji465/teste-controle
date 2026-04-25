"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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

const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="space-y-1">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
)

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
      autoGenerate: true,
      recurrence: "monthly",
      recurrenceInterval: 1,
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
    if (!open) return
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
        autoGenerate: installment.autoGenerate,
        recurrence: installment.recurrence || "monthly",
        recurrenceInterval: installment.recurrenceInterval || 1,
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
        autoGenerate: true,
        recurrence: "monthly",
        recurrenceInterval: 1,
      })
    }
  }, [installment, open, form])

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
      notes: data.notes || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
      completedAt: installment?.completedAt,
      completedBy: installment?.completedBy,
      history: installment?.history || [],
      tags: data.tags || [],
      autoGenerate: data.autoGenerate,
      recurrence: data.recurrence as RecurrenceType,
      recurrenceInterval: data.recurrenceInterval,
    }

    await saveInstallment(installmentData)
    onSave()
    onOpenChange(false)
  }

  const isCustomRecurrence = form.watch("recurrence") === "custom"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col p-0 gap-0">
        <div className="px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle>{installment ? "Editar Parcelamento" : "Novo Parcelamento"}</DialogTitle>
            <DialogDescription>Controle de parcelas de impostos e obrigações fiscais</DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form
            id="installment-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-8"
          >
            {/* 1. Dados básicos */}
            <section className="space-y-4">
              <SectionHeader title="Dados básicos" />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do parcelamento *</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder="Ex: PERT INSS 2025 — Empresa X" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
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
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imposto vinculado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {taxes.map((tax) => (
                            <SelectItem key={tax.id} value={tax.id}>{tax.name}</SelectItem>
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
                      <Textarea rows={2} placeholder="Detalhe curto sobre o parcelamento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 2. Parcelas e valores */}
            <section className="space-y-4">
              <SectionHeader
                title="Parcelas e valores"
                description="Informe o total e a quantidade — o valor por parcela é calculado automaticamente."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="installmentCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qtd. de parcelas *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
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
                      <FormLabel>Parcela atual *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={form.getValues("installmentCount")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* 3. Datas e vencimento */}
            <section className="space-y-4">
              <SectionHeader title="Datas e vencimento" />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primeiro vencimento *</FormLabel>
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
                      <FormLabel>Dia do vencimento *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={31} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recorrência *</FormLabel>
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

                <FormField
                  control={form.control}
                  name="weekendRule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Se cair em fim de semana / feriado *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="postpone">Postergar p/ próximo útil</SelectItem>
                          <SelectItem value="anticipate">Antecipar p/ útil anterior</SelectItem>
                          <SelectItem value="keep">Manter na data</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isCustomRecurrence && (
                <FormField
                  control={form.control}
                  name="recurrenceInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo personalizado (meses)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="autoGenerate"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Gerar próxima parcela automaticamente</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Quando a parcela atual for concluída, o sistema cria a seguinte.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>

            {/* 4. Gestão */}
            <section className="space-y-4">
              <SectionHeader title="Gestão e responsável" />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2"><TrendingUp className="size-4" /> Baixa</div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2"><AlertCircle className="size-4" /> Média</div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2"><Flame className="size-4" /> Alta</div>
                          </SelectItem>
                          <SelectItem value="urgent">
                            <div className="flex items-center gap-2"><Zap className="size-4" /> Urgente</div>
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
                        <Input placeholder="Nome de quem cuida desse parcelamento" {...field} />
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
                    <FormLabel>Protocolo / nº do processo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 12345.000123/2025-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 5. Observações */}
            <section className="space-y-4">
              <SectionHeader title="Observações" />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea rows={3} placeholder="Anotações livres sobre o parcelamento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </form>
        </Form>

        <div className="px-6 py-4 border-t bg-muted/10">
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="installment-form">
              Salvar parcelamento
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
