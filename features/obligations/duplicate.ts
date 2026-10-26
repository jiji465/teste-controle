import type { Obligation } from "@/lib/types"
import { addMonthsToPeriod, stepMonths } from "@/lib/recurrence-generate"
import { getCurrentPeriod } from "@/lib/recurrence-engine"

/**
 * "Duplicar obrigação": cria a cópia na PRÓXIMA competência (passo da
 * periodicidade), nunca idêntica à original. Pula competências em que o
 * cliente já tem a mesma obrigação; recusa se a competência destino estiver
 * fechada. A cópia é avulsa (não gera série nem pertence à série original).
 */
export function duplicateObligationToNextPeriod(
  original: Obligation,
  existing: Obligation[],
  opts: { now?: string; isPeriodLocked?: (period: string) => boolean } = {},
): { ok: true; obligation: Obligation } | { ok: false; reason: string } {
  const now = opts.now ?? new Date().toISOString()
  const step = stepMonths(original.recurrence ?? "monthly", original.recurrenceInterval)
  const taken = new Set(
    existing
      .filter((o) => o.clientId === original.clientId && o.name.toLowerCase() === original.name.toLowerCase())
      .map((o) => o.competencyMonth),
  )
  let period = addMonthsToPeriod(original.competencyMonth || getCurrentPeriod(), step)
  for (let guard = 0; taken.has(period) && guard < 120; guard++) period = addMonthsToPeriod(period, step)

  if (opts.isPeriodLocked?.(period)) {
    return { ok: false, reason: `A competência ${period} está fechada. Reabra-a para duplicar esta obrigação.` }
  }

  return {
    ok: true,
    obligation: {
      ...original,
      id: crypto.randomUUID(),
      competencyMonth: period,
      status: "pending",
      completedAt: undefined,
      completedBy: undefined,
      realizationDate: undefined,
      protocol: undefined,
      attachments: [],
      parentObligationId: undefined,
      generatedFor: undefined,
      autoGenerate: false,
      createdAt: now,
      history: [
        {
          id: crypto.randomUUID(),
          action: "created",
          description: `Duplicada de "${original.name}"${original.competencyMonth ? ` (${original.competencyMonth})` : ""} para ${period}`,
          timestamp: now,
        },
      ],
    },
  }
}
