import type { Obligation, TaxRegime } from "@/lib/types"
import type { ObligationFormData } from "@/features/obligations/schemas"
import { normalizeRecurrenceInterval } from "@/lib/recurrence-generate"
import { completionFields, type FormMappingOptions } from "@/lib/form-completion"

/**
 * Monta a obrigação a gravar a partir do formulário. Parte do ORIGINAL
 * (spread): campos que não estão no formulário — source, templateId,
 * assignedTo, taxId, amount… — eram perdidos no upsert ao editar.
 */
export function obligationFromForm(
  data: ObligationFormData,
  original: Obligation | undefined,
  opts: FormMappingOptions = {},
): Obligation {
  const now = opts.now ?? new Date().toISOString()
  const completion = completionFields(data.status, original, { now, userName: opts.userName })
  return {
    ...original,
    id: data.id || original?.id || crypto.randomUUID(),
    name: data.name,
    category: original?.category || "other",
    description: data.description || undefined,
    clientId: data.clientId,
    scope: data.scope,
    applicableRegimes: (data.applicableRegimes as TaxRegime[]) || [],
    dueDay: Number(data.dueDay),
    // dueMonth só faz sentido pra anual; ignora pra outras recorrências
    dueMonth: data.recurrence === "annual" && data.dueMonth ? Number(data.dueMonth) : undefined,
    competencyMonth: data.competencyMonth || undefined,
    frequency: data.frequency,
    recurrence: data.recurrence,
    recurrenceInterval: normalizeRecurrenceInterval(data.recurrence, data.recurrenceInterval),
    recurrenceEndDate: data.recurrenceEndDate || undefined,
    autoGenerate: data.autoGenerate,
    weekendRule: data.weekendRule,
    status: data.status,
    priority: data.priority,
    protocol: data.protocol || undefined,
    notes: data.notes || undefined,
    createdAt: data.createdAt || original?.createdAt || now,
    ...completion,
    realizationDate: data.status === "completed" ? original?.realizationDate : undefined,
    attachments: original?.attachments || [],
    history: [
      ...(original?.history || []),
      {
        id: crypto.randomUUID(),
        action: original ? "updated" : "created",
        description: original ? "Obrigação atualizada" : "Obrigação criada",
        timestamp: now,
      },
    ],
    parentObligationId: original?.parentObligationId,
    generatedFor: original?.generatedFor,
    tags: data.tags || [],
  }
}
