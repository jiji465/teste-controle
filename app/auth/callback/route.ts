import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Callback após o usuário clicar no link de confirmação enviado por e-mail.
 * O Supabase manda pra /auth/callback?code=...&redirect=... — trocamos o
 * code por uma sessão válida e redirecionamos pra `redirect` (default "/").
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const redirectTo = url.searchParams.get("redirect") || "/"

  if (code) {
    try {
      const supabase = await createClient()
      await supabase.auth.exchangeCodeForSession(code)
    } catch (e) {
      console.warn("[auth/callback] exchangeCodeForSession falhou:", e)
    }
  }

  // Redirect absoluto pra mesma origem
  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
