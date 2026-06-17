import { createBrowserClient } from "@supabase/ssr"

/**
 * Cliente "stub" usado quando o Supabase não está configurado (ex.: rodando
 * local sem .env). NÃO quebra a aplicação: qualquer acesso a método é
 * encadeável e qualquer chamada resolve como "anônimo / sem dados".
 *
 * Substitui o proxy antigo, que lançava em `supabase.auth.getUser()` porque
 * `supabase.auth` virava uma função sem `.getUser`. O AuthProvider trata o
 * resultado como anônimo e o app segue normalmente.
 */
function createStubClient(): any {
  const result = {
    data: { user: null, session: null, subscription: { unsubscribe() {} } },
    error: new Error("Supabase não configurado"),
  }
  const stub: any = new Proxy(function () {}, {
    // Acessar qualquer propriedade devolve o próprio stub (encadeável:
    // supabase.auth.getUser, supabase.from('x').select, etc.). `then` é
    // exceção: devolvemos undefined pra o stub não ser tratado como thenable.
    get: (_target, prop) => (prop === "then" ? undefined : stub),
    // Chamar qualquer método resolve numa Promise com shape neutro.
    apply: () => Promise.resolve(result),
  })
  return stub
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === "your-supabase-url") {
    if (typeof console !== "undefined") {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes — usando cliente stub (modo anônimo, sem dados).",
      )
    }
    return createStubClient()
  }

  return createBrowserClient(url, key)
}
