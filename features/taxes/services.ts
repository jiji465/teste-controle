import type { Tax } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, fetchAll, local, toDbError, assertAffected } from "@/lib/supabase/core"
import { assertLocalWriteAllowed } from "@/lib/period-lock"

function mapTaxToDb(tax: Tax) {
  return {
    id: tax.id,
    name: tax.name,
    client_id: tax.clientId || null,
    scope: tax.scope || null,
    description: tax.description || null,
    competency_month: tax.competencyMonth || null,
    due_day: tax.dueDay || null,
    due_month: tax.dueMonth ?? null,
    status: tax.status,
    priority: tax.priority,
    assigned_to: tax.assignedTo || null,
    protocol: tax.protocol || null,
    notes: tax.notes || null,
    completed_at: tax.completedAt || null,
    completed_by: tax.completedBy || null,
    tags: tax.tags || [],
    applicable_regimes: tax.applicableRegimes || [],
    recurrence: tax.recurrence || null,
    recurrence_interval: tax.recurrenceInterval || null,
    recurrence_end_date: tax.recurrenceEndDate || null,
    auto_generate: tax.autoGenerate || false,
    weekend_rule: tax.weekendRule || "postpone",
    created_at: tax.createdAt,
  }
}

function mapDbToTax(row: any): Tax {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id ?? undefined,
    scope: row.scope || undefined,
    description: row.description || "",
    competencyMonth: row.competency_month ?? undefined,
    dueDay: row.due_day,
    dueMonth: row.due_month ?? undefined,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    protocol: row.protocol,
    notes: row.notes,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    tags: row.tags || [],
    applicableRegimes: row.applicable_regimes || [],
    recurrence: row.recurrence,
    recurrenceInterval: row.recurrence_interval,
    recurrenceEndDate: row.recurrence_end_date,
    autoGenerate: row.auto_generate,
    weekendRule: row.weekend_rule,
    createdAt: row.created_at,
    history: [],
  }
}

export async function getTaxes(): Promise<Tax[]> {
  if (!hasSupabaseConfig()) return local.getTaxes()
  const rows = await fetchAll("taxes", "name")
  return rows.map(mapDbToTax)
}

export async function saveTax(tax: Tax): Promise<void> {
  if (!hasSupabaseConfig()) {
    // Sem banco não há trigger de fechamento: aplica a mesma regra aqui.
    assertLocalWriteAllowed(local.getTaxes().find((x) => x.id === tax.id), tax, local.getLockedPeriods())
    local.saveTax(tax)
    return
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("taxes").upsert(mapTaxToDb(tax))
  if (error) { console.error("[db] Error saving tax:", error); throw toDbError(error) }
}

export async function deleteTax(id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    assertLocalWriteAllowed(local.getTaxes().find((x) => x.id === id), undefined, local.getLockedPeriods())
    local.deleteTax(id)
    return
  }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("taxes").delete().eq("id", id).select("id")
  if (error) { console.error("[db] Error deleting tax:", error); throw toDbError(error) }
  assertAffected(data)
}
