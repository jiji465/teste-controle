import type { Client } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, local } from "@/lib/supabase/core"

function mapClientToDb(client: Client) {
  return {
    id: client.id,
    name: client.name,
    cnpj: client.cnpj,
    email: client.email || null,
    phone: client.phone || null,
    status: client.status,
    tax_regime: client.taxRegime || null,
    ie: client.ie || null,
    im: client.im || null,
    notes: client.notes || null,
    created_at: client.createdAt,
  }
}

function mapDbToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    email: row.email || "",
    phone: row.phone || "",
    status: row.status,
    taxRegime: row.tax_regime || undefined,
    ie: row.ie || undefined,
    im: row.im || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  }
}

export async function getClients(): Promise<Client[]> {
  if (!hasSupabaseConfig()) return local.getClients()
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.from("clients").select("*").order("name")
  if (error) { console.error("[db] Error fetching clients:", error); return local.getClients() }
  return data.map(mapDbToClient)
}

export async function saveClient(client: Client): Promise<void> {
  if (!hasSupabaseConfig()) { local.saveClient(client); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("clients").upsert(mapClientToDb(client))
  if (error) { console.error("[db] Error saving client:", error); throw error }
}

export async function deleteClient(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteClient(id); return }
  const supabase = await getSupabaseClient()
  const { error } = await supabase.from("clients").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting client:", error); throw error }
}
