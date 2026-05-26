import type { Service, ServiceCategory, RecurrenceType, Priority } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient } from "@/lib/supabase/core"

// Storage local não cobre Serviços (Service é nova entidade). Em modo
// sem Supabase, a lista volta vazia — usuário precisa do banco pra usar.

function mapServiceToDb(s: Service) {
  return {
    id: s.id,
    name: s.name,
    client_id: s.clientId,
    description: s.description || null,
    category: s.category,
    due_date: s.dueDate,
    status: s.status,
    priority: s.priority,
    recurrence: s.recurrence || null,
    recurrence_interval: s.recurrenceInterval ?? null,
    recurrence_end_date: s.recurrenceEndDate || null,
    auto_generate: s.autoGenerate ?? false,
    notes: s.notes || null,
    tags: s.tags || [],
    history: s.history || [],
    completed_at: s.completedAt || null,
    completed_by: s.completedBy || null,
    created_at: s.createdAt,
  }
}

function mapDbToService(row: any): Service {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    description: row.description ?? undefined,
    category: (row.category ?? "other") as ServiceCategory,
    dueDate: row.due_date,
    status: row.status,
    priority: row.priority as Priority,
    recurrence: (row.recurrence ?? undefined) as RecurrenceType | undefined,
    recurrenceInterval: row.recurrence_interval ?? undefined,
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
    autoGenerate: row.auto_generate ?? false,
    notes: row.notes ?? undefined,
    tags: row.tags || [],
    history: row.history || [],
    completedAt: row.completed_at ?? undefined,
    completedBy: row.completed_by ?? undefined,
    createdAt: row.created_at,
  }
}

export async function getServices(): Promise<Service[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("services").select("*").order("due_date")
  if (error) {
    console.error("[db] Error fetching services:", error)
    return []
  }
  return data.map(mapDbToService)
}

export async function saveService(service: Service): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase não configurado — Serviços precisam do banco")
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("services").upsert(mapServiceToDb(service))
  if (error) {
    console.error("[db] Error saving service:", error)
    throw error
  }
}

export async function deleteService(id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase não configurado")
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("services").delete().eq("id", id)
  if (error) {
    console.error("[db] Error deleting service:", error)
    throw error
  }
}
