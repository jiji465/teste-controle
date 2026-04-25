// Validação real de CNPJ — algoritmo dos dígitos verificadores da Receita.
// Rejeita formatos como "11.111.111/1111-11" que passavam antes.

const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function calculateCheckDigit(base: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + w * Number(base[i]), 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCNPJ(input: string | null | undefined): boolean {
  if (!input) return false
  const digits = input.replace(/\D/g, "")
  if (digits.length !== 14) return false
  // Rejeita CNPJs com todos os dígitos iguais (11.111.111/1111-11 etc.)
  if (/^(\d)\1{13}$/.test(digits)) return false

  const base12 = digits.slice(0, 12)
  const d1 = calculateCheckDigit(base12, WEIGHTS_1)
  const d2 = calculateCheckDigit(base12 + d1, WEIGHTS_2)
  return d1 === Number(digits[12]) && d2 === Number(digits[13])
}
