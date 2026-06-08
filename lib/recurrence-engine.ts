import type { Obligation, Tax, RecurrenceType } from "./types"
import { adjustForWeekend, buildSafeDate } from "./date-utils"

/**
 * @deprecated Função substituída por `calculateNextDueDate` em
 * `recurrence-utils.ts`, que usa buildSafeDate (não estoura no dia 31 em
 * fevereiro) e respeita `dueMonth` para anuais. Mantida só pra não quebrar
 * imports externos. Não usar em código novo.
 */
export function getNextDueDate(
  currentDate: Date,
  dueDay: number,
  recurrence: RecurrenceType,
  recurrenceInterval?: number,
  weekendRule?: "postpone" | "anticipate" | "keep",
): Date {
  let year = currentDate.getFullYear()
  let monthIdx = currentDate.getMonth()

  switch (recurrence) {
    case "monthly":
      monthIdx += 1
      break
    case "bimonthly":
      monthIdx += 2
      break
    case "quarterly":
      monthIdx += 3
      break
    case "semiannual":
      monthIdx += 6
      break
    case "annual":
      year += 1
      break
    case "custom":
      monthIdx += recurrenceInterval || 1
      break
  }

  const next = buildSafeDate(year, monthIdx, dueDay)
  return weekendRule ? adjustForWeekend(next, weekendRule) : next
}

/** ID determinístico (UUID v5) pra itens gerados pelo motor de recorrência.
 *
 *  ⚠️ BUG CORRIGIDO: antes usava `auto-${originalId}-${period}`, que NÃO é um
 *  UUID válido. As colunas `id` de taxes/obligations são UUID no Postgres,
 *  então o Supabase rejeitava o INSERT com HTTP 400 ("invalid input syntax
 *  for type uuid") — o motor caía em loop, gerando os erros "[db] Error
 *  saving tax" / "Erro ao gerar recorrências" repetidos no console.
 *
 *  A solução é um UUID v5 (namespace + nome): a partir de `originalId:period`
 *  geramos SEMPRE o mesmo UUID. Isso mantém a idempotência (duas execuções
 *  concorrentes salvam o mesmo id → upsert deduplica) E produz um UUID válido
 *  que o Postgres aceita. */
export function deterministicAutoId(originalId: string, period: string): string {
  return uuidV5(`${originalId}:${period}`, RECURRENCE_NAMESPACE)
}

/** Namespace fixo (um UUID qualquer) pra derivar os UUIDs v5 do motor. */
const RECURRENCE_NAMESPACE = "6f1b2c3d-4e5f-5a6b-8c9d-0e1f2a3b4c5d"

/** UUID v5 (RFC 4122) — hash SHA-1 de namespace+nome, sem dependência externa.
 *  Síncrono, usa um SHA-1 puro local (entradas curtas, custo desprezível). */
function uuidV5(name: string, namespace: string): string {
  const nsBytes = uuidToBytes(namespace)
  const nameBytes = Array.from(new TextEncoder().encode(name))
  const hash = sha1(nsBytes.concat(nameBytes)) // 20 bytes
  const b = hash.slice(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50 // versão 5
  b[8] = (b[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = b.map((x) => x.toString(16).padStart(2, "0"))
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  )
}

function uuidToBytes(uuid: string): number[] {
  const hex = uuid.replace(/-/g, "")
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16))
  return bytes
}

/** SHA-1 puro (retorna 20 bytes). Implementação compacta, sem libs. */
function sha1(bytes: number[]): number[] {
  const rotl = (n: number, s: number) => ((n << s) | (n >>> (32 - s))) >>> 0
  const ml = bytes.length * 8
  const msg = bytes.slice()
  msg.push(0x80)
  while (msg.length % 64 !== 56) msg.push(0)
  // comprimento em 64 bits big-endian (suportamos só < 2^32 bits, ok aqui)
  for (let i = 7; i >= 0; i--) msg.push((ml / Math.pow(2, i * 8)) & 0xff)

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0
  for (let i = 0; i < msg.length; i += 64) {
    const w = new Array(80)
    for (let j = 0; j < 16; j++) {
      w[j] =
        (msg[i + j * 4] << 24) |
        (msg[i + j * 4 + 1] << 16) |
        (msg[i + j * 4 + 2] << 8) |
        msg[i + j * 4 + 3]
      w[j] >>>= 0
    }
    for (let j = 16; j < 80; j++) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1)
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let j = 0; j < 80; j++) {
      let f: number, k: number
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999 }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1 }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else { f = b ^ c ^ d; k = 0xca62c1d6 }
      const t = (rotl(a, 5) + f + e + k + w[j]) >>> 0
      e = d; d = c; c = rotl(b, 30); b = a; a = t
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0
  }
  const out: number[] = []
  for (const h of [h0, h1, h2, h3, h4]) {
    out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff)
  }
  return out
}

export function generateObligationForPeriod(
  obligation: Obligation,
  period: string, // formato: "2025-01"
): Obligation {
  return {
    ...obligation,
    id: deterministicAutoId(obligation.id, period),
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
    parentObligationId: obligation.id,
    generatedFor: period,
    competencyMonth: period,
    // Clone não gera outros clones (já é filtrado por parentObligationId, mas
    // reforçamos pra consistência com as guias).
    autoGenerate: false,
    createdAt: new Date().toISOString(),
    history: [
      {
        id: crypto.randomUUID(),
        action: "created",
        description: `Obrigação gerada automaticamente para ${period}`,
        timestamp: new Date().toISOString(),
        user: "Sistema",
      },
    ],
  }
}

export function generateTaxForPeriod(
  tax: Tax,
  period: string, // formato: "2025-01"
): Tax {
  return {
    ...tax,
    id: deterministicAutoId(tax.id, period),
    status: "pending",
    completedAt: undefined,
    completedBy: undefined,
    realizationDate: undefined,
    competencyMonth: period,
    // Clone NÃO é candidato a gerar outros clones (evita cascata). O motor
    // só clona originais com autoGenerate=true.
    autoGenerate: false,
    createdAt: new Date().toISOString(),
    history: [
      {
        id: crypto.randomUUID(),
        action: "created",
        description: `Imposto gerado automaticamente para ${period}`,
        timestamp: new Date().toISOString(),
        user: "Sistema",
      },
    ],
  }
}

// generateInstallmentForPeriod removida: parcelamentos são UM registro
// único com contador interno (currentInstallment), avançado pelo helper
// payCurrentInstallment em features/installments/actions.ts. Não precisa
// gerar registros mensais.

export function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function getNextPeriod(currentPeriod: string): string {
  const [year, month] = currentPeriod.split("-").map(Number)
  const date = new Date(year, month - 1, 1)
  date.setMonth(date.getMonth() + 1)
  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0")
  return `${nextYear}-${nextMonth}`
}
