import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

// Next 16: "middleware" passou a se chamar "proxy" (mesmo comportamento).
// Renova a sessão do Supabase e manda quem não está logado pro /login.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|otf|woff2?)$).*)"],
}
