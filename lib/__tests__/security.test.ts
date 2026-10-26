import { describe, expect, it } from "vitest"
import { buildCsp, securityHeaders, supabaseOrigins } from "../security-headers.mjs"
import { isPublicPath } from "../supabase/middleware"
import { config as proxyConfig } from "../../proxy"

describe("cabeçalhos de segurança", () => {
  it("CSP libera só o Supabase do projeto (https + wss)", () => {
    const csp = buildCsp({ supabaseUrl: "https://abcxyz.supabase.co" })
    const connect = csp.split("; ").find((d) => d.startsWith("connect-src"))!
    expect(connect).toContain("https://abcxyz.supabase.co")
    expect(connect).toContain("wss://abcxyz.supabase.co")
    expect(connect).not.toContain("*.supabase.co")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("worker-src 'self' blob:")
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).not.toContain("unpkg.com")
  })

  it("sem URL (ou URL não-https) não inclui origem do Supabase", () => {
    expect(supabaseOrigins(undefined)).toBeNull()
    expect(supabaseOrigins("http://localhost:54321")).toBeNull()
    expect(buildCsp({})).not.toContain("supabase")
  })

  it("dev libera eval/HMR; produção não", () => {
    expect(buildCsp({ isDev: true })).toContain("'unsafe-eval'")
    expect(buildCsp({ isDev: false })).not.toContain("'unsafe-eval'")
    expect(buildCsp({ isDev: false })).not.toContain("ws:")
  })

  it("demais cabeçalhos", () => {
    const h = Object.fromEntries(securityHeaders({}).map((x) => [x.key, x.value]))
    expect(h["X-Frame-Options"]).toBe("DENY")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(h["Permissions-Policy"]).toContain("camera=()")
  })
})

describe("rotas públicas do proxy", () => {
  it("igualdade ou prefixo com barra", () => {
    for (const p of ["/login", "/login/", "/auth/callback", "/publico", "/publico/x"]) expect(isPublicPath(p), p).toBe(true)
    for (const p of ["/", "/loginx", "/login-falso", "/authority", "/autho", "/publicox", "/clientes"]) {
      expect(isPublicPath(p), p).toBe(false)
    }
  })

  it("matcher só ignora arquivos com extensão de verdade (ponto literal)", () => {
    const src = proxyConfig.matcher[0]
    // Mesma regex que o Next monta a partir do matcher
    const re = new RegExp(`^${src}$`)
    expect(re.test("/clientesvg")).toBe(true) // passa pelo proxy (antes escapava)
    expect(re.test("/obrigacoes/xpng")).toBe(true)
    expect(re.test("/logo.svg")).toBe(false) // arquivo estático: fora do proxy
    expect(re.test("/_next/static/chunk.js")).toBe(false)
  })
})
