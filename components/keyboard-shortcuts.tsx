"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Keyboard } from "lucide-react"

type ShortcutCategory = {
  title: string
  shortcuts: { keys: string[]; description: string }[]
}

const shortcuts: ShortcutCategory[] = [
  {
    title: "Navegação",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Busca global rápida" },
      { keys: ["/"], description: "Focar na busca" },
      { keys: ["Esc"], description: "Fechar modal/diálogo" },
      { keys: ["?"], description: "Mostrar atalhos" },
    ],
  },
  {
    title: "Ações Rápidas",
    shortcuts: [
      { keys: ["N"], description: "Nova obrigação" },
      { keys: ["C"], description: "Novo cliente" },
      { keys: ["T"], description: "Novo imposto" },
      { keys: ["E"], description: "Exportar dados" },
    ],
  },
  {
    title: "Visualização",
    shortcuts: [
      { keys: ["V"], description: "Alternar modo compacto" },
      { keys: ["F"], description: "Abrir filtros" },
      { keys: ["S"], description: "Salvar filtro atual" },
    ],
  },
]

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts dialog
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault()
          setOpen(true)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform z-50"
        title="Atalhos de teclado (pressione ?)"
      >
        <Keyboard className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Atalhos de Teclado</DialogTitle>
            <DialogDescription>Navegue mais rápido usando atalhos de teclado</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {shortcuts.map((category) => (
              <div key={category.title} className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {category.title}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key) => (
                          <Badge key={key} variant="outline" className="font-mono">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
