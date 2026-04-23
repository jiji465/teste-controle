"use client"

import { useState, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Pencil, Sparkles, Layers } from "lucide-react"
import { getCustomTemplates, deleteCustomTemplate, type CustomTemplatePackage } from "@/lib/obligation-templates"
import { TemplatePackageForm } from "@/features/templates/components/template-package-form"

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CustomTemplatePackage[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplatePackage | undefined>()

  const loadTemplates = () => {
    setTemplates(getCustomTemplates())
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleOpenForm = (template?: CustomTemplatePackage) => {
    setEditingTemplate(template)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este pacote de templates?")) {
      deleteCustomTemplate(id)
      loadTemplates()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-balance flex items-center gap-3">
                <Sparkles className="size-8 text-primary" />
                Meus Templates
              </h1>
              <p className="text-lg text-muted-foreground">
                Crie pacotes personalizados de obrigações para aplicar em lote nas suas empresas
              </p>
            </div>
            <Button onClick={() => handleOpenForm()} className="gap-2">
              <Plus className="size-4" />
              Novo Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Layers className="size-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhum template personalizado</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Crie pacotes de obrigações para aplicar rapidamente a empresas com perfis específicos (ex: Clínicas Médicas, Escolas, etc).
              </p>
              <Button onClick={() => handleOpenForm()}>Criar Primeiro Template</Button>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map(pkg => (
                <Card key={pkg.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    {pkg.description && (
                      <CardDescription className="line-clamp-2">{pkg.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary">{pkg.obligations.length} obrigações</Badge>
                    </div>
                    <ul className="text-sm space-y-2 text-muted-foreground line-clamp-4">
                      {pkg.obligations.slice(0, 4).map((o, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="size-1.5 rounded-full bg-primary/50" />
                          {o.name}
                        </li>
                      ))}
                      {pkg.obligations.length > 4 && (
                        <li className="text-xs italic">... e mais {pkg.obligations.length - 4}</li>
                      )}
                    </ul>
                  </CardContent>
                  <CardFooter className="border-t pt-4 gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => handleOpenForm(pkg)}>
                      <Pencil className="size-4" /> Editar
                    </Button>
                    <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(pkg.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <TemplatePackageForm 
        template={editingTemplate}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={loadTemplates}
      />
    </div>
  )
}
