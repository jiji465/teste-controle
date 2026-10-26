// Validação real de CNPJ/CPF — algoritmo dos dígitos verificadores da Receita.
// Rejeita formatos como "11.111.111/1111-11" que passavam antes.
//
// CNPJ ALFANUMÉRICO (IN RFB 2.229/2024, novas inscrições a partir de jul/2026):
// as 12 primeiras posições podem ter letras A-Z; os 2 dígitos verificadores
// continuam numéricos. O cálculo é o mesmo módulo 11, usando como valor de
// cada caractere o seu código ASCII − 48 ("0"→0 … "9"→9, "A"→17 … "Z"→42).
// CNPJs só numéricos continuam válidos exatamente como antes.

const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

const charValue = (c: string) => c.charCodeAt(0) - 48

function calculateCheckDigit(base: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + w * charValue(base[i]), 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

/** Mantém só letras/dígitos, em maiúsculas (aceita CNPJ alfanumérico). */
export function normalizeCnpj(input: string | null | undefined): string {
  return (input ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "")
}

export function isValidCNPJ(input: string | null | undefined): boolean {
  if (!input) return false
  const value = normalizeCnpj(input)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value)) return false
  // Rejeita CNPJs com todos os caracteres iguais (11.111.111/1111-11 etc.)
  if (/^(.)\1{13}$/.test(value)) return false

  const base12 = value.slice(0, 12)
  const d1 = calculateCheckDigit(base12, WEIGHTS_1)
  const d2 = calculateCheckDigit(base12 + d1, WEIGHTS_2)
  return d1 === Number(value[12]) && d2 === Number(value[13])
}

export function isValidCPF(input: string | null | undefined): boolean {
  if (!input) return false
  const digits = input.replace(/\D/g, "")
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const dv = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(digits[9]) && dv(10) === Number(digits[10])
}

/** CNPJ (numérico ou alfanumérico) ou CPF válido. */
export function isValidDocument(input: string | null | undefined): boolean {
  const v = normalizeCnpj(input)
  return v.length === 11 ? isValidCPF(v) : isValidCNPJ(v)
}

/** Formata para exibição: 12.ABC.345/01DE-35 ou 123.456.789-09. */
export function formatDocument(input: string | null | undefined): string {
  const v = normalizeCnpj(input)
  if (v.length === 14) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
  if (v.length === 11 && /^\d+$/.test(v)) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
  return input ?? ""
}

/**
 * Máscara de digitação do campo CNPJ/CPF: até 11 dígitos numéricos usa a
 * máscara de CPF (000.000.000-00); com 12+ caracteres (ou letras) vira CNPJ
 * (00.000.000/0000-00, aceitando letras nas 12 primeiras posições).
 */
export function formatDocumentInput(value: string): string {
  const v = normalizeCnpj(value).slice(0, 14)
  if (v.length <= 11 && /^\d*$/.test(v)) {
    let out = v.slice(0, 3)
    if (v.length > 3) out += "." + v.slice(3, 6)
    if (v.length > 6) out += "." + v.slice(6, 9)
    if (v.length > 9) out += "-" + v.slice(9)
    return out
  }
  let out = v.slice(0, 2)
  if (v.length > 2) out += "." + v.slice(2, 5)
  if (v.length > 5) out += "." + v.slice(5, 8)
  if (v.length > 8) out += "/" + v.slice(8, 12)
  if (v.length > 12) out += "-" + v.slice(12)
  return out
}
