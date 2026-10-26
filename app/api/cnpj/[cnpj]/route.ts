import { NextResponse } from "next/server"
import { isValidCNPJ, normalizeCnpj } from "@/lib/cnpj-validation"
import { createClient } from "@/lib/supabase/server"
import { hasSupabaseConfig } from "@/lib/supabase/core"
import { hasAppAccess, parseRole } from "@/lib/roles"

const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1"
const RECEITAWS_URL = "https://receitaws.com.br/v1/cnpj"

const COMMON_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; HubFiscal/1.0; +https://github.com)",
}

type BrasilApiResponse = {
  razao_social: string | null
  nome_fantasia: string | null
  email: string | null
  ddd_telefone_1: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  cep: string | null
  cnae_fiscal: number | null
  cnae_fiscal_descricao: string | null
  descricao_situacao_cadastral: string | null
}

type ReceitaWsResponse = {
  status?: string
  message?: string
  nome?: string
  fantasia?: string
  email?: string
  telefone?: string
  logradouro?: string
  numero?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  atividade_principal?: { code: string; text: string }[]
  situacao?: string
}

// Dados públicos da Receita mudam pouco: cache de 1 dia no Data Cache do Next
// (também poupa o limite de consultas da BrasilAPI/ReceitaWS).
const EXTERNAL_FETCH = { headers: COMMON_HEADERS, next: { revalidate: 86_400 } } as const

// Limite simples em memória por usuário (por instância do servidor): evita
// que uma sessão use a rota como proxy de consulta em massa.
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): { limited: boolean; retryAfter: number } {
  const now = Date.now()
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
  }
  const cur = hits.get(key)
  if (!cur || cur.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return { limited: false, retryAfter: 0 }
  }
  cur.count++
  return { limited: cur.count > RATE_LIMIT, retryAfter: Math.ceil((cur.resetAt - now) / 1000) }
}

/** Quem está chamando: id do usuário logado com papel, ou uma resposta de erro. */
async function authorize(): Promise<{ key: string } | { response: NextResponse }> {
  if (!hasSupabaseConfig()) {
    // Modo local de desenvolvimento (sem Supabase): não há login. Em produção
    // o proxy já devolve 503 antes de chegar aqui.
    if (process.env.NODE_ENV === "production") {
      return { response: NextResponse.json({ error: "Serviço indisponível." }, { status: 503 }) }
    }
    return { key: "local-dev" }
  }
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) {
      return { response: NextResponse.json({ error: "Faça login para consultar CNPJ." }, { status: 401 }) }
    }
    if (user.is_anonymous || !hasAppAccess(parseRole(user.app_metadata?.role))) {
      return { response: NextResponse.json({ error: "Sua conta ainda não tem acesso liberado." }, { status: 403 }) }
    }
    return { key: user.id }
  } catch (e) {
    console.warn("[cnpj] falha ao validar sessão:", e)
    return { response: NextResponse.json({ error: "Faça login para consultar CNPJ." }, { status: 401 }) }
  }
}

function fromReceitaWs(d: ReceitaWsResponse): BrasilApiResponse {
  const cnae = d.atividade_principal?.[0]
  return {
    razao_social: d.nome ?? null,
    nome_fantasia: d.fantasia ?? null,
    email: d.email ?? null,
    ddd_telefone_1: d.telefone ?? null,
    logradouro: d.logradouro ?? null,
    numero: d.numero ?? null,
    bairro: d.bairro ?? null,
    municipio: d.municipio ?? null,
    uf: d.uf ?? null,
    cep: d.cep ?? null,
    cnae_fiscal: cnae ? Number(cnae.code.replace(/\D/g, "")) || null : null,
    cnae_fiscal_descricao: cnae?.text ?? null,
    descricao_situacao_cadastral: d.situacao ?? null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const auth = await authorize()
  if ("response" in auth) return auth.response

  const rl = rateLimited(auth.key)
  if (rl.limited) {
    return NextResponse.json(
      { error: "Muitas consultas em sequência. Aguarde cerca de 1 minuto e tente de novo." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const { cnpj } = await params
  const cleanCnpj = normalizeCnpj(cnpj)

  if (!isValidCNPJ(cleanCnpj)) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 })
  }

  // Marca se a BrasilAPI bloqueou por excesso de consultas (rate limit).
  // Usado lá embaixo pra dar a mensagem certa caso o fallback também falhe.
  let brasilApiRateLimited = false

  // Tentativa 1: BrasilAPI
  try {
    const r = await fetch(`${BRASILAPI_URL}/${cleanCnpj}`, EXTERNAL_FETCH)

    if (r.ok) {
      const data = (await r.json()) as BrasilApiResponse
      return NextResponse.json(data)
    }

    // IMPORTANTE: 404 aqui NÃO encerra a busca. A base da BrasilAPI às vezes
    // não tem CNPJs recentes que JÁ EXISTEM na ReceitaWS (ex: C3 EDUCA LTDA).
    // Então caímos no fallback; só devolvemos "não encontrado" se a ReceitaWS
    // também não achar.
    if (r.status === 429) {
      brasilApiRateLimited = true
    }
    console.warn(`[cnpj] BrasilAPI ${r.status} — tentando ReceitaWS`)
  } catch (e) {
    console.warn("[cnpj] BrasilAPI fetch falhou:", e)
  }

  // Tentativa 2: ReceitaWS (fallback)
  try {
    const r = await fetch(`${RECEITAWS_URL}/${cleanCnpj}`, EXTERNAL_FETCH)

    if (r.status === 429) {
      return NextResponse.json(
        { error: "Muitas consultas em sequência. Aguarde cerca de 1 minuto e tente de novo." },
        { status: 429 },
      )
    }

    if (r.ok) {
      const data = (await r.json()) as ReceitaWsResponse
      if (data.status === "ERROR") {
        return NextResponse.json(
          { error: data.message ?? "CNPJ não encontrado" },
          { status: 404 },
        )
      }
      return NextResponse.json(fromReceitaWs(data))
    }

    // Se a BrasilAPI tinha bloqueado por limite E o fallback também não veio,
    // a causa mais provável é excesso de consultas — avisa isso, não "indisponível".
    if (brasilApiRateLimited) {
      return NextResponse.json(
        { error: "Muitas consultas em sequência. Aguarde cerca de 1 minuto e tente de novo." },
        { status: 429 },
      )
    }

    return NextResponse.json(
      { error: `Serviços de consulta indisponíveis (HTTP ${r.status}).` },
      { status: 502 },
    )
  } catch (e) {
    console.error("[cnpj] Todos os serviços falharam:", e)
    if (brasilApiRateLimited) {
      return NextResponse.json(
        { error: "Muitas consultas em sequência. Aguarde cerca de 1 minuto e tente de novo." },
        { status: 429 },
      )
    }
    return NextResponse.json(
      { error: "Não foi possível consultar o CNPJ. Tente novamente em instantes." },
      { status: 502 },
    )
  }
}
