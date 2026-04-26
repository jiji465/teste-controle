import { saveObligation } from "@/features/obligations/services"
import { saveTax } from "@/features/taxes/services"
import { getObligations, getTaxes } from "@/lib/supabase/database"
import type { Client, Tax, Obligation, RecurrenceType } from "@/lib/types"
import type { TemplateItem } from "@/lib/obligation-templates"

export type ApplyTemplateResult = {
  taxesCreated: number
  obligationsCreated: number
  totalSkipped: number
}

export type CompetencyRange = {
  /** Formato "YYYY-MM" — ex: "2026-01" */
  start: string
  /** Formato "YYYY-MM" — ex: "2026-12" */
  end: string
}

const RECURRENCE_STEP_MONTHS: Record<RecurrenceType, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  custom: 1,
}

/**
 * Gera todas as competências (formato "YYYY-MM") entre `start` e `end`,
 * pulando de acordo com o tipo de recorrência.
 *
 * IMPORTANTE — alinhamento fiscal pro trimestral:
 *   Pelo art. 5º da Lei 9.430/96, IRPJ/CSLL trimestral apura por trimestre
 *   civil (1T=jan-mar, 2T=abr-jun, 3T=jul-set, 4T=out-dez) e a competência
 *   se refere ao TRIMESTRE INTEIRO. Convencionamos a competência como o
 *   ÚLTIMO MÊS do trimestre (mar, jun, set, dez), pois o vencimento (último
 *   dia útil do mês seguinte) é calculado a partir dela.
 *
 * Ex: monthly de 2026-01 a 2026-12 → 12 competências
 *     quarterly de 2026-01 a 2026-12 → 4 competências (mar, jun, set, dez)
 *     annual de 2026-01 a 2026-12 → 1 competência (jan)
 */
function generateCompetencies(
  range: CompetencyRange,
  recurrence: RecurrenceType,
  intervalMonths?: number,
): string[] {
  const [startYear, startMonth] = range.start.split("-").map(Number)
  const [endYear, endMonth] = range.end.split("-").map(Number)

  const step =
    recurrence === "custom"
      ? Math.max(1, intervalMonths ?? 1)
      : RECURRENCE_STEP_MONTHS[recurrence]

  const result: string[] = []
  let year = startYear
  let month = startMonth

  // Alinhamento fiscal pro trimestral: avança até o último mês do trimestre
  // que contém startMonth. 1->3, 2->3, 3->3, 4->6, 5->6, 6->6, etc.
  if (recurrence === "quarterly") {
    month = Math.ceil(month / 3) * 3
  }

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`)
    month += step
    while (month > 12) {
      month -= 12
      year += 1
    }
  }

  return result
}

/**
 * Aplica um conjunto de itens de template a uma empresa, gerando uma
 * instância por competência dentro do intervalo informado.
 *
 * - Itens com category="tax_guide" viram **Tax** (Guias de Imposto, /impostos)
 * - Demais categorias viram **Obligation** (Obrigações Acessórias, /obrigacoes)
 *
 * Dedupe é feito por (nome + competência) — não duplica se já existe
 * uma instância para o mesmo cliente naquele mês.
 */
export async function applyTemplateToClient(
  client: Client,
  items: TemplateItem[],
  range: CompetencyRange,
): Promise<ApplyTemplateResult> {
  const now = new Date().toISOString()
  const regime = client.taxRegime

  const [existingObligations, existingTaxes] = await Promise.all([
    getObligations(),
    getTaxes(),
  ])

  // Chaves de dedupe: "nome|competência" (lowercase)
  const existingObligationKeys = new Set(
    existingObligations
      .filter((o) => o.clientId === client.id)
      .map((o) => `${o.name.toLowerCase()}|${o.competencyMonth ?? ""}`),
  )
  const existingTaxKeys = new Set(
    existingTaxes
      .filter((t) => t.clientId === client.id)
      .map((t) => `${t.name.toLowerCase()}|${t.competencyMonth ?? ""}`),
  )

  const taxesToSave: Tax[] = []
  const obligationsToSave: Obligation[] = []
  let totalSkipped = 0

  for (const item of items) {
    const competencies = generateCompetencies(range, item.recurrence, undefined)
    const isTax = item.category === "tax_guide"

    for (const competency of competencies) {
      const key = `${item.name.toLowerCase()}|${competency}`

      if (isTax) {
        if (existingTaxKeys.has(key)) {
          totalSkipped++
          continue
        }
        taxesToSave.push({
          id: crypto.randomUUID(),
          name: item.name,
          clientId: client.id,
          description: item.description,
          scope: item.scope,
          competencyMonth: competency,
          dueDay: item.dueDay,
          recurrence: item.recurrence,
          weekendRule: item.weekendRule,
          priority: item.priority,
          status: "pending",
          applicableRegimes: regime ? [regime] : [],
          autoGenerate: false,
          createdAt: now,
          tags: [],
          history: [],
        })
        existingTaxKeys.add(key)
      } else {
        if (existingObligationKeys.has(key)) {
          totalSkipped++
          continue
        }
        obligationsToSave.push({
          id: crypto.randomUUID(),
          name: item.name,
          description: item.description,
          category: item.category,
          clientId: client.id,
          scope: item.scope,
          applicableRegimes: regime ? [regime] : [],
          dueDay: item.dueDay,
          competencyMonth: competency,
          frequency: item.frequency,
          recurrence: item.recurrence,
          weekendRule: item.weekendRule,
          status: "pending",
          priority: item.priority,
          autoGenerate: false,
          source: item.sourceTaxId ? "tax" : "template",
          createdAt: now,
          history: [],
          tags: [],
          attachments: [],
        })
        existingObligationKeys.add(key)
      }
    }
  }

  await Promise.all([
    ...taxesToSave.map((t) => saveTax(t)),
    ...obligationsToSave.map((o) => saveObligation(o)),
  ])

  return {
    taxesCreated: taxesToSave.length,
    obligationsCreated: obligationsToSave.length,
    totalSkipped,
  }
}

/** Estima quantas instâncias serão criadas (para mostrar prévia no diálogo). */
export function previewApplyTemplate(items: TemplateItem[], range: CompetencyRange) {
  let taxes = 0
  let obligations = 0
  for (const item of items) {
    const competencies = generateCompetencies(range, item.recurrence, undefined)
    if (item.category === "tax_guide") taxes += competencies.length
    else obligations += competencies.length
  }
  return { taxes, obligations, total: taxes + obligations }
}

export function summarizeApplyResult(result: ApplyTemplateResult): string {
  const parts: string[] = []
  if (result.taxesCreated > 0)
    parts.push(`${result.taxesCreated} guia${result.taxesCreated > 1 ? "s" : ""}`)
  if (result.obligationsCreated > 0)
    parts.push(`${result.obligationsCreated} obrigaç${result.obligationsCreated > 1 ? "ões" : "ão"}`)
  if (parts.length === 0) return "Nada criado (todos já existiam)"
  let msg = parts.join(" + ") + " criada(s)"
  if (result.totalSkipped > 0) msg += ` · ${result.totalSkipped} já existiam`
  return msg
}
