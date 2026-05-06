"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { AlertCircle, Flame, TrendingUp, Zap, CalendarDays } from "lucide-react"
import { installmentSchema, type InstallmentFormData } from "@/features/installments/schemas"
import { adjustForWeekend, buildSafeDate, formatDate, toLocalDateString } from "@/lib/date-utils"

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

  // ─── Cálculo da prévia "vencimento da parcela atual" ───────────────────
  // Mostra em tempo real onde a parcela atual vai cair, baseado nos campos
  // que o usuário acabou de digitar. Resolve um bug de cadastro frequente:
  // o usuário botava a data de "hoje" como Primeiro vencimento e dizia que
  // estava na parcela 6 — resultado: parcela 6 caía 5 meses no futuro.
  // Agora ele vê "Parcela 6/24 vai vencer em DD/MM/YYYY" e pega o erro
  // antes de salvar.
  const watchFirstDueDate = form.watch("firstDueDate")
  const watchCurrentInstallment = form.watch("currentInstallment")
  const watchInstallmentCount = form.watch("installmentCount")
  const watchWeekendRule = form.watch("weekendRule")

  const currentDuePreview = useMemo(() => {
    if (!watchFirstDueDate) return null
    const m = watchFirstDueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const year = Number(m[1])
    const monthIdx = Number(m[2]) - 1
    const day = Number(m[3])
    const current = Number(watchCurrentInstallment) || 1
    const total = Number(watchInstallmentCount) || 1
    if (current < 1 || current > total) return null
    const monthsToAdd = current - 1
    const raw = buildSafeDate(year, monthIdx + monthsToAdd, day)
    const adjusted = adjustForWeekend(raw, (watchWeekendRule as WeekendRule) || "postpone")
    return {
      current,
      total,
      date: adjusted,
      isFirst: current === 1,
    }
  }, [watchFirstDueDate, watchCurrentInstallment, watchInstallmentCount, watchWeekendRule])

  // Atalho: preencher o "Primeiro vencimento" a partir da data da parcela atual.
  // Se o usuário sabe quando a parcela 6 vence, mas não lembra quando foi a 1,
  // ele clica nesse botão e a gente calcula firstDueDate = nextDue - (current-1) meses.
  const fillFirstDueFromCurrent = (currentDueIso: string) => {
    const m = currentDueIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return
    const year = Number(m[1])
    const monthIdx = Number(m[2]) - 1
    const day = Number(m[3])
    const current = Number(form.getValues("currentInstallment")) || 1
    if (current < 1) return
    const firstDate = buildSafeDate(year, monthIdx - (current - 1), day)
    const iso = toLocalDateString(firstDate)
    form.setValue("firstDueDate", iso, { shouldDirty: true, shouldValidate: true })
  }

  const [quickCurrentDate, setQuickCurrentDate] = useState("")

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
                      <FormLabel>Vencimento da parcela 1 *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            // Auto-sincroniza o "Dia do vencimento" com o dia
                            // do primeiro vencimento. Evita o usuário deixar
                            // os dois campos com dias diferentes (ex: dia 29
                            // vs dia 31), o que gerava divergência no card
                            // de detalhes. Usuário ainda pode sobrescrever
                            // manualmente depois se quiser.
                            const value = e.target.value
                            const m = value.match(/^\d{4}-\d{2}-(\d{2})$/)
                            if (m) {
                              const day = Number(m[1])
                              if (day >= 1 && day <= 31) {
                                form.setValue("dueDay", day, { shouldDirty: true })
                              }
                            }
                          }}
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">
                        Data da PARCELA 1, mesmo se você já está pagando a parcela 6 ou outra.
                        Use o atalho abaixo se não souber a data da 1.
                      </p>
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
                      <p className="text-[11px] text-muted-foreground">
                        Sincroniza automaticamente com o dia do 1º vencimento.
                        Mude só se as parcelas seguintes vencem em dia diferente.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Atalho + prévia: caça-erro do cadastro de parcelamento já em
                  andamento. Usuário típico não lembra quando foi a parcela 1 —
                  mas sabe quando vence a próxima. Aqui ele bota a data da
                  parcela atual e o sistema preenche o "Vencimento da parcela 1"
                  retroagindo (current - 1) meses. */}
              {(Number(watchCurrentInstallment) || 1) > 1 && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Atalho: já está na parcela {watchCurrentInstallment} e não sabe a data da 1?
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-[11px] text-muted-foreground block mb-1">
                        Vencimento da parcela {watchCurrentInstallment}
                      </label>
                      <Input
                        type="date"
                        value={quickCurrentDate}
                        onChange={(e) => setQuickCurrentDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!quickCurrentDate}
                      onClick={() => {
                        if (quickCurrentDate) fillFirstDueFromCurrent(quickCurrentDate)
                      }}
                    >
                      Calcular parcela 1
                    </Button>
                  </div>
                </div>
              )}

              {/* Prévia: confirma onde a parcela atual cai, do jeito que está
                  configurado agora. Se o usuário digitou errado, ele vê na hora. */}
              {currentDuePreview && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    currentDuePreview.isFirst
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <p className="font-medium flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    Parcela {currentDuePreview.current}/{currentDuePreview.total} vai vencer em{" "}
                    <span className="tabular-nums">{formatDate(currentDuePreview.date)}</span>
                  </p>
                  {!currentDuePreview.isFirst && (
                    <p className="text-[11px] mt-1 opacity-90">
                      Se a data acima não bate com a realidade, ajuste a data da parcela 1
                      ou use o atalho azul para calcular automaticamente.
                    </p>
                  )}
                </div>
              )}

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

              {/* Toggle "Gerar próxima parcela automaticamente" foi removido:
                  o avanço já acontece automaticamente quando o usuário clica
                  "Pagar parcela X/N". Não há nada pra ligar/desligar. */}
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
