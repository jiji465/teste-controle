import type { Obligation } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, local } from "@/lib/supabase/core"

function mapObligationToDb(obligation: Obligation) {
  return {
    id: obligation.id,
    name: obligation.name,
    description: obligation.description || null,
    category: obligation.category,
    client_id: obligation.clientId,
    scope: obligation.scope || null,
    applicable_regimes: obligation.applicableRegimes || [],
    due_day: obligation.dueDay,
    competency_month: obligation.competencyMonth || null,
    frequency: obligation.frequency,
    recurrence: obligation.recurrence,
    recurrence_interval: obligation.recurrenceInterval || null,
    recurrence_end_date: obligation.recurrenceEndDate || null,
    auto_generate: obligation.autoGenerate,
    weekend_rule: obligation.weekendRule,
    status: obligation.status,
    priority: obligation.priority,
    assigned_to: obligation.assignedTo || null,
    protocol: obligation.protocol || null,
    notes: obligation.notes || null,
    completed_at: obligation.completedAt || null,
    completed_by: obligation.completedBy || null,
    attachments: obligation.attachments || [],
    parent_obligation_id: obligation.parentObligationId || null,
    generated_for: obligation.generatedFor || null,
    tags: obligation.tags || [],
    source: obligation.source || null,
    template_id: obligation.templateId || null,
    created_at: obligation.createdAt,
  }
}

function mapDbToObligation(row: any): Obligation {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    clientId: row.client_id,
    scope: row.scope ?? undefined,
    applicableRegimes: row.applicable_regimes || [],
    dueDay: row.due_day,
    competencyMonth: row.competency_month ?? undefined,
    frequency: row.frequency,
    recurrence: row.recurrence,
    recurrenceInterval: row.recurrence_interval,
    recurrenceEndDate: row.recurrence_end_date,
    autoGenerate: row.auto_generate,
    weekendRule: row.weekend_rule,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    protocol: row.protocol,
    notes: row.notes,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    attachments: row.attachments || [],
    parentObligationId: row.parent_obligation_id,
    generatedFor: row.generated_for,
    tags: row.tags || [],
    source: row.source ?? undefined,
    templateId: row.template_id ?? undefined,
    createdAt: row.created_at,
    history: [],
  }
}

export async function getObligations(): Promise<Obligation[]> {
  if (!hasSupabaseConfig()) return local.getObligations()
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("obligations").select("*").order("due_day")
  if (error) { console.error("[db] Error fetching obligations:", error); return local.getObligations() }
  return data.map(mapDbToObligation)
}

export async function saveObligation(obligation: Obligation): Promise<void> {
  if (!hasSupabaseConfig()) { local.saveObligation(obligation); return }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("obligations").upsert(mapObligationToDb(obligation))
  if (error) { console.error("[db] Error saving obligation:", error); throw error }
}

export async function deleteObligation(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteObligation(id); return }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("obligations").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting obligation:", error); throw error }
}
