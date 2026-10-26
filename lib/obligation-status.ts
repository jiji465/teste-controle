/**
 * Helpers pra calcular status "efetivo" de obrigações/impostos/parcelamentos.
 *
 * Problema: o status no banco pode ser "pending" mas a data de vencimento
 * já passou — várias telas usam lógicas ligeiramente diferentes pra detectar
 * isso (`<=` vs `<`, com ou sem normalizar pro início do dia, etc).
 * Resultado: gráfico mostrava "Atrasadas: 0" mesmo com itens vencidos.
 *
 * Centraliza isso aqui.
 */

import { isOverdue, parseLocalDate } from "./date-utils"

type Statusable = {
  status: string
  calculatedDueDate?: string | Date
}

/**
 * Retorna o status "efetivo" — se o item está pending mas a data já passou,
 * trata como "overdue". Use isso em vez de `o.status` quando quiser refletir
 * o que o usuário deveria ver (não o que está literalmente no banco).
 *
 * Ex: status="pending" mas calculatedDueDate=2026-04-20 (passou) → "overdue"
 * Ex: status="completed" → "completed" (sempre, independente da data)
 * Ex: status="pending" e dueDate=hoje → "pending" (vence hoje, mas não passou)
 */
export function effectiveStatus<T extends Statusable>(item: T): T["status"] {
  // "Em andamento" também atrasa: começar a tarefa não suspende o prazo.
  if (item.status !== "pending" && item.status !== "in_progress") return item.status
  if (!item.calculatedDueDate) return item.status
  return isOverdue(item.calculatedDueDate) ? "overdue" : item.status
}

/**
 * "Crítico agora" = atrasado OU vencendo hoje. Use isso pra alertas
 * acionáveis ("itens pra resolver hoje"), diferente de `effectiveStatus`
 * que é mais conservador (só passou da data).
 */
export function isCriticalNow<T extends Statusable>(item: T): boolean {
  if (item.status === "completed") return false
  if (item.status === "overdue") return true
  if (!item.calculatedDueDate) return false
  // Compara dia inteiro: vence hoje OU já passou
  const due = parseLocalDate(item.calculatedDueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due <= today
}

// ─── Cartões de status x lista ───────────────────────────────────────────────
// Cada item cai em EXATAMENTE um balde (soma dos cartões = "Todos"). Mesma
// regra de effectiveStatus: pendente ou em andamento com prazo vencido =
// atrasado. Antes, "em andamento" vencido contava em "Em andamento" E em
// "Atrasadas" em /obrigacoes e só em "Em andamento" em /impostos.

export type StatusBucket = "pending" | "in_progress" | "completed" | "overdue"
export type StatusTab = "all" | StatusBucket

const BUCKETS: readonly StatusBucket[] = ["pending", "in_progress", "completed", "overdue"]

export function statusBucket(item: Statusable, today: Date = new Date()): StatusBucket {
  const s = item.status as StatusBucket
  if (s === "completed" || s === "overdue") return s
  const base: StatusBucket = s === "in_progress" ? "in_progress" : "pending"
  if (!item.calculatedDueDate) return base
  const due = parseLocalDate(item.calculatedDueDate)
  due.setHours(0, 0, 0, 0)
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  return due < t ? "overdue" : base
}

export function countByStatus(items: Statusable[], today: Date = new Date()): Record<StatusTab, number> {
  const counts: Record<StatusTab, number> = { all: items.length, pending: 0, in_progress: 0, completed: 0, overdue: 0 }
  for (const it of items) counts[statusBucket(it, today)]++
  return counts
}

export function filterByStatusTab<T extends Statusable>(
  items: T[],
  tab: string | null | undefined,
  today: Date = new Date(),
): T[] {
  if (!tab || !BUCKETS.includes(tab as StatusBucket)) return items
  return items.filter((it) => statusBucket(it, today) === tab)
}
