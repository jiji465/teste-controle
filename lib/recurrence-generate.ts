import type { Obligation, Tax, Service, RecurrenceType, WeekendRule } from "./types"
import { buildSafeDate, adjustForWeekend } from "./date-utils"
import {
  deterministicAutoId,
  generateObligationForPeriod,
  generateTaxForPeriod,
  getCurrentPeriod,
} from "./recurrence-engine"

/**
 * Geração ANTECIPADA de recorrências ("gerar tudo de uma vez até a data").
 *
 * Diferente do motor diário em `auto-recurrence.ts` (que só gera até o mês
 * corrente, um passo por dia), aqui geramos TODAS as ocorrências de uma vez,
 * do item base até a data final ("Repetir até" / "Gerar até") escolhida pelo
 * usuário — que passa a ser OBRIGATÓRIA quando há recorrência.
 *
 * Todos os clones usam ids DETERMINÍSTICOS (via deterministicAutoId), então
 * salvar o mesmo item de novo (edição) faz upsert nos mesmos registros em vez
 * de multiplicar. Os clones de obrigação/guia recebem parentObligationId /
 * generatedFor, então o motor diário os reconhece como "já gerados" e não
 * duplica.
 */

/** Passo em meses de cada tipo de recorrência. */
function stepMonths(recurrence: RecurrenceType, interval?: number): number {
  switch (recurrence) {
    case "monthly":
      return Math.max(1, interval ?? 1)
    case "bimonthly":
      return 2
    case "quarterly":
      return 3
    case "semiannual":
      return 6
    case "annual":
      return 12
    case "custom":
      return Math.max(1, interval ?? 1)
    default:
      return 1
  }
}

/** Guarda de segurança: nunca gera mais que isso, mesmo com datas absurdas. */
const MAX_OCCURRENCES = 240

/** "YYYY-MM-DD" a partir de um Date local (sem shift de timezone). */
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Gera as ocorrências de uma OBRIGAÇÃO recorrente da competência base até o
 * mês da data final. Não inclui a própria obrigação base (essa já é salva à
 * parte). Retorna [] se não houver recorrência ou data final.
 */
export function buildRecurringObligations(master: Obligation): Obligation[] {
  if (!master.recurrence || !master.recurrenceEndDate) return []
  const basePeriod = master.competencyMonth || getCurrentPeriod()
  const endPeriod = master.recurrenceEndDate.slice(0, 7) // "YYYY-MM"
  const step = stepMonths(master.recurrence, master.recurrenceInterval)

  const out: Obligation[] = []
  let [year, month] = basePeriod.split("-").map(Number)
  let guard = 0
  while (guard++ < MAX_OCCURRENCES) {
    month += step
    while (month > 12) {
      month -= 12
      year += 1
    }
    const period = `${year}-${String(month).padStart(2, "0")}`
    if (period > endPeriod) break
    out.push(generateObligationForPeriod(master, period))
  }
  return out
}

/**
 * Gera as ocorrências de uma GUIA (Tax) recorrente da competência base até o
 * mês da data final. Não inclui a guia base.
 */
export function buildRecurringTaxes(master: Tax): Tax[] {
  if (!master.recurrence || !master.recurrenceEndDate) return []
  const basePeriod = master.competencyMonth || getCurrentPeriod()
  const endPeriod = master.recurrenceEndDate.slice(0, 7)
  const step = stepMonths(master.recurrence, master.recurrenceInterval)

  const out: Tax[] = []
  let [year, month] = basePeriod.split("-").map(Number)
  let guard = 0
  while (guard++ < MAX_OCCURRENCES) {
    month += step
    while (month > 12) {
      month -= 12
      year += 1
    }
    const period = `${year}-${String(month).padStart(2, "0")}`
    if (period > endPeriod) break
    out.push(generateTaxForPeriod(master, period))
  }
  return out
}

/**
 * Gera as ocorrências de um SERVIÇO recorrente.
 *
 * Serviços usam DATA única (não competência), então avançamos a data a partir
 * da data-base DIGITADA (`baseYmd`, antes do ajuste de fim de semana) e
 * reaplicamos a regra de fim de semana em cada ocorrência. Não inclui o
 * serviço base. Os clones viram avulsos (recurrence limpa) — quem dispara a
 * geração é sempre o formulário, então clone não gera clone.
 *
 * @param master  serviço base (com recurrence + recurrenceEndDate)
 * @param baseYmd data digitada no formulário ("YYYY-MM-DD"), antes do ajuste
 */
export function buildRecurringServices(master: Service, baseYmd: string): Service[] {
  if (!master.recurrence || !master.recurrenceEndDate) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseYmd)) return []
  const step = stepMonths(master.recurrence, master.recurrenceInterval)
  const rule: WeekendRule = master.weekendRule ?? "postpone"
  const [by, bm, bd] = baseYmd.split("-").map(Number)
  const end = master.recurrenceEndDate // "YYYY-MM-DD"

  const out: Service[] = []
  let k = 1
  let guard = 0
  while (guard++ < MAX_OCCURRENCES) {
    // buildSafeDate lida com overflow de mês (bm-1 + step*k pode passar de 11)
    // e clampa o dia pro último dia válido do mês (ex: dia 31 em fev).
    const raw = buildSafeDate(by, bm - 1 + step * k, bd)
    const rawYmd = toYmd(raw)
    if (rawYmd > end) break // a ocorrência "pertence" à data crua; compara antes do ajuste
    const adjusted = rule === "keep" ? raw : adjustForWeekend(raw, rule)
    out.push({
      ...master,
      id: deterministicAutoId(master.id, rawYmd),
      dueDate: toYmd(adjusted),
      status: "pending",
      completedAt: undefined,
      completedBy: undefined,
      // Clone é avulso: não repete de novo (evita cascata) e some da lógica
      // de geração do formulário.
      recurrence: undefined,
      recurrenceInterval: undefined,
      recurrenceEndDate: undefined,
      autoGenerate: false,
      createdAt: new Date().toISOString(),
      history: [
        {
          id: crypto.randomUUID(),
          action: "created",
          description: `Serviço gerado automaticamente para ${rawYmd}`,
          timestamp: new Date().toISOString(),
          user: "Sistema",
        },
      ],
    })
    k++
  }
  return out
}
