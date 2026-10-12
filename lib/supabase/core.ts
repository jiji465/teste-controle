import * as local from "../storage"
import { createBrowserClient } from "@supabase/ssr"

export function hasSupabaseConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "your-supabase-url" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://")
  )
}

// Singleton — cria o client uma única vez, reutiliza em todas as chamadas
let _supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase não configurado")
  }
  if (!_supabaseClient) {
    _supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabaseClient
}

/**
 * Converte o erro do Supabase/Postgres num Error com mensagem que faça
 * sentido pro usuário (as telas mostram `error.message` no toast).
 */
export function toDbError(error: { message?: string; code?: string; details?: string } | null | undefined): Error {
  const msg = error?.message ?? "Erro desconhecido no banco de dados"
  if (/Competência .* está fechada/i.test(msg)) return new Error(msg)
  if (error?.code === "23505") {
    if (/cnpj/i.test(msg + (error.details ?? ""))) return new Error("Já existe uma empresa cadastrada com este CNPJ.")
    return new Error("Já existe um item igual para esta competência.")
  }
  // Controle otimista de versão (apuracao_mensal, migration 022): alguém salvou antes
  if (error?.code === "40001") {
    return new Error(/alterada por outra pessoa/i.test(msg) ? msg : "Este registro foi alterado por outra pessoa. Recarregue antes de salvar.")
  }
  if (error?.code === "42501" || /row-level security/i.test(msg)) {
    return new Error("Sem permissão para esta ação (perfil somente leitura ou sessão expirada).")
  }
  return new Error(msg)
}

const PAGE_SIZE = 1000

/**
 * Lê TODAS as linhas de uma tabela, paginando com .range(). O PostgREST do
 * Supabase devolve no máximo 1000 linhas por requisição — sem isso a carga
 * era cortada em silêncio. A ordem `id` no fim garante páginas estáveis.
 * Lança o erro em vez de cair no localStorage: dado velho/vazio mostrado
 * como se fosse real é pior do que um aviso de falha.
 */
export async function fetchAll<T = any>(table: string, orderBy: string): Promise<T[]> {
  const supabase = getSupabaseClient()
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`[db] Error fetching ${table}:`, error)
      throw new Error(`Falha ao carregar ${table}: ${error.message}`)
    }
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

export { local }
