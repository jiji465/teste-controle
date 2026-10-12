/**
 * Garante que um destino de redirecionamento vindo da URL (?redirect=...)
 * aponte para dentro do próprio sistema. Bloqueia URLs absolutas
 * ("https://site.com"), protocol-relative ("//site.com") e variações com
 * barra invertida ("/\site.com") — evita open redirect após o login.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target) return fallback
  if (!target.startsWith("/")) return fallback
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback
  if (/[\r\n\t]/.test(target)) return fallback
  return target
}
