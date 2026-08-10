/**
 * Papéis de usuário (via Supabase app_metadata.role — só o servidor define,
 * o usuário não consegue alterar). O papel "viewer" é somente-leitura: o RLS
 * do banco bloqueia qualquer escrita, e o front esconde ações e rotas.
 *
 * Sem papel definido = usuário pleno (editor), pra não travar as contas atuais.
 */

export type UserRole = "viewer" | "editor" | "admin" | null

/** Hrefs de navegação que um visualizador pode ver/abrir: Indicadores + Empresas. */
export const VIEWER_ALLOWED_HREFS = ["/", "/clientes"] as const

/** Um visualizador pode abrir esta rota? (Dashboard e Empresas, incluindo subrotas de /clientes.) */
export function isRouteAllowedForViewer(path: string | null | undefined): boolean {
  if (!path) return true
  if (path === "/") return true
  return path === "/clientes" || path.startsWith("/clientes/")
}
