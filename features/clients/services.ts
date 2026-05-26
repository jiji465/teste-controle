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

export type ArchiveClientResult = {
  /** Obrigações apagadas (pending/in_progress/overdue/etc — qualquer != completed) */
  obrigacoesDeleted: number
  /** Guias apagadas */
  guiasDeleted: number
  /** Parcelamentos apagados (só os SEM nenhuma parcela paga/enviada) */
  parcelasDeleted: number
  /** Itens concluídos preservados como histórico (obrig + guia + parc com pagamento) */
  preservedCount: number
}

/**
 * Arquiva um cliente preservando o histórico do que já foi feito:
 *  - Apaga obrigações/guias com status != "completed".
 *  - Apaga parcelamentos sem qualquer parcela paga/enviada.
 *  - Preserva: itens concluídos + parcelamentos com pelo menos uma parcela paga.
 *  - Marca client.status = "inactive" (cliente continua referenciável por FK).
 *
 * Use isso em vez de deleteClient quando o cliente deixou de ser cliente
 * mas você quer manter o histórico do que entregou pra ele.
 */
export async function archiveClient(id: string): Promise<ArchiveClientResult> {
  const result: ArchiveClientResult = {
    obrigacoesDeleted: 0,
    guiasDeleted: 0,
    parcelasDeleted: 0,
    preservedCount: 0,
  }

  if (!hasSupabaseConfig()) {
    // Fallback localStorage (dev sem Supabase configurado)
    const obs = local.getObligations().filter((o) => o.clientId === id)
    const txs = local.getTaxes().filter((t) => t.clientId === id)
    const insts = local.getInstallments().filter((i) => i.clientId === id)

    for (const o of obs) {
      if (o.status === "completed") result.preservedCount++
      else {
        local.deleteObligation(o.id)
        result.obrigacoesDeleted++
      }
    }
    for (const t of txs) {
      if (t.status === "completed") result.preservedCount++
      else {
        local.deleteTax(t.id)
        result.guiasDeleted++
      }
    }
    for (const i of insts) {
      const hasPayment = (i.paidInstallments ?? []).some((p) => p.paidAt || p.sentAt)
      if (hasPayment) result.preservedCount++
      else {
        local.deleteInstallment(i.id)
        result.parcelasDeleted++
      }
    }
    const client = local.getClients().find((c) => c.id === id)
    if (client) local.saveClient({ ...client, status: "inactive" })
    return result
  }

  const supabase = getSupabaseClient()

  // 1. Obrigações: deleta as não-concluídas; conta as preservadas
  const { data: obrigRows } = await supabase
    .from("obligations")
    .select("id, status")
    .eq("client_id", id)
  const obrigToDelete: string[] = []
  for (const r of (obrigRows as Array<{ id: string; status: string }> | null) ?? []) {
    if (r.status === "completed") result.preservedCount++
    else obrigToDelete.push(r.id)
  }
  if (obrigToDelete.length > 0) {
    const { error } = await supabase.from("obligations").delete().in("id", obrigToDelete)
    if (error) {
      console.error("[archive] Error deleting obligations:", error)
      throw error
    }
    result.obrigacoesDeleted = obrigToDelete.length
  }

  // 2. Guias: idem
  const { data: taxRows } = await supabase
    .from("taxes")
    .select("id, status")
    .eq("client_id", id)
  const taxToDelete: string[] = []
  for (const r of (taxRows as Array<{ id: string; status: string }> | null) ?? []) {
    if (r.status === "completed") result.preservedCount++
    else taxToDelete.push(r.id)
  }
  if (taxToDelete.length > 0) {
    const { error } = await supabase.from("taxes").delete().in("id", taxToDelete)
    if (error) {
      console.error("[archive] Error deleting taxes:", error)
      throw error
    }
    result.guiasDeleted = taxToDelete.length
  }

  // 3. Parcelamentos: preserva se tem qualquer parcela paga/enviada
  const { data: instRows } = await supabase
    .from("installments")
    .select("id, paid_installments")
    .eq("client_id", id)
  const instToDelete: string[] = []
  for (const r of (instRows as Array<{
    id: string
    paid_installments: Array<{ paidAt?: string; sentAt?: string }> | null
  }> | null) ?? []) {
    const hasPayment = (r.paid_installments ?? []).some((p) => p.paidAt || p.sentAt)
    if (hasPayment) result.preservedCount++
    else instToDelete.push(r.id)
  }
  if (instToDelete.length > 0) {
    const { error } = await supabase.from("installments").delete().in("id", instToDelete)
    if (error) {
      console.error("[archive] Error deleting installments:", error)
      throw error
    }
    result.parcelasDeleted = instToDelete.length
  }

  // 4. Marca cliente como inativo
  const { error: clientErr } = await supabase
    .from("clients")
    .update({ status: "inactive" })
    .eq("id", id)
  if (clientErr) {
    console.error("[archive] Error updating client status:", clientErr)
    throw clientErr
  }

  return result
}

/**
 * Reativa um cliente arquivado (status: inactive → active).
 * O histórico (itens concluídos preservados) continua intacto.
 */
export async function reactivateClient(id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    const client = local.getClients().find((c) => c.id === id)
    if (client) local.saveClient({ ...client, status: "active" })
    return
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("clients").update({ status: "active" }).eq("id", id)
  if (error) {
    console.error("[db] Error reactivating client:", error)
    throw error
  }
}
