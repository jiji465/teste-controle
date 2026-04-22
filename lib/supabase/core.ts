import * as local from "../storage"

export function hasSupabaseConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "your-supabase-url" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://")
  )
}

export async function getSupabaseClient() {
  const { createClient } = await import("./client")
  return createClient()
}

export { local }
