import type { Service, WeekendRule } from "@/lib/types"
import type { ServiceFormData } from "@/features/services/schemas"
import { adjustForWeekend, buildSafeDate } from "@/lib/date-utils"
import { normalizeRecurrenceInterval } from "@/lib/recurrence-generate"
import { completionFields, type FormMappingOptions } from "@/lib/form-completion"

/** Aplica a regra de fim de semana numa string "AAAA-MM-DD" e devolve outra
 *  string "AAAA-MM-DD". Usa buildSafeDate pra evitar problemas de timezone. */
export function applyWeekendRuleToYmd(ymd: string, rule: WeekendRule): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  if (rule === "keep") return ymd
  const [y, m, d] = ymd.split("-").map(Number)
  const adjusted = adjustForWeekend(buildSafeDate(y, m - 1, d), rule)
  return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, "0")}-${String(adjusted.getDate()).padStart(2, "0")}`
}

/**
 * Monta o serviço a gravar a partir do formulário. Parte do ORIGINAL
 * (spread) e mantém o histórico — antes, editar gravava history = [].
 * A data salva é a EFETIVA (após o ajuste de fim de semana/feriado).
 */
export function serviceFromForm(
  data: ServiceFormData,
  original: Service | undefined,
  opts: FormMappingOptions = {},
): Service {
  const now = opts.now ?? new Date().toISOString()
  return {
    ...original,
    id: data.id || original?.id || crypto.randomUUID(),
    name: data.name,
    clientId: data.clientId,
    description: data.description || undefined,
    category: data.category,
    dueDate: applyWeekendRuleToYmd(data.dueDate, data.weekendRule),
    weekendRule: data.weekendRule,
    status: data.status,
    priority: data.priority,
    recurrence: data.recurrence,
    recurrenceInterval: normalizeRecurrenceInterval(data.recurrence, data.recurrenceInterval),
    recurrenceEndDate: data.recurrenceEndDate || undefined,
    autoGenerate: data.autoGenerate,
    notes: data.notes || undefined,
    tags: data.tags || [],
    ...completionFields(data.status, original, {
      now,
      userName: opts.userName,
      formCompletedAt: data.completedAt,
      formCompletedBy: data.completedBy,
    }),
    history: original?.history ?? [],
    createdAt: data.createdAt || original?.createdAt || now,
  }
}
