import { hasSupabaseConfig, getSupabaseClient, local, toDbError, assertAffected } from "@/lib/supabase/core"

/**
 * Fechamento de competência ("YYYY-MM"). Com Supabase, vive na tabela
 * `locked_periods` (migration 020) e um trigger no banco recusa qualquer
 * gravação em itens de competência fechada — vale para todos os usuários.
 * Sem Supabase (modo local/dev), cai no localStorage.
 */

export interface LockedPeriod {
  period: string
  lockedAt: string
  lockedByName?: string
  note?: string
}

const isMissingTable = (msg: string) => /does not exist|schema cache/i.test(msg)

export async function getLockedPeriods(): Promise<LockedPeriod[]> {
  if (!hasSupabaseConfig()) {
    return local.getLockedPeriods().map((period) => ({ period, lockedAt: "" }))
  }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("locked_periods").select("*").order("period")
  if (error) {
    if (isMissingTable(error.message)) {
      console.warn("[periods] Tabela locked_periods ausente — rode scripts/020_locked_periods.sql")
      return []
    }
    throw new Error(`Falha ao carregar competências fechadas: ${error.message}`)
  }
  return (data ?? []).map((r: any) => ({
    period: r.period,
    lockedAt: r.locked_at,
    lockedByName: r.locked_by_name ?? undefined,
    note: r.note ?? undefined,
  }))
}

export async function lockPeriod(period: string, lockedByName?: string, note?: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.lockPeriod(period); return }
  const supabase = getSupabaseClient()
  // Quem fechou e quando são carimbados pelo banco (scripts/023) a partir do
  // token; locked_by_name enviado aqui é ignorado lá (serve ao modo local).
  const { error } = await supabase.from("locked_periods").upsert({
    period,
    locked_by_name: lockedByName ?? null,
    note: note ?? null,
  })
  if (error) throw new Error(`Não foi possível fechar ${period}: ${toDbError(error).message}`)
}

export async function unlockPeriod(period: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.unlockPeriod(period); return }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("locked_periods").delete().eq("period", period).select("period")
  if (error) throw new Error(`Não foi possível reabrir ${period}: ${toDbError(error).message}`)
  try {
    assertAffected(data)
  } catch (e) {
    throw new Error(`Não foi possível reabrir ${period}: ${(e as Error).message}`)
  }
}
