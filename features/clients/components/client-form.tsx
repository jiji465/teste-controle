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
import { type BusinessActivity, BUSINESS_ACTIVITY_LABELS, type TemplateItem } from "@/lib/obligation-templates"
import { useData } from "@/contexts/data-context"
import { applyTemplateToClient, summarizeApplyResult, type CompetencyRange } from "@/lib/template-applier"
import { lookupCNPJ, CNPJLookupError } from "@/lib/cnpj-service"
import { inferBusinessActivityFromCNAE } from "@/lib/cnae-mapping"
import { Search, Loader2 } from "lucide-react"
import { toast } from "sonner"

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
  onSave: (client: Client) => void | Promise<void>
  onObligationsCreated?: () => void
}

export function ClientForm({ client, open, onOpenChange, onSave, onObligationsCreated }: ClientFormProps) {
  const { taxes } = useData()
  const [pendingClient, setPendingClient] = useState<Client | null>(null)
  const [pendingActivity, setPendingActivity] = useState<BusinessActivity | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      tradeName: "",
      cnpj: "",
      email: "",
      phone: "",
      status: "active",
      ie: "",
      im: "",
      city: "",
      state: "",
      notes: "",
      businessActivity: undefined,
      cnaeCode: "",
      cnaeDescription: "",
    },
  })

  // Reset form when client prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (client) {
        form.reset({
          id: client.id,
          name: client.name,
          tradeName: client.tradeName || "",
          cnpj: client.cnpj,
          email: client.email || "",
          phone: client.phone || "",
          status: client.status,
          taxRegime: client.taxRegime,
          businessActivity: client.businessActivity,
          cnaeCode: client.cnaeCode || "",
          cnaeDescription: client.cnaeDescription || "",
          ie: client.ie || "",
          im: client.im || "",
          city: client.city || "",
          state: client.state || "",
          notes: client.notes || "",
          createdAt: client.createdAt,
        })
      } else {
        form.reset({
          name: "",
          tradeName: "",
          cnpj: "",
          email: "",
          phone: "",
          status: "active",
          taxRegime: undefined,
          businessActivity: undefined,
          cnaeCode: "",
          cnaeDescription: "",
          ie: "",
          im: "",
          city: "",
          state: "",
          notes: "",
        })
      }
    }
  }, [client, open, form])

  const onSubmit = async (data: ClientFormData) => {
    const clientData: Client = {
      id: data.id || crypto.randomUUID(),
      name: data.name,
      tradeName: data.tradeName || undefined,
      cnpj: data.cnpj,
      email: data.email || "",
      phone: data.phone || "",
      status: data.status,
      taxRegime: data.taxRegime as TaxRegime | undefined,
      businessActivity: data.businessActivity,
      cnaeCode: data.cnaeCode || undefined,
      cnaeDescription: data.cnaeDescription || undefined,
      ie: data.ie || undefined,
      im: data.im || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      notes: data.notes || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
    }
    try {
      await onSave(clientData)
    } catch {
      // Erro tratado no caller (toast). Mantém o form aberto.
      return
    }
    const isNew = !data.id
    if (isNew && data.taxRegime && data.businessActivity) {
      setPendingClient(clientData)
      setPendingActivity(data.businessActivity as BusinessActivity)
      setTemplateOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  const handleTemplateConfirm = async (templates: TemplateItem[], range: CompetencyRange) => {
    if (!pendingClient) return
    const result = await applyTemplateToClient(pendingClient, templates, range)
    const summary = summarizeApplyResult(result)
    if (summary) toast.success(summary)
    if (result.totalSkipped > 0) {
      toast.info(`${result.totalSkipped} já existia${result.totalSkipped > 1 ? "m" : ""} e foi ignorad${result.totalSkipped > 1 ? "as" : "a"}`)
    }
    onObligationsCreated?.()
    setPendingClient(null)
    setPendingActivity(null)
    onOpenChange(false)
  }

  return (
    <>
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
                    <FormLabel>Razão Social *</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder="Empresa Ltda." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tradeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Fantasia</FormLabel>
                    <FormControl>
                      <Input placeholder="Como a empresa é conhecida" {...field} />
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
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="00.000.000/0000-00" 
                          {...field} 
                          onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="icon"
                        className="shrink-0"
                        disabled={isSearching || field.value.replace(/\D/g, '').length !== 14}
                        onClick={async () => {
                          setIsSearching(true)
                          try {
                            const data = await lookupCNPJ(field.value)
                            if (!data) {
                              toast.error("CNPJ não encontrado na base da Receita.")
                              return
                            }
                            if (data.nome) form.setValue("name", data.nome)
                            if (data.fantasia && !form.getValues("tradeName")) form.setValue("tradeName", data.fantasia)
                            if (data.email && !form.getValues("email")) form.setValue("email", data.email)
                            if (data.telefone && !form.getValues("phone")) form.setValue("phone", data.telefone)
                            if (data.cnaeCode) form.setValue("cnaeCode", data.cnaeCode)
                            if (data.cnaeDescription) form.setValue("cnaeDescription", data.cnaeDescription)
                            if (data.municipio && !form.getValues("city")) form.setValue("city", data.municipio)
                            if (data.uf && !form.getValues("state")) form.setValue("state", data.uf)
                            if (!form.getValues("businessActivity")) {
                              const inferred = inferBusinessActivityFromCNAE(data.cnaeCode)
                              if (inferred) form.setValue("businessActivity", inferred)
                            }
                            const suffix = data.situacao && data.situacao !== "ATIVA"
                              ? ` (situação: ${data.situacao.toLowerCase()})`
                              : ""
                            toast.success(`Dados importados${suffix}`)
                          } catch (error) {
                            if (error instanceof CNPJLookupError) {
                              toast.error(error.message)
                            } else {
                              toast.error("Erro ao buscar CNPJ.")
                            }
                          } finally {
                            setIsSearching(false)
                          }
                        }}
                      >
                        {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      </Button>
                    </div>
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

              {form.watch("cnaeCode") && (
                <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-mono font-semibold text-muted-foreground">CNAE</span>
                  <div className="flex-1">
                    <span className="font-mono">{form.watch("cnaeCode")}</span>
                    {form.watch("cnaeDescription") && (
                      <span className="text-muted-foreground"> · {form.watch("cnaeDescription")}</span>
                    )}
                  </div>
                </div>
              )}

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

              <div className="grid sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Município</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input maxLength={2} placeholder="SP" className="uppercase" {...field} />
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
        taxes={taxes}
        onConfirm={handleTemplateConfirm}
      />
    )}
  </>
  )
}
