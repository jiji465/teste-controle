import { hasSupabaseConfig, getSupabaseClient } from "@/lib/supabase/core"

export type HistoryEntityType = "obligation" | "tax" | "installment" | "client" | "service"

export interface HistoryRecord {
  id: string
  action: string
  description: string
  userName?: string
  createdAt: string
}

/**
 * Trilha de auditoria gravada pelo banco (trigger add_history_entry, ver
 * scripts/019_hardening.sql): quem criou, mudou status, concluiu ou excluiu.
 * Sem Supabase, não há trilha — devolve [].
 */
export async function getHistory(entityType: HistoryEntityType, entityId: string): Promise<HistoryRecord[]> {
  if (!hasSupabaseConfig() || !entityId) return []
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("history")
    .select("id, action, description, user_name, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) {
    console.warn("[history] falha ao carregar:", error.message)
    return []
  }
  return (data ?? []).map((r: { id: string; action: string; description: string; user_name: string | null; created_at: string }) => ({
    id: r.id,
    action: r.action,
    description: r.description,
    userName: r.user_name ?? undefined,
    createdAt: r.created_at,
  }))
}
