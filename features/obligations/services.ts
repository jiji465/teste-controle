import type { Obligation } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, local } from "@/lib/supabase/core"

function mapObligationToDb(obligation: Obligation) {
  return {
    id: obligation.id,
    name: obligation.name,
    description: obligation.description || null,
    category: obligation.category,
    client_id: obligation.clientId,
    tax_id: obligation.taxId || null,
    due_day: obligation.dueDay,
    due_month: obligation.dueMonth || null,
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
    realization_date: obligation.realizationDate || null,
    amount: obligation.amount || null,
    notes: obligation.notes || null,
    completed_at: obligation.completedAt || null,
    completed_by: obligation.completedBy || null,
    attachments: obligation.attachments || [],
    parent_obligation_id: obligation.parentObligationId || null,
    generated_for: obligation.generatedFor || null,
    tags: obligation.tags || [],
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
    taxId: row.tax_id,
    dueDay: row.due_day,
    dueMonth: row.due_month,
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
    realizationDate: row.realization_date,
    amount: row.amount,
    notes: row.notes,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    attachments: row.attachments || [],
    parentObligationId: row.parent_obligation_id,
    generatedFor: row.generated_for,
    tags: row.tags || [],
    createdAt: row.created_at,
    history: [],
  }
}

export async function getObligations(): Promise<Obligation[]> {
  if (!hasSupabaseConfig()) return local.getObligations()
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.from("obligations").select("*").order("due_day")
  if (error) { console.error("[db] Error fetching obligations:", error); return local.getObligations() }
  return data.map(mapDbToObligation)
}

export async function saveObligation(obligation: Obligation): Promise<void> {
  if (!hasSupabaseConfig()) { local.saveObligation(obligation); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("obligations").upsert(mapObligationToDb(obligation))
  if (error) { console.error("[db] Error saving obligation:", error); throw error }
}

export async function deleteObligation(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteObligation(id); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("obligations").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting obligation:", error); throw error }
}
