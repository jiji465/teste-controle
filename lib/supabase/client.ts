import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === "your-supabase-url") {
    // Retorna um objeto proxy que não quebra a aplicação mas avisa no console
    return new Proxy({} as any, {
      get: () => {
        return () => ({ data: { user: null }, error: new Error("Supabase não configurado") })
      }
    })
  }

  return createBrowserClient(url, key)
}
