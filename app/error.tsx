"use client"

/**
 * Erro de rota: aparece DENTRO da shell (sidebar e topo continuam), então o
 * usuário pode tentar de novo ou ir para outra tela sem recarregar tudo.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Não foi possível abrir esta tela</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || "Ocorreu um erro inesperado."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset} className="gap-2">
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
        <Button asChild>
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
