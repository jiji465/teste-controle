"use client"

/**
 * AuthContext — expõe o usuário Supabase logado (ou null) e o papel dele em
 * toda a árvore.
 *
 * O acesso aos dados é decidido pelo BANCO (RLS, scripts/023) a partir do
 * app_metadata.role do token: viewer lê Dashboard/Empresas, editor/admin
 * leem e gravam tudo, conta sem papel (ou login anônimo) não lê nada. O front
 * só espelha isso para esconder telas/ações e mostrar mensagens amigáveis.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { canWrite as roleCanWrite, hasAppAccess, parseRole, type UserRole } from "@/lib/roles"

type AuthContextValue = {
  user: User | null
  /** Papel do usuário (app_metadata.role). null = sem papel → sem acesso. */
  role: UserRole | null
  /** Nome para autoria (nome do perfil ou e-mail) */
  userName: string
  /** true quando o papel é "viewer" (somente leitura). */
  isViewer: boolean
  /** true para editor/admin (pode gravar). */
  canWrite: boolean
  /** Logado, mas sem papel (ou login anônimo): o banco não libera nada. */
  isPendingAccess: boolean
  isLoading: boolean
  /** Faz logout e força reload pra limpar contextos com dados antigos. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Papel gravado no access token (é o que o banco enxerga). */
function roleInToken(accessToken: string | undefined): UserRole | null {
  if (!accessToken) return null
  try {
    const payload = accessToken.split(".")[1]
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return parseRole(json?.app_metadata?.role)
  } catch {
    return null
  }
}

function roleOf(user: User | null): UserRole | null {
  if (!user || user.is_anonymous) return null
  return parseRole((user.app_metadata as Record<string, unknown> | undefined)?.role)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Carga inicial: pega o usuário atual no servidor de Auth (fonte da verdade).
    let mounted = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const fresh: User | null = data?.user ?? null
        if (fresh) {
          // O papel pode ter mudado depois do login (ex.: script 023 ou um
          // admin definiu o papel). O banco lê o papel do TOKEN — se o token
          // ainda tem o papel antigo, renova a sessão uma vez.
          const { data: s } = await supabase.auth.getSession()
          if (roleOf(fresh) !== roleInToken(s?.session?.access_token)) {
            await supabase.auth.refreshSession().catch(() => undefined)
          }
        }
        if (mounted) setUser(fresh)
      } catch {
        // Supabase não configurado: o cliente stub devolve erro — trata como anônimo.
        if (mounted) setUser(null)
      } finally {
        if (mounted) setIsLoading(false)
      }
    })()

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

  // Papel vem do app_metadata (definido só no servidor — o usuário não altera).
  const role = roleOf(user)
  const isViewer = role === "viewer"
  const canWrite = roleCanWrite(role)
  const isPendingAccess = !!user && !hasAppAccess(role)
  // Nome exibido em "concluído por": nome do perfil ou e-mail. (O histórico do
  // banco usa sempre o e-mail do token — este nome é só informativo.)
  const userName = ((user?.user_metadata as Record<string, unknown> | undefined)?.name as string | undefined) ?? user?.email ?? "Usuário"

  return (
    <AuthContext.Provider value={{ user, role, isViewer, canWrite, isPendingAccess, userName, isLoading, signOut }}>
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
