import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Rotas acessíveis sem login: tela de login, callback de auth e o painel
 * público (só agregados anônimos). Comparação EXATA ou por prefixo COM barra —
 * "/login-falso", "/authority" ou "/publicoX" não contam como públicas.
 */
export function isPublicPath(path: string): boolean {
  if (path === "/login" || path === "/publico" || path === "/auth") return true
  return path.startsWith("/login/") || path.startsWith("/auth/") || path.startsWith("/publico/")
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === "your-supabase-url") {
    // Em produção, sem Supabase não há login: falha fechado em vez de servir
    // o app sem cadeado. Em desenvolvimento segue no modo local (localStorage).
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Serviço indisponível: configuração do Supabase ausente.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" },
      })
    }
    return supabaseResponse
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Carrega o usuário logado (se houver sessão válida)
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (e) {
    console.warn("Supabase middleware error:", e)
  }

  // Cadeado: sem login, o sistema só deixa acessar as rotas públicas
  // (tela de login e o callback de confirmação de e-mail). Qualquer outra
  // rota redireciona para /login, guardando o destino em ?redirect=.
  const path = request.nextUrl.pathname
  if (!user && !isPublicPath(path)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.search = ""
    // Guarda também a query (?clientId=...) pra voltar exatamente onde estava
    redirectUrl.searchParams.set("redirect", path + request.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
