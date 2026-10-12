import { describe, expect, it } from "vitest"
import {
  adjustForWeekend,
  calculateDueDate,
  calculateDueDateFromCompetency,
  getHolidayName,
  isOverdue,
  nthBusinessDay,
  parseLocalDate,
  toLocalDateString,
} from "../date-utils"

const ymd = (d: Date | null) => (d ? toLocalDateString(d) : null)

describe("feriados nacionais", () => {
  it("calcula os móveis de 2026 a partir da Páscoa (05/04)", () => {
    expect(getHolidayName(new Date(2026, 1, 16))).toBe("Segunda-feira de Carnaval")
    expect(getHolidayName(new Date(2026, 1, 17))).toBe("Terça-feira de Carnaval")
    expect(getHolidayName(new Date(2026, 3, 3))).toBe("Sexta-feira Santa")
    expect(getHolidayName(new Date(2026, 5, 4))).toBe("Corpus Christi")
  })

  it("Consciência Negra só é feriado nacional a partir de 2024", () => {
    expect(getHolidayName(new Date(2023, 10, 20))).toBeNull()
    expect(getHolidayName(new Date(2024, 10, 20))).toBe("Consciência Negra")
  })
})

describe("parseLocalDate", () => {
  it("lê YYYY-MM-DD como meia-noite local (sem recuar um dia/mês no Brasil)", () => {
    const d = parseLocalDate("2026-02-01")
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(1)
  })

  it("trata timestamp completo como instante real", () => {
    // 01:30Z do dia 20 = 22:30 do dia 19 em São Paulo
    expect(parseLocalDate("2026-05-20T01:30:00.000Z").getDate()).toBe(19)
  })

  it("devolve cópia de Date (quem chama pode mexer sem alterar o original)", () => {
    const original = new Date(2026, 4, 20, 15, 0)
    isOverdue(original)
    expect(original.getHours()).toBe(15)
  })
})

describe("vencimentos", () => {
  it("posterga feriado (Tiradentes) e antecipa conforme a regra", () => {
    expect(ymd(calculateDueDateFromCompetency("2026-03", 21, "postpone"))).toBe("2026-04-22")
    expect(ymd(calculateDueDateFromCompetency("2026-03", 21, "anticipate"))).toBe("2026-04-20")
  })

  it("DAS de 05/2026 (dia 20 = sábado) vai para segunda 22/06", () => {
    expect(ymd(calculateDueDateFromCompetency("2026-05", 20, "postpone"))).toBe("2026-06-22")
  })

  it("anual com mês fixo (DEFIS 2025 → 31/03/2026)", () => {
    expect(ymd(calculateDueDateFromCompetency("2025-12", 31, "keep", 3))).toBe("2026-03-31")
  })

  it("dia 31 em fevereiro vira último dia do mês", () => {
    expect(ymd(calculateDueDateFromCompetency("2026-01", 31, "keep"))).toBe("2026-02-28")
  })

  it("calculateDueDate mantém vencimento de HOJE no período atual", () => {
    const ref = new Date(2026, 4, 20, 18, 30) // 20/05 às 18h30 (quarta)
    expect(ymd(calculateDueDate(20, undefined, "monthly", "keep", ref))).toBe("2026-05-20")
  })

  it("adjustForWeekend em dia útil não muda a data", () => {
    const d = new Date(2026, 4, 20)
    expect(ymd(adjustForWeekend(d, "postpone"))).toBe("2026-05-20")
  })

  it("nthBusinessDay: 10º dia útil de jan/2026 é 15/01", () => {
    expect(ymd(nthBusinessDay(2026, 0, 10))).toBe("2026-01-15")
  })
})
