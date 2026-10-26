import type { Installment } from "@/lib/types"
import type { InstallmentFormData } from "@/features/installments/schemas"
import { normalizeRecurrenceInterval } from "@/lib/recurrence-generate"
import { completionFields, type FormMappingOptions } from "@/lib/form-completion"

/**
 * Monta o parcelamento a gravar a partir do formulário. Parte do ORIGINAL
 * (spread): as parcelas pagas (paidInstallments), responsável, valores etc.
 * não estão no formulário — antes, editar gravava paid_installments = [] e o
 * contador ficava avançado sem nenhum registro de pagamento.
 */
export function installmentFromForm(
  data: InstallmentFormData,
  original: Installment | undefined,
  opts: FormMappingOptions = {},
): Installment {
  const now = opts.now ?? new Date().toISOString()
  return {
    ...original,
    id: data.id || original?.id || crypto.randomUUID(),
    name: data.name,
    description: data.description || undefined,
    clientId: data.clientId,
    taxId: data.taxId === "none" || !data.taxId ? undefined : data.taxId,
    installmentCount: data.installmentCount,
    currentInstallment: data.currentInstallment,
    dueDay: data.dueDay,
    firstDueDate: data.firstDueDate,
    weekendRule: data.weekendRule,
    status: data.status,
    priority: data.priority,
    protocol: data.protocol || undefined,
    notes: data.notes || undefined,
    createdAt: data.createdAt || original?.createdAt || now,
    ...completionFields(data.status, original, { now, userName: opts.userName }),
    history: original?.history || [],
    paidInstallments: original?.paidInstallments ?? [],
    tags: data.tags || [],
    autoGenerate: data.autoGenerate,
    recurrence: data.recurrence,
    recurrenceInterval: normalizeRecurrenceInterval(data.recurrence, data.recurrenceInterval),
  }
}
