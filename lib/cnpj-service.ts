export type CNPJData = {
  nome: string
  fantasia: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  email: string
  telefone: string
  cnaeCode?: string
  cnaeDescription?: string
  situacao?: string
}

type BrasilAPIResponse = {
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

const BRASILAPI_BASE = "/api/cnpj"

export class CNPJLookupError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "rate_limit" | "network" | "unknown",
  ) {
    super(message)
    this.name = "CNPJLookupError"
  }
}

export async function lookupCNPJ(
  cnpj: string,
  signal?: AbortSignal,
): Promise<CNPJData | null> {
  const cleanCnpj = cnpj.replace(/\D/g, "")
  if (cleanCnpj.length !== 14) return null

  let response: Response
  try {
    response = await fetch(`${BRASILAPI_BASE}/${cleanCnpj}`, { signal })
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error
    throw new CNPJLookupError(
      "Não foi possível conectar ao serviço de consulta. Verifique sua conexão.",
      "network",
    )
  }

  if (response.status === 404) return null
  if (response.status === 429) {
    throw new CNPJLookupError(
      "Limite de consultas atingido (3/min). Aguarde um minuto e tente novamente.",
      "rate_limit",
    )
  }
  if (!response.ok) {
    throw new CNPJLookupError(
      `Falha na consulta (HTTP ${response.status}).`,
      "unknown",
    )
  }

  const data = (await response.json()) as BrasilAPIResponse

  return {
    nome: data.razao_social ?? "",
    fantasia: data.nome_fantasia ?? "",
    logradouro: data.logradouro ?? "",
    numero: data.numero ?? "",
    bairro: data.bairro ?? "",
    municipio: data.municipio ?? "",
    uf: data.uf ?? "",
    cep: data.cep ?? "",
    email: data.email ?? "",
    telefone: data.ddd_telefone_1 ?? "",
    cnaeCode: data.cnae_fiscal != null ? String(data.cnae_fiscal) : undefined,
    cnaeDescription: data.cnae_fiscal_descricao ?? undefined,
    situacao: data.descricao_situacao_cadastral ?? undefined,
  }
}
