import type { Tax } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, local } from "@/lib/supabase/core"

function mapTaxToDb(tax: Tax) {
  return {
    id: tax.id,
    name: tax.name,
    description: tax.description || null,
    federal_tax_code: tax.federalTaxCode || null,
    due_day: tax.dueDay || null,
    status: tax.status,
    priority: tax.priority,
    assigned_to: tax.assignedTo || null,
    protocol: tax.protocol || null,
    realization_date: tax.realizationDate || null,
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
    description: row.description || "",
    federalTaxCode: row.federal_tax_code,
    dueDay: row.due_day,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    protocol: row.protocol,
    realizationDate: row.realization_date,
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
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.from("taxes").select("*").order("name")
  if (error) { console.error("[db] Error fetching taxes:", error); return local.getTaxes() }
  return data.map(mapDbToTax)
}

export async function saveTax(tax: Tax): Promise<void> {
  if (!hasSupabaseConfig()) { local.saveTax(tax); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("taxes").upsert(mapTaxToDb(tax))
  if (error) { console.error("[db] Error saving tax:", error); throw error }
}

export async function deleteTax(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteTax(id); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("taxes").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting tax:", error); throw error }
}
