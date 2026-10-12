// Persistência das apurações mensais (camada financeira do Relatório Executivo).
// Mesmo padrão de features/taxes/services.ts: Supabase quando configurado,
// fallback localStorage caso contrário. Mapeia snake_case (DB) ↔ camelCase (TS).
import { hasSupabaseConfig, getSupabaseClient, toDbError } from "@/lib/supabase/core"
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
  /** Estado completo do editor ({ clientData, taxes }) p/ reabrir/editar e re-gerar o PDF. */
  payload?: { clientData?: ClientData & Record<string, unknown>; taxes?: unknown[] } | ClientData
  updatedAt?: string
  /** Versão otimista (migration 022). Enviar a versão carregada ao atualizar. */
  version?: number
  /** Totais do motor persistidos p/ conferência (migration 022). */
  baseCarga?: number
  totalProvisao?: number
  totalRetido?: number
  updatedByName?: string
}

/** Colunas que só existem depois da migration 022 (enviadas apenas se o banco já tiver). */
const COLS_022 = ["version", "base_carga", "total_provisao", "total_retido", "engine_version"] as const
export const ENGINE_VERSION = "2026.10-fase1"

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
    // updated_at/autor: no banco com 022 quem carimba é o trigger (relógio do servidor)
    updated_at: new Date().toISOString(),
    version: r.version ?? null,
    base_carga: r.baseCarga ?? null,
    total_provisao: r.totalProvisao ?? null,
    total_retido: r.totalRetido ?? null,
    engine_version: ENGINE_VERSION,
  }
}

/** Remove as colunas da 022 (banco ainda sem a migration). */
function sem022(row: Record<string, unknown>) {
  const out = { ...row }
  for (const c of COLS_022) delete out[c]
  return out
}
const faltaColuna = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /column .* does not exist|schema cache/i.test(e.message ?? ""))
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
    version: row.version ?? undefined,
    updatedByName: row.updated_by_name ?? undefined,
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
    throw new Error(`Falha ao carregar apurações: ${error.message}`)
  }
  return (data || []).map(mapFromDb)
}

export async function getApuracao(clientId: string, compKey: string): Promise<ApuracaoRecord | null> {
  const all = await getApuracoes(clientId)
  return all.find((r) => r.compKey === compKey) || null
}

/**
 * Salva a competência.
 *  · Registro novo (sem id): INSERT — se a competência já existir no banco, o índice
 *    único recusa (23505) em vez de sobrescrever em silêncio.
 *  · Registro existente (com id): UPDATE com a versão carregada — se outra pessoa
 *    salvou antes, o trigger da 022 recusa (40001) e nada é perdido.
 * Banco sem a migration 022: cai no upsert antigo (sem controle de versão).
 * Retorna o registro gravado (id/versão atualizados).
 */
export async function saveApuracao(rec: ApuracaoRecord): Promise<ApuracaoRecord> {
  if (!hasSupabaseConfig()) {
    const arr = lsAll()
    const atual = arr.find((r) => r.clientId === rec.clientId && r.compKey === rec.compKey)
    if (atual && rec.version !== undefined && atual.version !== undefined && atual.version !== rec.version) {
      throw new Error("Esta competência foi alterada em outra aba. Recarregue antes de salvar.")
    }
    const salvo: ApuracaoRecord = {
      ...rec,
      id: atual?.id ?? rec.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())),
      version: (atual?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }
    lsWrite([...arr.filter((r) => r !== atual), salvo])
    return salvo
  }
  const supabase = getSupabaseClient()
  const row = mapToDb(rec) as Record<string, unknown>
  delete row.updated_at

  const gravar = async (dados: Record<string, unknown>) => {
    if (rec.id) {
      return supabase.from("apuracao_mensal").update(dados).eq("id", rec.id).select().single()
    }
    const { version: _v, ...novo } = dados
    void _v
    return supabase.from("apuracao_mensal").insert(novo).select().single()
  }

  let { data, error } = await gravar(row)
  if (error && faltaColuna(error)) {
    // Banco ainda sem a 022: comportamento anterior (upsert por empresa+competência)
    const legado = sem022(row)
    ;({ data, error } = await supabase
      .from("apuracao_mensal")
      .upsert({ ...legado, updated_at: new Date().toISOString() }, { onConflict: "client_id,comp_key" })
      .select()
      .single())
  }
  if (error) {
    console.error("[db] Error saving apuracao:", error)
    throw toDbError(error)
  }
  return mapFromDb(data)
}

export async function deleteApuracao(clientId: string, compKey: string): Promise<void> {
  // A 022 bloqueia exclusão de competência fechada e guarda um snapshot em
  // apuracao_mensal_revisoes antes de apagar.
  if (!hasSupabaseConfig()) {
    lsWrite(lsAll().filter((r) => !(r.clientId === clientId && r.compKey === compKey)))
    return
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("apuracao_mensal").delete().match({ client_id: clientId, comp_key: compKey })
  if (error) {
    console.error("[db] Error deleting apuracao:", error)
    throw toDbError(error)
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
