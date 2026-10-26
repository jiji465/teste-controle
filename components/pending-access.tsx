"use client"

/**
 * Tela para quem está logado mas ainda não tem papel (app_metadata.role) —
 * ou entrou como anônimo. O banco não libera nenhum dado para essa conta
 * (scripts/023); em vez de telas vazias, explica o que fazer.
 */

import { LogOut, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"

export function PendingAccess() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/10 text-amber-600">
            <ShieldAlert className="size-6" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">Acesso aguardando liberação</h1>
            <p className="text-sm text-muted-foreground">
              {user?.email ? (
                <>
                  A conta <span className="font-medium text-foreground">{user.email}</span> entrou, mas ainda não
                  tem um perfil de acesso no escritório.
                </>
              ) : (
                <>Esta sessão não tem um perfil de acesso no escritório.</>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Peça ao administrador para liberar seu acesso (editor ou somente leitura). Depois disso, saia e entre de
              novo.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
