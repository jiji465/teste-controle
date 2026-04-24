"use client"

import { useState, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Pencil, Sparkles, Layers, RotateCcw, Copy, Database, Eraser } from "lucide-react"
import { getCustomTemplates, deleteCustomTemplate, seedDefaultTemplates, resetDefaultTemplates, cloneCustomTemplate, type CustomTemplatePackage } from "@/lib/obligation-templates"
import { seedDemoData, clearAllData } from "@/lib/seed-demo"
import { toast } from "sonner"
import { TemplatePackageForm } from "@/features/templates/components/template-package-form"

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CustomTemplatePackage[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplatePackage | undefined>()
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const loadTemplates = () => {
    setTemplates(getCustomTemplates())
  }

  useEffect(() => {
    seedDefaultTemplates()
    loadTemplates()

    // Sync remoto: migra do localStorage uma vez + puxa última versão do Supabase
    void (async () => {
      const { migrateLocalTemplatesToSupabase, getCustomTemplatesAsync } = await import("@/features/templates/services")
      const result = await migrateLocalTemplatesToSupabase()
      if (result.migrated > 0) {
        toast.success(`${result.migrated} template${result.migrated > 1 ? "s" : ""} sincronizado${result.migrated > 1 ? "s" : ""} com a nuvem`)
      }
      // Re-carrega depois do pull para refletir mudanças feitas em outro dispositivo
      await getCustomTemplatesAsync()
      loadTemplates()
    })()
  }, [])

  const handleOpenForm = (template?: CustomTemplatePackage) => {
    setEditingTemplate(template)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setConfirmState({
      title: "Excluir template",
      description: "Tem certeza que deseja excluir este pacote de templates?",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: () => {
        deleteCustomTemplate(id)
        loadTemplates()
      },
    })
  }

  const handleClone = (id: string) => {
    const cloned = cloneCustomTemplate(id)
    if (cloned) {
      loadTemplates()
      toast.success(`Template clonado como "${cloned.name}"`)
    }
  }

  const handleSeedDemo = () => {
    setConfirmState({
      title: "Carregar dados de exemplo",
      description: "Adiciona 30 empresas + impostos + ~150 obrigações + ~18 parcelamentos para testar com volume. Seus dados existentes NÃO serão apagados.",
      confirmLabel: "Carregar",
      onConfirm: () => {
        const res = seedDemoData()
        toast.success(
          `Carregados: ${res.clients} empresas, ${res.taxes} impostos, ${res.obligations} obrigações, ${res.installments} parcelamentos. Recarregando…`,
        )
        setTimeout(() => window.location.reload(), 1500)
      },
    })
  }

  const handleClearAll = () => {
    setConfirmState({
      title: "Apagar TODOS os dados",
      description: "Apaga todas as empresas, impostos, obrigações e parcelamentos do sistema. Os templates NÃO são apagados. Esta ação não pode ser desfeita.",
      confirmLabel: "Apagar tudo",
      destructive: true,
      onConfirm: () => {
        clearAllData()
        toast.success("Todos os dados apagados. Recarregando…")
        setTimeout(() => window.location.reload(), 1200)
      },
    })
  }

  const handleRestoreDefaults = () => {
    setConfirmState({
      title: "Restaurar templates padrão",
      description: "Apaga os templates que começam com 'Padrão · ' e recria as versões atualizadas. Seus templates personalizados não serão afetados.",
      confirmLabel: "Restaurar",
      onConfirm: () => {
        resetDefaultTemplates()
        loadTemplates()
        toast.success("Templates padrão restaurados")
      },
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRestoreDefaults} className="gap-2">
                <RotateCcw className="size-4" />
                Restaurar padrões
              </Button>
              <Button onClick={() => handleOpenForm()} className="gap-2">
                <Plus className="size-4" />
                Novo Template
              </Button>
            </div>
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
                    <Button
                      variant="outline"
                      title="Duplicar template"
                      onClick={() => handleClone(pkg.id)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      title="Excluir template"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(pkg.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Ferramentas de teste */}
          <div className="mt-10 border-t pt-6">
            <div className="space-y-1 mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ferramentas de teste
              </h2>
              <p className="text-xs text-muted-foreground">
                Use para simular o sistema com volume de dados ou zerar tudo. Só afeta o armazenamento local.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleSeedDemo} className="gap-2">
                <Database className="size-4" />
                Carregar 30 empresas de exemplo
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Eraser className="size-4" />
                Apagar todos os dados
              </Button>
            </div>
          </div>
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
