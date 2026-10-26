// Cabeçalhos de segurança HTTP (usados pelo next.config.mjs).
// Arquivo .mjs puro para poder ser importado pela config do Next e testado.
//
// Decisões (CSP):
//  - script-src com 'unsafe-inline': o App Router injeta scripts inline de
//    hidratação; a alternativa (nonce) obrigaria todas as páginas a serem
//    dinâmicas. Os demais vetores ficam fechados: object-src 'none',
//    base-uri 'self', form-action 'self', frame-ancestors 'none'.
//  - 'unsafe-eval' só em desenvolvimento (React Refresh / stack traces).
//  - Supabase: origem https e wss do projeto, lidas de NEXT_PUBLIC_SUPABASE_URL
//    (a variável precisa existir no BUILD — no Vercel ela existe).
//  - pdf.js: o worker é servido pelo próprio app (/_next/static) → worker-src 'self' blob:.
//  - next/font: fontes auto-hospedadas em /_next/static → font-src 'self'.
//  - Clima do cabeçalho (lib/weather.ts): open-meteo, bigdatacloud e ipapi.
//  - Vercel: barra de comentários/preview (vercel.live) só funciona com essas origens.

const VERCEL_LIVE = "https://vercel.live"

/** Origem https e wss do Supabase a partir da URL do projeto (ou null). */
export function supabaseOrigins(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return null
    return { https: u.origin, wss: `wss://${u.host}` }
  } catch {
    return null
  }
}

/**
 * Monta a Content-Security-Policy.
 * @param {{ supabaseUrl?: string, isDev?: boolean }} opts
 */
export function buildCsp({ supabaseUrl, isDev = false } = {}) {
  const sb = supabaseOrigins(supabaseUrl)
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), VERCEL_LIVE],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", VERCEL_LIVE, "https://vercel.com"],
    "font-src": ["'self'", "data:", VERCEL_LIVE, "https://assets.vercel.com"],
    "connect-src": [
      "'self'",
      ...(sb ? [sb.https, sb.wss] : []),
      "https://api.open-meteo.com",
      "https://api.bigdatacloud.net",
      "https://ipapi.co",
      VERCEL_LIVE,
      "wss://ws-us3.pusher.com",
      ...(isDev ? ["ws:"] : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "frame-src": [VERCEL_LIVE],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "manifest-src": ["'self'"],
  }
  // Sem upgrade-insecure-requests: em produção o Vercel já serve só HTTPS (+HSTS
  // abaixo) e, num `next start` local em http, a diretiva quebrava os
  // redirecionamentos do proxy (prefetch virava https://localhost).
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ")
}

/**
 * Lista de cabeçalhos para `headers()` do next.config.
 * @param {{ supabaseUrl?: string, isDev?: boolean }} opts
 */
export function securityHeaders({ supabaseUrl, isDev = false } = {}) {
  const headers = [
    { key: "Content-Security-Policy", value: buildCsp({ supabaseUrl, isDev }) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      // geolocation=(self): o clima do cabeçalho pede a localização do navegador
      value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()",
    },
  ]
  if (!isDev) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" })
  }
  return headers
}
