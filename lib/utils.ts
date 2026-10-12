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

/** Mensagem legível de um erro desconhecido (Error, PostgrestError, string). */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message
  }
  return fallback
}
