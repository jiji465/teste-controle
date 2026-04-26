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

import { isOverdue } from "./date-utils"

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
  if (item.status !== "pending") return item.status
  if (!item.calculatedDueDate) return item.status
  return isOverdue(item.calculatedDueDate) ? "overdue" : "pending"
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
  const due = new Date(item.calculatedDueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due <= today
}
