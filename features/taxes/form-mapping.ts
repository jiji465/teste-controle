import type { Tax, TaxRegime } from "@/lib/types"
import type { TaxFormData } from "@/features/taxes/schemas"
import { normalizeRecurrenceInterval } from "@/lib/recurrence-generate"
import { completionFields, type FormMappingOptions } from "@/lib/form-completion"

/**
 * Monta a guia a gravar a partir do formulário. Parte do ORIGINAL (spread):
 * assignedTo, histórico, código da receita etc. não estão no formulário e
 * eram perdidos no upsert ao editar.
 */
export function taxFromForm(data: TaxFormData, original: Tax | undefined, opts: FormMappingOptions = {}): Tax {
  const now = opts.now ?? new Date().toISOString()
  return {
    ...original,
    id: data.id || original?.id || crypto.randomUUID(),
    name: data.name,
    clientId: data.clientId,
    scope: data.scope,
    description: data.description || undefined,
    competencyMonth: data.competencyMonth || undefined,
    dueDay: data.dueDay && data.dueDay > 0 ? Number(data.dueDay) : undefined,
    // dueMonth só faz sentido pra anual; ignora pra outras recorrências
    dueMonth: data.recurrence === "annual" && data.dueMonth ? Number(data.dueMonth) : undefined,
    status: data.status,
    priority: data.priority,
    recurrence: data.recurrence,
    recurrenceInterval: normalizeRecurrenceInterval(data.recurrence, data.recurrenceInterval),
    recurrenceEndDate: data.recurrenceEndDate || undefined,
    autoGenerate: data.autoGenerate,
    weekendRule: data.weekendRule,
    protocol: data.protocol || undefined,
    notes: data.notes || undefined,
    tags: data.tags,
    applicableRegimes: data.applicableRegimes as TaxRegime[],
    ...completionFields(data.status, original, {
      now,
      userName: opts.userName,
      formCompletedAt: data.completedAt,
      formCompletedBy: data.completedBy,
    }),
    realizationDate: data.status === "completed" ? original?.realizationDate : undefined,
    history: original?.history ?? [],
    createdAt: data.createdAt || original?.createdAt || now,
  }
}
