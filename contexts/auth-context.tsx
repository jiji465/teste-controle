"use client"

/**
 * AuthContext — expõe o usuário Supabase logado (ou null) em toda a árvore.
 *
 * Fase 1 (opcional): não há enforcement — qualquer rota acessa o app, mesmo
 * sem login. O contexto só serve pra UI mostrar quem está logado e habilitar
 * logout. Quando ligarmos RLS no Supabase (fase 2), as escritas só passam
 * com session válida — mas o front continua o mesmo.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  /** Faz logout e força reload pra limpar contextos com dados antigos. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Carga inicial: pega sessão atual (se cookie válido existir).
    let mounted = true
    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        if (!mounted) return
        setUser(data.user ?? null)
        setIsLoading(false)
      })
      .catch(() => {
        // Se Supabase não estiver configurado, o cliente é um Proxy que
        // retorna erro — tratamos como "anônimo" e seguimos.
        if (mounted) {
          setUser(null)
          setIsLoading(false)
        }
      })

    // Escuta mudanças de sessão (login, logout, refresh do token).
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: { user: User | null } | null) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    // Reload força DataProvider a refazer fetch (sem dados de sessão antiga).
    if (typeof window !== "undefined") window.location.reload()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth deve ser chamado dentro de <AuthProvider>")
  }
  return ctx
}
