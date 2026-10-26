import { errorMessage } from "./utils"

/**
 * Ações em lote: roda TODAS as operações (Promise.allSettled) e devolve o que
 * deu certo e o que falhou. Com Promise.all, a 1ª falha rejeitava o lote,
 * nada era avisado e a lista não era recarregada — embora parte dos itens já
 * tivesse sido gravada.
 */
export type BulkResult<T> = {
  succeeded: T[]
  failed: { item: T; error: unknown }[]
}

export async function settleAll<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<BulkResult<T>> {
  // async wrapper: um throw síncrono vira rejeição em vez de derrubar o lote
  const results = await Promise.allSettled(items.map(async (item) => fn(item)))
  const out: BulkResult<T> = { succeeded: [], failed: [] }
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.succeeded.push(items[i])
    else out.failed.push({ item: items[i], error: r.reason })
  })
  return out
}

/**
 * Roda uma ação em lote: itens em competência fechada (isLocked) são
 * ignorados antes de começar; o restante roda com allSettled. Devolve o
 * resultado e o toast pronto ("X concluídas, Y falharam (motivo), Z ignorados").
 */
export async function runBulk<T>(
  items: T[],
  action: (item: T) => Promise<unknown>,
  opts: { done: string | { one: string; many: string }; isLocked?: (item: T) => boolean },
): Promise<{ result: BulkResult<T>; locked: T[]; toast: BulkToast }> {
  const locked = opts.isLocked ? items.filter((i) => opts.isLocked!(i)) : []
  const allowed = opts.isLocked ? items.filter((i) => !opts.isLocked!(i)) : items
  const result = await settleAll(allowed, action)
  const toast = bulkResultToast(
    result,
    opts.done,
    locked.length > 0 ? { count: locked.length, reason: "competência fechada" } : undefined,
  )
  return { result, locked, toast }
}

export type BulkToast = { kind: "success" | "warning" | "error"; message: string }

/**
 * Mensagem do toast de um lote: "3 concluídas, 1 falhou (motivo)".
 * @param done particípio concordando com o item (ex.: { one: "concluída", many: "concluídas" })
 * @param skipped itens ignorados antes de rodar (ex.: competência fechada)
 */
export function bulkResultToast(
  result: BulkResult<unknown>,
  done: string | { one: string; many: string },
  skipped?: { count: number; reason: string },
): BulkToast {
  const ok = result.succeeded.length
  const fail = result.failed.length
  const doneWord = typeof done === "string" ? done : ok === 1 ? done.one : done.many
  const parts: string[] = [`${ok} ${doneWord}`]
  if (fail > 0) {
    const reasons = Array.from(new Set(result.failed.map((f) => errorMessage(f.error, "erro desconhecido"))))
    const reason = reasons.slice(0, 2).join("; ") + (reasons.length > 2 ? "; …" : "")
    parts.push(`${fail} ${fail > 1 ? "falharam" : "falhou"} (${reason})`)
  }
  if (skipped && skipped.count > 0) {
    parts.push(`${skipped.count} ${skipped.count > 1 ? "ignorados" : "ignorado"} (${skipped.reason})`)
  }
  const kind: BulkToast["kind"] = fail === 0 ? (skipped && skipped.count > 0 ? "warning" : "success") : ok === 0 ? "error" : "warning"
  return { kind, message: parts.join(", ") }
}
