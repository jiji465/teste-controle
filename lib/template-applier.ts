import { saveObligation } from "@/features/obligations/services"
import { saveTax } from "@/features/taxes/services"
import { getObligations, getTaxes } from "@/lib/supabase/database"
import type { Client, Tax } from "@/lib/types"
import type { TemplateItem } from "@/lib/obligation-templates"

export type ApplyTemplateResult = {
  taxesCreated: number
  taxesUpdated: number
  obligationsCreated: number
  obligationsSkipped: number
}

/**
 * Aplica um conjunto de itens de template a uma empresa.
 *
 * Itens com category="tax_guide" viram **Tax** (aparecem em /impostos):
 *   - Se já existe Tax com mesmo nome ou sourceTaxId, apenas adiciona o regime do
 *     cliente em applicableRegimes (não duplica).
 *   - Se não existe, cria novo Tax já marcado para o regime do cliente.
 *
 * Itens com outras categorias (declaration, sped, etc.) viram **Obligation** por
 * cliente (aparecem em /obrigacoes), com dedup por nome.
 */
export async function applyTemplateToClient(
  client: Client,
  items: TemplateItem[],
): Promise<ApplyTemplateResult> {
  const now = new Date().toISOString()
  const regime = client.taxRegime

  const taxItems = items.filter((t) => t.category === "tax_guide")
  const obligationItems = items.filter((t) => t.category !== "tax_guide")

  const [existingObligations, existingTaxes] = await Promise.all([
    getObligations(),
    getTaxes(),
  ])

  const existingForClient = existingObligations.filter((o) => o.clientId === client.id)
  const existingObligationNames = new Set(existingForClient.map((o) => o.name.toLowerCase()))

  const existingTaxByName = new Map<string, Tax>()
  const existingTaxById = new Map<string, Tax>()
  for (const tx of existingTaxes) {
    existingTaxByName.set(tx.name.toLowerCase(), tx)
    existingTaxById.set(tx.id, tx)
  }

  let taxesCreated = 0
  let taxesUpdated = 0
  const taxesToSave: Tax[] = []

  for (const item of taxItems) {
    const linked = item.sourceTaxId
      ? existingTaxById.get(item.sourceTaxId)
      : existingTaxByName.get(item.name.toLowerCase())

    if (linked) {
      if (regime) {
        const regimes = linked.applicableRegimes ?? []
        // Se a lista de regimes está vazia, o imposto se aplica a todos — não precisa atualizar
        if (regimes.length > 0 && !regimes.includes(regime)) {
          taxesToSave.push({ ...linked, applicableRegimes: [...regimes, regime] })
          taxesUpdated++
        }
      }
    } else {
      taxesToSave.push({
        id: crypto.randomUUID(),
        name: item.name,
        description: item.description,
        scope: item.scope,
        dueDay: item.dueDay,
        recurrence: item.recurrence,
        weekendRule: item.weekendRule,
        priority: item.priority,
        status: "pending",
        applicableRegimes: regime ? [regime] : [],
        autoGenerate: true,
        createdAt: now,
        tags: [],
        history: [],
      })
      taxesCreated++
    }
  }

  const obligationsToCreate = obligationItems.filter(
    (t) => !existingObligationNames.has(t.name.toLowerCase()),
  )
  const obligationsSkipped = obligationItems.length - obligationsToCreate.length

  await Promise.all([
    ...taxesToSave.map((t) => saveTax(t)),
    ...obligationsToCreate.map((t) =>
      saveObligation({
        id: crypto.randomUUID(),
        name: t.name,
        description: t.description,
        category: t.category,
        clientId: client.id,
        taxId: t.sourceTaxId,
        dueDay: t.dueDay,
        frequency: t.frequency,
        recurrence: t.recurrence,
        weekendRule: t.weekendRule,
        status: "pending",
        priority: t.priority,
        autoGenerate: true,
        source: t.sourceTaxId ? "tax" : "template",
        createdAt: now,
        history: [],
        tags: [],
        attachments: [],
      }),
    ),
  ])

  return {
    taxesCreated,
    taxesUpdated,
    obligationsCreated: obligationsToCreate.length,
    obligationsSkipped,
  }
}

/**
 * Formata o resultado em uma string amigável para toast.
 * Ex: "2 impostos criados + 3 obrigações criadas"
 */
export function summarizeApplyResult(result: ApplyTemplateResult): string {
  const parts: string[] = []
  const { taxesCreated, taxesUpdated, obligationsCreated } = result
  if (taxesCreated > 0)
    parts.push(`${taxesCreated} imposto${taxesCreated > 1 ? "s" : ""} criado${taxesCreated > 1 ? "s" : ""}`)
  if (taxesUpdated > 0)
    parts.push(`${taxesUpdated} imposto${taxesUpdated > 1 ? "s" : ""} vinculado${taxesUpdated > 1 ? "s" : ""} ao regime`)
  if (obligationsCreated > 0)
    parts.push(`${obligationsCreated} obrigaç${obligationsCreated > 1 ? "ões" : "ão"} criada${obligationsCreated > 1 ? "s" : ""}`)
  return parts.length > 0 ? parts.join(" + ") : ""
}
