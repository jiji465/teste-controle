"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { saveCustomTemplate, type CustomTemplatePackage, type ObligationTemplate } from "@/lib/obligation-templates"

const obligationSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  description: z.string().optional(),
  category: z.enum(["sped", "tax_guide", "certificate", "declaration", "other"]),
  dueDay: z.coerce.number().min(1).max(31),
  frequency: z.enum(["monthly", "quarterly", "annual", "custom"]),
  recurrence: z.enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"]),
  weekendRule: z.enum(["postpone", "anticipate", "keep"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
})

const templatePackageSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  description: z.string().optional(),
  obligations: z.array(obligationSchema).min(1, "Adicione pelo menos uma obrigação"),
})

type FormData = z.infer<typeof templatePackageSchema>

type Props = {
  template?: CustomTemplatePackage
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function TemplatePackageForm({ template, open, onOpenChange, onSave }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(templatePackageSchema),
    defaultValues: {
      name: "",
      description: "",
      obligations: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "obligations",
  })

  useEffect(() => {
    if (open) {
      if (template) {
        form.reset({
          name: template.name,
          description: template.description || "",
          obligations: template.obligations.map(o => ({
            ...o,
            description: o.description || "",
          })),
        })
      } else {
        form.reset({
          name: "",
          description: "",
          obligations: [
            { name: "", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" }
          ],
        })
      }
    }
  }, [template, open, form])

  const onSubmit = (data: FormData) => {
    const pkg: CustomTemplatePackage = {
      id: template?.id || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      obligations: data.obligations as ObligationTemplate[],
      createdAt: template?.createdAt || new Date().toISOString(),
    }
    saveCustomTemplate(pkg)
    onSave()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
        <div className="p-6 border-b">
          <DialogHeader>
            <DialogTitle>{template ? "Editar Template" : "Novo Template"}</DialogTitle>
            <DialogDescription>
              Crie um pacote de obrigações personalizadas para aplicar facilmente nas empresas.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
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
                        <Input placeholder="Ex: Template Clínica Médica, Posto de Gasolina..." {...field} />
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
                        <Textarea placeholder="Para quais empresas este template serve?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Obrigações do Pacote</h3>
                    <p className="text-sm text-muted-foreground">Estas obrigações serão criadas automaticamente.</p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ name: "", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" })}
                  >
                    <Plus className="size-4 mr-2" /> Adicionar Obrigação
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg bg-muted/20 relative group">
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => remove(index)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      
                      <div className="grid sm:grid-cols-12 gap-4">
                        <div className="sm:col-span-12">
                          <FormField
                            control={form.control}
                            name={`obligations.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Nome da Obrigação *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: PIS, COFINS, SPED..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <FormField
                            control={form.control}
                            name={`obligations.${index}.category`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Categoria</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="tax_guide">Guia de Imposto</SelectItem>
                                    <SelectItem value="declaration">Declaração</SelectItem>
                                    <SelectItem value="sped">SPED / Escrituração</SelectItem>
                                    <SelectItem value="certificate">Certidão</SelectItem>
                                    <SelectItem value="other">Outros</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <FormField
                            control={form.control}
                            name={`obligations.${index}.dueDay`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Dia do Venc. (1-31)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" max="31" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <FormField
                            control={form.control}
                            name={`obligations.${index}.frequency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Frequência</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="monthly">Mensal</SelectItem>
                                    <SelectItem value="quarterly">Trimestral</SelectItem>
                                    <SelectItem value="annual">Anual</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {fields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      Nenhuma obrigação adicionada. Adicione pelo menos uma para salvar o template.
                    </div>
                  )}
                  {form.formState.errors.obligations?.root && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.obligations.root.message}</p>
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
