import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

// Next 16: "middleware" passou a se chamar "proxy" (mesmo comportamento).
// Renova a sessão do Supabase e manda quem não está logado pro /login.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Barra dupla no TS = "\." na regex (ponto literal). Com uma barra só, o
  // ponto virava curinga e qualquer rota terminada em "svg", "png"… (ex.:
  // /clientesvg) escapava do proxy — sem sessão nem redirecionamento ao /login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|otf|woff2?)$).*)"],
}
