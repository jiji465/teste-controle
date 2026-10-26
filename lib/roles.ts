/**
 * Papéis de usuário (via Supabase app_metadata.role — só o servidor define,
 * o usuário não consegue alterar). Espelha o banco (scripts/023):
 *
 *  - "viewer" → somente leitura: Indicadores (Dashboard) + Empresas.
 *  - "editor" / "admin" → equipe do escritório: lê e grava tudo.
 *  - sem papel (ou login anônimo) → SEM acesso. O banco não devolve nada e
 *    o app mostra a tela "aguardando liberação".
 */

export type UserRole = "viewer" | "editor" | "admin"

export const KNOWN_ROLES: readonly UserRole[] = ["viewer", "editor", "admin"] as const

/** Normaliza o app_metadata.role; qualquer valor desconhecido = sem papel. */
export function parseRole(value: unknown): UserRole | null {
  return typeof value === "string" && (KNOWN_ROLES as readonly string[]).includes(value) ? (value as UserRole) : null
}

/** Pode abrir o sistema (ler o Dashboard/Empresas)? */
export function hasAppAccess(role: UserRole | null): boolean {
  return role !== null
}

/** Pode gravar (editor/admin)? */
export function canWrite(role: UserRole | null): boolean {
  return role === "editor" || role === "admin"
}

/** Hrefs de navegação que um visualizador pode ver/abrir: Indicadores + Empresas. */
export const VIEWER_ALLOWED_HREFS = ["/", "/clientes"] as const

/** Um visualizador pode abrir esta rota? (Dashboard e Empresas, incluindo subrotas de /clientes.) */
export function isRouteAllowedForViewer(path: string | null | undefined): boolean {
  if (!path) return true
  if (path === "/") return true
  return path === "/clientes" || path.startsWith("/clientes/")
}
