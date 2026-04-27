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
    notes: installment.notes || null,
    completed_at: installment.completedAt || null,
    completed_by: installment.completedBy || null,
    tags: installment.tags || [],
    auto_generate: installment.autoGenerate,
    recurrence: installment.recurrence,
    recurrence_interval: installment.recurrenceInterval || null,
    created_at: installment.createdAt,
    // Mapeia camelCase → snake_case para o JSONB do banco.
    // Se a coluna ainda não existir (migration 010 não rodada), o Supabase
    // ignora silenciosamente (não dá erro de upsert).
    paid_installments: (installment.paidInstallments || []).map((p) => ({
      number: p.number,
      paid_at: p.paidAt,
      paid_by: p.paidBy ?? null,
    })),
  }
}

function mapDbToInstallment(row: any): Installment {
  // Se a coluna paid_installments não existir ainda (migration não rodada),
  // row.paid_installments vem undefined → tratamos como []
  const paid = Array.isArray(row.paid_installments)
    ? row.paid_installments.map((p: any) => ({
        number: Number(p.number),
        paidAt: String(p.paid_at ?? p.paidAt ?? ""),
        paidBy: p.paid_by ?? p.paidBy ?? undefined,
      }))
    : []
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
    notes: row.notes,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    tags: row.tags || [],
    autoGenerate: row.auto_generate,
    recurrence: row.recurrence,
    recurrenceInterval: row.recurrence_interval,
    createdAt: row.created_at,
    history: [],
    paidInstallments: paid,
  }
}

export async function getInstallments(): Promise<Installment[]> {
  if (!hasSupabaseConfig()) return local.getInstallments()
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("installments").select("*").order("due_day")
  if (error) { console.error("[db] Error fetching installments:", error); return local.getInstallments() }
  return data.map(mapDbToInstallment)
}

export async function saveInstallment(installment: Installment): Promise<void> {
  if (!hasSupabaseConfig()) { local.saveInstallment(installment); return }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("installments").upsert(mapInstallmentToDb(installment))
  if (error) { console.error("[db] Error saving installment:", error); throw error }
}

export async function deleteInstallment(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteInstallment(id); return }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("installments").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting installment:", error); throw error }
}
