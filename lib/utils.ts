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

/** Compara CNPJ ignorando pontuação. */
export function matchesCnpj(cnpj: string | null | undefined, query: string): boolean {
  const onlyDigitsQuery = query.replace(/\D/g, '')
  if (!cnpj) return false
  if (onlyDigitsQuery.length > 0 && cnpj.replace(/\D/g, '').includes(onlyDigitsQuery)) return true
  // Se a query não tem dígitos, cai pra matchesText (caso de pesquisa textual)
  return false
}
