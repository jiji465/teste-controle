import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normaliza texto para busca tolerante: lowercase + remove acentos. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Verifica se `haystack` contém `needle` ignorando acentos e maiúsculas. */
export function matchesText(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true
  return normalizeText(haystack).includes(normalizeText(needle))
}

/** Compara CNPJ ignorando pontuação (aceita CNPJ alfanumérico). */
export function matchesCnpj(cnpj: string | null | undefined, query: string): boolean {
  if (!cnpj) return false
  // Só busca por CNPJ quando a consulta tem dígito (senão é busca por nome)
  if (!/\d/.test(query)) return false
  const q = query.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (q.length > 0 && cnpj.toUpperCase().replace(/[^0-9A-Z]/g, '').includes(q)) return true
  // Se a query não tem dígitos, cai pra matchesText (caso de pesquisa textual)
  return false
}

/** Busca de empresa: nome/fantasia/e-mail tolerante a acento e maiúsculas;
 *  CNPJ/CPF ignorando pontuação (aceita alfanumérico e digitado sem máscara). */
export function matchesClientSearch(
  client: { name: string; tradeName?: string | null; cnpj?: string | null; email?: string | null },
  query: string,
): boolean {
  const q = query.trim()
  if (!q) return true
  return (
    matchesText(client.name, q) ||
    matchesText(client.tradeName, q) ||
    matchesText(client.email, q) ||
    matchesCnpj(client.cnpj, q)
  )
}

/** "1 guia" / "3 guias" — contagem com concordância de número. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Mensagem legível de um erro desconhecido (Error, PostgrestError, string). */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message
  }
  return fallback
}
