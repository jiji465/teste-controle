// Persistência das apurações mensais (camada financeira do Relatório Executivo).
// Mesmo padrão de features/taxes/services.ts: Supabase quando configurado,
// fallback localStorage caso contrário. Mapeia snake_case (DB) ↔ camelCase (TS).
import { hasSupabaseConfig, getSupabaseClient } from "@/lib/supabase/core"
import type { ClientData, HistPoint } from "./lib/types"

export interface ApuracaoRecord {
  id?: string
  clientId: string
  compKey: string // 'AAAA-MM'
  competenceShort?: string
  regime?: string
  anexo?: string
  atividade?: string
  faturamento: number
  rbt12: number
  folha12m: number
  proLabore: number
  totalTributos: number
  totalPagar: number
  aliquotaEfetiva: number
  economia: number
  das: number
  /** Estado completo do editor (ClientData) p/ reabrir/editar e re-gerar o PDF. */
  payload?: ClientData
  updatedAt?: string
}

const LS_KEY = "ctrl-fiscal:apuracao"

/* ---- mapeamento ---- */
function mapToDb(r: ApuracaoRecord) {
  return {
    ...(r.id ? { id: r.id } : {}),
    client_id: r.clientId,
    comp_key: r.compKey,
    competence_short: r.competenceShort ?? null,
    regime: r.regime ?? null,
    anexo: r.anexo ?? null,
    atividade: r.atividade ?? null,
    faturamento: r.faturamento ?? 0,
    rbt12: r.rbt12 ?? 0,
    folha12m: r.folha12m ?? 0,
    pro_labore: r.proLabore ?? 0,
    total_tributos: r.totalTributos ?? 0,
    total_pagar: r.totalPagar ?? 0,
    aliquota_efetiva: r.aliquotaEfetiva ?? 0,
    economia: r.economia ?? 0,
    das: r.das ?? 0,
    payload: r.payload ?? null,
    updated_at: new Date().toISOString(),
  }
}
function mapFromDb(row: any): ApuracaoRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    compKey: row.comp_key,
    competenceShort: row.competence_short ?? undefined,
    regime: row.regime ?? undefined,
    anexo: row.anexo ?? undefined,
    atividade: row.atividade ?? undefined,
    faturamento: Number(row.faturamento) || 0,
    rbt12: Number(row.rbt12) || 0,
    folha12m: Number(row.folha12m) || 0,
    proLabore: Number(row.pro_labore) || 0,
    totalTributos: Number(row.total_tributos) || 0,
    totalPagar: Number(row.total_pagar) || 0,
    aliquotaEfetiva: Number(row.aliquota_efetiva) || 0,
    economia: Number(row.economia) || 0,
    das: Number(row.das) || 0,
    payload: row.payload ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

/* ---- fallback localStorage ---- */
function lsAll(): ApuracaoRecord[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) || "[]")
  } catch {
    return []
  }
}
function lsWrite(arr: ApuracaoRecord[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

/* ---- API ---- */
export async function getApuracoes(clientId: string): Promise<ApuracaoRecord[]> {
  if (!clientId) return []
  if (!hasSupabaseConfig()) {
    return lsAll().filter((r) => r.clientId === clientId).sort((a, b) => a.compKey.localeCompare(b.compKey))
  }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("apuracao_mensal").select("*").eq("client_id", clientId).order("comp_key")
  if (error) {
    console.error("[db] Error fetching apuracoes:", error)
    return lsAll().filter((r) => r.clientId === clientId)
  }
  return (data || []).map(mapFromDb)
}

export async function getApuracao(clientId: string, compKey: string): Promise<ApuracaoRecord | null> {
  const all = await getApuracoes(clientId)
  return all.find((r) => r.compKey === compKey) || null
}

export async function saveApuracao(rec: ApuracaoRecord): Promise<void> {
  if (!hasSupabaseConfig()) {
    const arr = lsAll().filter((r) => !(r.clientId === rec.clientId && r.compKey === rec.compKey))
    arr.push({ ...rec, updatedAt: new Date().toISOString() })
    lsWrite(arr)
    return
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("apuracao_mensal").upsert(mapToDb(rec), { onConflict: "client_id,comp_key" })
  if (error) {
    console.error("[db] Error saving apuracao:", error)
    throw error
  }
}

export async function deleteApuracao(clientId: string, compKey: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    lsWrite(lsAll().filter((r) => !(r.clientId === clientId && r.compKey === compKey)))
    return
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("apuracao_mensal").delete().match({ client_id: clientId, comp_key: compKey })
  if (error) {
    console.error("[db] Error deleting apuracao:", error)
    throw error
  }
}

/** Converte registros salvos em pontos do gráfico de evolução. */
export function toHistPoints(records: ApuracaoRecord[]): HistPoint[] {
  return records
    .map((r) => ({
      key: r.compKey,
      competenceShort: r.competenceShort,
      faturamento: r.faturamento,
      tributos: r.totalTributos,
      totPagar: r.totalPagar,
      aliquota: r.aliquotaEfetiva,
      economia: r.economia,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}
