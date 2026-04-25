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

export { local }
