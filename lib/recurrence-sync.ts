import { settleAll } from "./bulk-actions"

/**
 * Decide QUAIS ocorrências de uma série recorrente devem ser gravadas.
 *
 * As ocorrências usam ids determinísticos, então salvar o item-mestre de novo
 * (edição) regerava os mesmos ids com status "pendente" — e o upsert
 * sobrescrevia ocorrências já concluídas (data, responsável, protocolo).
 *
 * Regra: só cria o que ainda NÃO existe; nunca toca no que já existe. Itens
 * de competência fechada são pulados (o banco recusaria e a gravação parava
 * no meio da série).
 */
export type OccurrencePlan<T> = {
  toCreate: T[]
  /** Já existiam (mesmo id ou id legado) — preservados como estão. */
  skippedExisting: T[]
  /** Competência fechada — não gravados. */
  skippedLocked: T[]
}

export type OccurrencePlanOptions<T> = {
  existingIds: ReadonlySet<string>
  /** "YYYY-MM" da ocorrência (competência ou mês do vencimento). */
  periodOf: (o: T) => string | undefined | null
  isPeriodLocked?: (period: string) => boolean
  /** Ids alternativos que também contam como "já existe" (esquemas antigos de id). */
  aliasIds?: (o: T) => string[]
}

export function planOccurrenceInserts<T extends { id: string }>(
  occurrences: T[],
  opts: OccurrencePlanOptions<T>,
): OccurrencePlan<T> {
  const plan: OccurrencePlan<T> = { toCreate: [], skippedExisting: [], skippedLocked: [] }
  for (const o of occurrences) {
    const exists =
      opts.existingIds.has(o.id) || (opts.aliasIds?.(o) ?? []).some((id) => opts.existingIds.has(id))
    if (exists) {
      plan.skippedExisting.push(o)
      continue
    }
    const period = opts.periodOf(o)
    if (period && opts.isPeriodLocked?.(period.slice(0, 7))) {
      plan.skippedLocked.push(o)
      continue
    }
    plan.toCreate.push(o)
  }
  return plan
}

/** Texto curto para o toast após salvar uma série. */
export function describeOccurrencePlan(plan: OccurrencePlan<unknown>, noun: { one: string; many: string }): string {
  const parts: string[] = []
  const n = plan.toCreate.length
  if (n > 0) parts.push(`${n} ${n > 1 ? noun.many : noun.one} gerada${n > 1 ? "s" : ""}`)
  const locked = plan.skippedLocked.length
  if (locked > 0) parts.push(`${locked} em competência fechada ignorada${locked > 1 ? "s" : ""}`)
  return parts.join(" · ")
}

/** Planeja e grava só as ocorrências novas; falhas individuais não param a série. */
export async function saveNewOccurrences<T extends { id: string }>(
  occurrences: T[],
  opts: OccurrencePlanOptions<T>,
  save: (o: T) => Promise<unknown>,
): Promise<OccurrencePlan<T> & { failed: { item: T; error: unknown }[] }> {
  const plan = planOccurrenceInserts(occurrences, opts)
  const result = await settleAll(plan.toCreate, save)
  return { ...plan, toCreate: result.succeeded, failed: result.failed }
}
