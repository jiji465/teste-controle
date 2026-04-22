"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import type { Client, TaxRegime } from "@/lib/types"
import { TAX_REGIME_LABELS } from "@/lib/types"
import { clientSchema, type ClientFormData } from "@/features/clients/schemas"
import { TemplateApplyDialog } from "@/components/template-apply-dialog"
import { type BusinessActivity, BUSINESS_ACTIVITY_LABELS, getTemplateForClient, type ObligationTemplate } from "@/lib/obligation-templates"
import { saveObligation } from "@/features/obligations/services"

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18)
}

type ClientFormProps = {
  client?: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (client: Client) => void
  onObligationsCreated?: () => void
}

export function ClientForm({ client, open, onOpenChange, onSave, onObligationsCreated }: ClientFormProps) {
  const [pendingClient, setPendingClient] = useState<Client | null>(null)
  const [pendingActivity, setPendingActivity] = useState<BusinessActivity | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      status: "active",
      ie: "",
      im: "",
      notes: "",
      businessActivity: undefined,
    },
  })

  // Reset form when client prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (client) {
        form.reset({
          id: client.id,
          name: client.name,
          cnpj: client.cnpj,
          email: client.email || "",
          phone: client.phone || "",
          status: client.status,
          taxRegime: client.taxRegime,
          ie: client.ie || "",
          im: client.im || "",
          notes: client.notes || "",
          createdAt: client.createdAt,
        })
      } else {
        form.reset({
          name: "",
          cnpj: "",
          email: "",
          phone: "",
          status: "active",
          taxRegime: undefined,
          businessActivity: undefined,
          ie: "",
          im: "",
          notes: "",
        })
      }
    }
  }, [client, open, form])

  const onSubmit = (data: ClientFormData) => {
    const clientData: Client = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      cnpj: data.cnpj,
      email: data.email || "",
      phone: data.phone || "",
      status: data.status,
      taxRegime: data.taxRegime as TaxRegime | undefined,
      businessActivity: data.businessActivity,
      ie: data.ie || undefined,
      im: data.im || undefined,
      notes: data.notes || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
    }
    onSave(clientData)
    // For new clients with regime + activity, offer template
    const isNew = !data.id
    if (isNew && data.taxRegime && data.businessActivity) {
      setPendingClient(clientData)
      setPendingActivity(data.businessActivity as BusinessActivity)
      setTemplateOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  const handleTemplateConfirm = async (templates: ObligationTemplate[]) => {
    if (!pendingClient) return
    const now = new Date().toISOString()
    await Promise.all(
      templates.map(t =>
        saveObligation({
          id: crypto.randomUUID(),
          name: t.name,
          description: t.description,
          category: t.category,
          clientId: pendingClient.id,
          dueDay: t.dueDay,
          frequency: t.frequency,
          recurrence: t.recurrence,
          weekendRule: t.weekendRule,
          status: "pending",
          priority: t.priority,
          autoGenerate: true,
          createdAt: now,
          history: [],
          tags: [],
          attachments: [],
        })
      )
    )
    onObligationsCreated?.()
    setPendingClient(null)
    setPendingActivity(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          <DialogDescription>Preencha os dados da empresa para gerenciar suas obrigações fiscais.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Dados Básicos */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Cadastrais</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Razão Social *</FormLabel>
                    <FormControl>
                      <Input placeholder="Empresa Ltda." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="00.000.000/0000-00" 
                        {...field} 
                        onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contato@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Regime Tributário + Atividade */}
            <div className="space-y-3 border-t pt-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regime Tributário</h3>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="taxRegime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regime Tributário *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o regime" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessActivity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Atividade Principal</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a atividade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.entries(BUSINESS_ACTIVITY_LABELS) as [BusinessActivity, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="ie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Estadual (IE)</FormLabel>
                      <FormControl>
                        <Input placeholder="000.000.000.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="im"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Municipal (IM)</FormLabel>
                      <FormControl>
                        <Input placeholder="00000000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Status e Observações */}
            <div className="space-y-3 border-t pt-3">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais sobre a empresa..."
                        rows={2}
                        {...field}
                      />
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
              <Button type="submit">Salvar empresa</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {pendingClient && pendingActivity && (
      <TemplateApplyDialog
        open={templateOpen}
        onOpenChange={(v) => { setTemplateOpen(v); if (!v) onOpenChange(false) }}
        clientName={pendingClient.name}
        regime={pendingClient.taxRegime!}
        activity={pendingActivity}
        templates={getTemplateForClient(pendingClient.taxRegime!, pendingActivity)}
        onConfirm={handleTemplateConfirm}
      />
    )}
  </>
  )
}
