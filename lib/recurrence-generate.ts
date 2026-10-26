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

/** Passo em meses de cada tipo de recorrência. O `interval` só vale para
 *  "custom" — um valor residual (usuário escolheu Personalizado e voltou para
 *  Mensal) não pode fazer uma série mensal pular competências. */
export function stepMonths(recurrence: RecurrenceType, interval?: number): number {
  switch (recurrence) {
    case "monthly":
      return 1
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

/** Intervalo a GRAVAR: só existe para recorrência "custom" (padrão 1). */
export function normalizeRecurrenceInterval(
  recurrence: RecurrenceType | undefined | null,
  interval: number | undefined | null,
): number | undefined {
  if (recurrence !== "custom") return undefined
  const n = Number(interval)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

/** Guarda de segurança: nunca gera mais que isso, mesmo com datas absurdas. */
const MAX_OCCURRENCES = 240

/** "YYYY-MM" + n meses → "YYYY-MM". */
export function addMonthsToPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number)
  const idx = y * 12 + (m - 1) + months
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`
}

/**
 * Competências de uma série recorrente APÓS a base: base+passo, base+2·passo…
 * até `untilPeriod` (inclusive). Ex: trimestral a partir de 2026-01 até
 * 2026-12 → 2026-04, 2026-07, 2026-10.
 */
export function recurringPeriods(
  basePeriod: string,
  recurrence: RecurrenceType,
  untilPeriod: string,
  interval?: number,
): string[] {
  const step = stepMonths(recurrence, interval)
  const out: string[] = []
  for (let k = 1; k <= MAX_OCCURRENCES; k++) {
    const period = addMonthsToPeriod(basePeriod, step * k)
    if (period > untilPeriod) break
    out.push(period)
  }
  return out
}

/** "YYYY-MM-DD" a partir de um Date local (sem shift de timezone). */
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type RecurringMaster = {
  recurrence?: RecurrenceType
  recurrenceEndDate?: string
  recurrenceInterval?: number
  competencyMonth?: string
}

/** Ocorrências de uma série (obrigação ou guia) da competência base até o mês
 *  da data final. Não inclui o item base (salvo à parte). */
function buildRecurring<T extends RecurringMaster>(master: T, generate: (m: T, period: string) => T): T[] {
  if (!master.recurrence || !master.recurrenceEndDate) return []
  const basePeriod = master.competencyMonth || getCurrentPeriod()
  const endPeriod = master.recurrenceEndDate.slice(0, 7) // "YYYY-MM"
  return recurringPeriods(basePeriod, master.recurrence, endPeriod, master.recurrenceInterval).map((p) =>
    generate(master, p),
  )
}

/** Ocorrências de uma OBRIGAÇÃO recorrente (sem a base). */
export function buildRecurringObligations(master: Obligation): Obligation[] {
  return buildRecurring(master, generateObligationForPeriod)
}

/** Ocorrências de uma GUIA (Tax) recorrente (sem a base). */
export function buildRecurringTaxes(master: Tax): Tax[] {
  return buildRecurring(master, generateTaxForPeriod)
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
 * Id da ocorrência = mestre + MÊS da ocorrência ("YYYY-MM"). Antes era a data
 * crua ("YYYY-MM-DD"): ao criar, a base era a data digitada (ex.: sábado 07);
 * ao editar, o form recarregava a data JÁ ajustada (segunda 09) → ids novos →
 * ocorrências duplicadas. Ids antigos: ver `legacyServiceOccurrenceIds`.
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
      id: deterministicAutoId(master.id, rawYmd.slice(0, 7)),
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

/**
 * Ids que o esquema ANTIGO (por data crua "YYYY-MM-DD") pode ter dado à
 * ocorrência do mês `period` — usados para reconhecer séries criadas antes da
 * troca para ids por mês e não duplicá-las ao editar.
 */
export function legacyServiceOccurrenceIds(masterId: string, period: string): string[] {
  const ids: string[] = []
  for (let d = 1; d <= 31; d++) ids.push(deterministicAutoId(masterId, `${period}-${String(d).padStart(2, "0")}`))
  return ids
}
