import type { Installment } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, local } from "@/lib/supabase/core"

function mapInstallmentToDb(installment: Installment) {
  return {
    id: installment.id,
    name: installment.name,
    description: installment.description || null,
    client_id: installment.clientId,
    tax_id: installment.taxId || null,
    installment_count: installment.installmentCount,
    current_installment: installment.currentInstallment,
    due_day: installment.dueDay,
    first_due_date: installment.firstDueDate,
    weekend_rule: installment.weekendRule,
    status: installment.status,
    priority: installment.priority,
    assigned_to: installment.assignedTo || null,
    protocol: installment.protocol || null,
    realization_date: installment.realizationDate || null,
    total_amount: installment.totalAmount || null,
    installment_amount: installment.installmentAmount || null,
    notes: installment.notes || null,
    completed_at: installment.completedAt || null,
    completed_by: installment.completedBy || null,
    tags: installment.tags || [],
    payment_method: installment.paymentMethod || null,
    reference_number: installment.referenceNumber || null,
    auto_generate: installment.autoGenerate,
    recurrence: installment.recurrence,
    recurrence_interval: installment.recurrenceInterval || null,
    created_at: installment.createdAt,
  }
}

function mapDbToInstallment(row: any): Installment {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.client_id,
    taxId: row.tax_id,
    installmentCount: row.installment_count,
    currentInstallment: row.current_installment,
    dueDay: row.due_day,
    firstDueDate: row.first_due_date,
    weekendRule: row.weekend_rule,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    protocol: row.protocol,
    realizationDate: row.realization_date,
    totalAmount: row.total_amount,
    installmentAmount: row.installment_amount,
    notes: row.notes,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    tags: row.tags || [],
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    autoGenerate: row.auto_generate,
    recurrence: row.recurrence,
    recurrenceInterval: row.recurrence_interval,
    createdAt: row.created_at,
    history: [],
  }
}

export async function getInstallments(): Promise<Installment[]> {
  if (!hasSupabaseConfig()) return local.getInstallments()
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.from("installments").select("*").order("due_day")
  if (error) { console.error("[db] Error fetching installments:", error); return local.getInstallments() }
  return data.map(mapDbToInstallment)
}

export async function saveInstallment(installment: Installment): Promise<void> {
  if (!hasSupabaseConfig()) { local.saveInstallment(installment); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("installments").upsert(mapInstallmentToDb(installment))
  if (error) { console.error("[db] Error saving installment:", error); throw error }
}

export async function deleteInstallment(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteInstallment(id); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("installments").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting installment:", error); throw error }
}
