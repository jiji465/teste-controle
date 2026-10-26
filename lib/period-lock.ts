/**
 * Competência fechada — regras compartilhadas.
 *
 * Com Supabase, quem impõe o fechamento é o trigger `enforce_period_lock`
 * (scripts/020). Em modo local (sem banco) não há trigger, então as funções
 * de save/delete chamam `assertLocalWriteAllowed` com a mesma regra.
 */

/** "YYYY-MM" da competência de um item: competencyMonth ou, sem ela, o mês do dueDate (serviços). */
export function itemCompetency(item: { competencyMonth?: string | null; dueDate?: string | null }): string | null {
  const c = item.competencyMonth || item.dueDate
  return c && /^\d{4}-\d{2}/.test(c) ? c.slice(0, 7) : null
}

export function lockedPeriodError(period: string, kind: "alterar" | "incluir"): Error {
  return new Error(
    kind === "alterar"
      ? `Competência ${period} está fechada. Reabra a competência para alterar este item.`
      : `Competência ${period} está fechada. Reabra a competência para incluir itens nela.`,
  )
}

/**
 * Mesma regra do trigger: gravar igual ao que já está é permitido; alterar ou
 * excluir item de competência fechada, ou incluir/mover um item para ela, não.
 * @param previous item gravado hoje (undefined = inclusão)
 * @param next item a gravar (undefined = exclusão)
 */
export function assertLocalWriteAllowed<T extends { competencyMonth?: string | null; dueDate?: string | null }>(
  previous: T | undefined,
  next: T | undefined,
  lockedPeriods: readonly string[],
): void {
  if (previous && next && JSON.stringify(previous) === JSON.stringify(next)) return
  const locked = new Set(lockedPeriods)
  const oldComp = previous ? itemCompetency(previous) : null
  if (oldComp && locked.has(oldComp)) throw lockedPeriodError(oldComp, "alterar")
  const newComp = next ? itemCompetency(next) : null
  if (newComp && locked.has(newComp)) throw lockedPeriodError(newComp, "incluir")
}
