/**
 * Garante que um destino de redirecionamento vindo da URL (?redirect=...)
 * aponte para dentro do próprio sistema — evita open redirect após o login.
 *
 * O destino é RESOLVIDO com `new URL` contra uma origem fixa e só é aceito se
 * continuar na mesma origem e o caminho normalizado não começar com "//"
 * (ex.: "/.//site.com" vira "//site.com" depois de normalizado). Bloqueia
 * também URLs absolutas, protocol-relative ("//site.com"), barra invertida
 * ("/\site.com") e caracteres de controle.
 */
const BASE = "http://destino-interno.invalid"

export function safeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target) return fallback
  if (!target.startsWith("/") || target.startsWith("//")) return fallback
  // barra invertida vira "/" no parser de URL dos navegadores; controle = truque de header
  if (/[\\\u0000-\u001f\u007f]/.test(target)) return fallback

  let url: URL
  try {
    url = new URL(target, BASE)
  } catch {
    return fallback
  }
  if (url.origin !== BASE) return fallback
  if (url.pathname.startsWith("//")) return fallback

  return url.pathname + url.search + url.hash
}
