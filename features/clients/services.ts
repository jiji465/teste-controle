import type { Client } from "@/lib/types"
import { hasSupabaseConfig, getSupabaseClient, local } from "@/lib/supabase/core"

function mapClientToDb(client: Client) {
  return {
    id: client.id,
    name: client.name,
    trade_name: client.tradeName || null,
    cnpj: client.cnpj,
    email: client.email || null,
    phone: client.phone || null,
    status: client.status,
    tax_regime: client.taxRegime || null,
    business_activity: client.businessActivity || null,
    cnae_code: client.cnaeCode || null,
    cnae_description: client.cnaeDescription || null,
    ie: client.ie || null,
    im: client.im || null,
    city: client.city || null,
    state: client.state || null,
    notes: client.notes || null,
    created_at: client.createdAt,
  }
}

function mapDbToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    tradeName: row.trade_name || undefined,
    cnpj: row.cnpj,
    email: row.email || "",
    phone: row.phone || "",
    status: row.status,
    taxRegime: row.tax_regime || undefined,
    businessActivity: row.business_activity || undefined,
    cnaeCode: row.cnae_code || undefined,
    cnaeDescription: row.cnae_description || undefined,
    ie: row.ie || undefined,
    im: row.im || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  }
}

export async function getClients(): Promise<Client[]> {
  if (!hasSupabaseConfig()) return local.getClients()
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("clients").select("*").order("name")
  if (error) { console.error("[db] Error fetching clients:", error); return local.getClients() }
  return data.map(mapDbToClient)
}

const normalizeCnpj = (cnpj: string) => cnpj.replace(/\D/g, "")

export class DuplicateClientError extends Error {
  constructor(public readonly existingName: string) {
    super(`Já existe uma empresa cadastrada com este CNPJ: ${existingName}`)
    this.name = "DuplicateClientError"
  }
}

export async function saveClient(client: Client): Promise<void> {
  const incomingCnpj = normalizeCnpj(client.cnpj)

  if (!hasSupabaseConfig()) {
    const existing = local.getClients().find(
      (c) => normalizeCnpj(c.cnpj) === incomingCnpj && c.id !== client.id,
    )
    if (existing) throw new DuplicateClientError(existing.name)
    local.saveClient(client)
    return
  }

  const supabase = getSupabaseClient()

  const { data: matches } = await supabase
    .from("clients")
    .select("id, name, cnpj")
    .neq("id", client.id)
  const duplicate = (matches as Array<{ id: string; name: string; cnpj: string }> | null)?.find(
    (c) => normalizeCnpj(c.cnpj) === incomingCnpj,
  )
  if (duplicate) throw new DuplicateClientError(duplicate.name)

  const { error } = await supabase.from("clients").upsert(mapClientToDb(client))
  if (error) { console.error("[db] Error saving client:", error); throw error }
}

export async function deleteClient(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteClient(id); return }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("clients").delete().eq("id", id)
  if (error) { console.error("[db] Error deleting client:", error); throw error }
}
