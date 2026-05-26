"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Service, Client, RecurrenceType } from "@/lib/types"
import { SERVICE_CATEGORY_LABELS } from "@/lib/types"
import { serviceSchema, type ServiceFormData } from "@/features/services/schemas"
import { saveService } from "@/features/services/services"

type Props = {
  service?: Service
  clients: Client[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function ServiceForm({ service, clients, open, onOpenChange, onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      clientId: "",
      description: "",
      category: "other",
      dueDate: "",
      status: "pending",
      priority: "medium",
      autoGenerate: false,
      notes: "",
      tags: [],
    },
  })

  useEffect(() => {
    if (!open) return
    if (service) {
      form.reset({
        id: service.id,
        name: service.name,
        clientId: service.clientId,
        description: service.description ?? "",
        category: service.category,
        dueDate: service.dueDate,
        status: service.status,
        priority: service.priority,
        recurrence: service.recurrence,
        recurrenceInterval: service.recurrenceInterval,
        recurrenceEndDate: service.recurrenceEndDate ?? "",
        autoGenerate: service.autoGenerate ?? false,
        notes: service.notes ?? "",
        tags: service.tags ?? [],
        completedAt: service.completedAt ?? undefined,
        completedBy: service.completedBy ?? undefined,
        createdAt: service.createdAt ?? undefined,
      })
    } else {
      form.reset({
        name: "",
        clientId: "",
        description: "",
        category: "other",
        dueDate: "",
        status: "pending",
        priority: "medium",
        autoGenerate: false,
        notes: "",
        tags: [],
      })
    }
  }, [service, open, form])

  const onSubmit = async (data: ServiceFormData) => {
    setIsSaving(true)
    try {
      const payload: Service = {
        id: data.id || crypto.randomUUID(),
        name: data.name,
        clientId: data.clientId,
        description: data.description || undefined,
        category: data.category,
        dueDate: data.dueDate,
        status: data.status,
        priority: data.priority,
        recurrence: data.recurrence,
        recurrenceInterval: data.recurrenceInterval,
        recurrenceEndDate: data.recurrenceEndDate || undefined,
        autoGenerate: data.autoGenerate,
        notes: data.notes || undefined,
        tags: data.tags || [],
        completedAt: data.completedAt ?? undefined,
        completedBy: data.completedBy ?? undefined,
        createdAt: data.createdAt || new Date().toISOString(),
      }
      await saveService(payload)
      toast.success(service ? "Serviço atualizado" : "Serviço criado")
      onSave()
      onOpenChange(false)
    } catch (err) {
      console.error("[service-form] save failed:", err)
      toast.error("Erro ao salvar serviço")
    } finally {
      setIsSaving(false)
    }
  }

  const recurrence = form.watch("recurrence")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          <DialogDescription>
            Serviço avulso prestado a um cliente — NF-e, consultoria ou outros.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              const fields = Object.keys(errors)
              const firstMsg = (Object.values(errors)[0] as any)?.message
              toast.error(
                `Não foi possível salvar — verifique: ${fields.join(", ")}` +
                  (firstMsg ? ` (${firstMsg})` : ""),
              )
              console.warn("[service-form] validation errors:", errors)
            })}
            className="grid gap-4 py-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do serviço *</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Ex: Emissão NF-e Maio" {...field} />
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
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SERVICE_CATEGORY_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Detalhes sobre o serviço" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recorrência (opcional) */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Recorrência (opcional)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repete?</FormLabel>
                      <Select
                        onValueChange={(v) =>
                          field.onChange(v === "none" ? undefined : (v as RecurrenceType))
                        }
                        value={field.value ?? "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Não repete (avulso)</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="bimonthly">Bimestral</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {recurrence && (
                  <FormField
                    control={form.control}
                    name="recurrenceEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repetir até (opcional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Anotações livres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  "Salvar serviço"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
