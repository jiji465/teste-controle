import { NextResponse } from "next/server"

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
  const { cnpj } = await params
  const cleanCnpj = cnpj.replace(/\D/g, "")

  if (cleanCnpj.length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 })
  }

  // Tentativa 1: BrasilAPI
  try {
    const r = await fetch(`${BRASILAPI_URL}/${cleanCnpj}`, {
      headers: COMMON_HEADERS,
      cache: "no-store",
    })

    if (r.status === 404) {
      return NextResponse.json({ error: "CNPJ não encontrado" }, { status: 404 })
    }

    if (r.ok) {
      const data = (await r.json()) as BrasilApiResponse
      return NextResponse.json(data)
    }

    console.warn(`[cnpj] BrasilAPI ${r.status} — tentando ReceitaWS`)
  } catch (e) {
    console.warn("[cnpj] BrasilAPI fetch falhou:", e)
  }

  // Tentativa 2: ReceitaWS (fallback)
  try {
    const r = await fetch(`${RECEITAWS_URL}/${cleanCnpj}`, {
      headers: COMMON_HEADERS,
      cache: "no-store",
    })

    if (r.status === 429) {
      return NextResponse.json(
        { error: "Limite de consultas atingido. Aguarde um minuto." },
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

    return NextResponse.json(
      { error: `Serviços de consulta indisponíveis (HTTP ${r.status}).` },
      { status: 502 },
    )
  } catch (e) {
    console.error("[cnpj] Todos os serviços falharam:", e)
    return NextResponse.json(
      { error: "Não foi possível consultar o CNPJ. Tente novamente em instantes." },
      { status: 502 },
    )
  }
}
