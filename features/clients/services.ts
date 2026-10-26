import type { Client } from "@/lib/types"
import { normalizeCnpj } from "@/lib/cnpj-validation"
import { hasSupabaseConfig, getSupabaseClient, fetchAll, local, toDbError, assertAffected } from "@/lib/supabase/core"
import { getLockedPeriods } from "@/features/periods/services"

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
  const rows = await fetchAll("clients", "name")
  return rows.map(mapDbToClient)
}


export class DuplicateClientError extends Error {
  constructor(public readonly existingName: string) {
    super(`Já existe uma empresa cadastrada com este CNPJ: ${existingName}`)
    this.name = "DuplicateClientError"
  }
}

export async function saveClient(client: Client): Promise<void> {
  const incomingCnpj = normalizeCnpj(client.cnpj)
  // Só checa duplicado quando HÁ CNPJ. Clientes sem CNPJ (pessoa física,
  // serviço avulso) podem coexistir mesmo com nomes iguais — são entidades
  // distintas e o CNPJ é a única chave de deduplicação.
  const shouldDedup = incomingCnpj.length > 0

  if (!hasSupabaseConfig()) {
    if (shouldDedup) {
      const existing = local.getClients().find(
        (c) => normalizeCnpj(c.cnpj) === incomingCnpj && c.id !== client.id,
      )
      if (existing) throw new DuplicateClientError(existing.name)
    }
    local.saveClient(client)
    return
  }

  const supabase = getSupabaseClient()

  if (shouldDedup) {
    const { data: matches } = await supabase
      .from("clients")
      .select("id, name, cnpj")
      .neq("id", client.id)
    const duplicate = (matches as Array<{ id: string; name: string; cnpj: string }> | null)?.find(
      (c) => normalizeCnpj(c.cnpj) === incomingCnpj,
    )
    if (duplicate) throw new DuplicateClientError(duplicate.name)
  }

  const { error } = await supabase.from("clients").upsert(mapClientToDb(client))
  if (error) { console.error("[db] Error saving client:", error); throw toDbError(error) }
}

export async function deleteClient(id: string): Promise<void> {
  if (!hasSupabaseConfig()) { local.deleteClient(id); return }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("clients").delete().eq("id", id).select("id")
  if (error) { console.error("[db] Error deleting client:", error); throw toDbError(error) }
  assertAffected(data)
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
  const lockedPeriods = new Set((await getLockedPeriods()).map((p) => p.period))

  if (!hasSupabaseConfig()) {
    // Fallback localStorage (dev sem Supabase configurado)
    const obs = local.getObligations().filter((o) => o.clientId === id)
    const txs = local.getTaxes().filter((t) => t.clientId === id)
    const insts = local.getInstallments().filter((i) => i.clientId === id)
    const obsToDelete = obs.filter((o) => o.status !== "completed")
    const txsToDelete = txs.filter((t) => t.status !== "completed")
    // Verifica TUDO antes de apagar qualquer coisa
    assertNoLockedDeletes(
      [...obsToDelete, ...txsToDelete].map((x) => x.competencyMonth),
      lockedPeriods,
    )

    result.preservedCount += obs.length - obsToDelete.length + txs.length - txsToDelete.length
    for (const o of obsToDelete) {
      local.deleteObligation(o.id)
      result.obrigacoesDeleted++
    }
    for (const t of txsToDelete) {
      local.deleteTax(t.id)
      result.guiasDeleted++
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

  // 1. Lê TUDO antes de apagar: se algum item a apagar estiver em competência
  //    fechada, o banco recusaria no meio (obrigações já apagadas, guias não,
  //    cliente ativo). Abortamos antes, sem mexer em nada.
  type Row = { id: string; status: string; competency_month?: string | null }
  const readRows = async <T,>(table: string, columns: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select(columns).eq("client_id", id)
    if (error) {
      console.error(`[archive] Error reading ${table}:`, error)
      throw toDbError(error)
    }
    return (data as T[] | null) ?? []
  }
  const obrigRows = await readRows<Row>("obligations", "id, status, competency_month")
  const taxRows = await readRows<Row>("taxes", "id, status, competency_month")
  const instRows = await readRows<{
    id: string
    paid_installments: Array<{ paid_at?: string; sent_at?: string; paidAt?: string; sentAt?: string }> | null
  }>("installments", "id, paid_installments")

  const obrigToDelete = obrigRows.filter((r) => r.status !== "completed")
  const taxToDelete = taxRows.filter((r) => r.status !== "completed")
  assertNoLockedDeletes(
    [...obrigToDelete, ...taxToDelete].map((r) => r.competency_month),
    lockedPeriods,
  )
  result.preservedCount += obrigRows.length - obrigToDelete.length + taxRows.length - taxToDelete.length

  // O banco grava snake_case (ver installments/services.ts); camelCase cobre linhas antigas.
  const instToDelete: string[] = []
  for (const r of instRows) {
    const hasPayment = (r.paid_installments ?? []).some((p) => p.paid_at || p.sent_at || p.paidAt || p.sentAt)
    if (hasPayment) result.preservedCount++
    else instToDelete.push(r.id)
  }

  // 2. Apaga obrigações, guias e parcelamentos sem pagamento
  // Conta o que o banco REALMENTE apagou (o RLS pode filtrar sem dar erro).
  const deleteIds = async (table: string, ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0
    const { data, error } = await supabase.from(table).delete().in("id", ids).select("id")
    if (error) {
      console.error(`[archive] Error deleting ${table}:`, error)
      throw toDbError(error)
    }
    assertAffected(data)
    return data.length
  }
  result.obrigacoesDeleted = await deleteIds("obligations", obrigToDelete.map((r) => r.id))
  result.guiasDeleted = await deleteIds("taxes", taxToDelete.map((r) => r.id))
  result.parcelasDeleted = await deleteIds("installments", instToDelete)

  // 3. Marca cliente como inativo
  const { data: clientRows, error: clientErr } = await supabase
    .from("clients")
    .update({ status: "inactive" })
    .eq("id", id)
    .select("id")
  if (clientErr) {
    console.error("[archive] Error updating client status:", clientErr)
    throw toDbError(clientErr)
  }
  assertAffected(clientRows)

  return result
}

/** Aborta o arquivamento se algum item a apagar estiver em competência fechada. */
function assertNoLockedDeletes(competencies: Array<string | null | undefined>, locked: ReadonlySet<string>): void {
  const hits = competencies.filter((c): c is string => !!c && locked.has(c.slice(0, 7)))
  if (hits.length === 0) return
  const periods = Array.from(new Set(hits.map((c) => c.slice(0, 7)))).sort()
  throw new Error(
    `Não é possível arquivar: ${hits.length} ${hits.length > 1 ? "itens pendentes estão" : "item pendente está"} em competência fechada (${periods.join(", ")}). ` +
      "Reabra a competência ou conclua esses itens antes de arquivar. Nada foi alterado.",
  )
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
  const { data, error } = await supabase.from("clients").update({ status: "active" }).eq("id", id).select("id")
  if (error) {
    console.error("[db] Error reactivating client:", error)
    throw toDbError(error)
  }
  assertAffected(data)
}
