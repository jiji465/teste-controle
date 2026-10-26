import { describe, expect, it } from "vitest"
import { clientSchema } from "@/features/clients/schemas"
import { formatDocumentInput } from "../cnpj-validation"
import { matchesClientSearch } from "../utils"
import { selectableClients } from "../client-options"
import type { Client } from "../types"

const base = { name: "Empresa X", email: "", status: "active" as const, taxRegime: "simples_nacional" as const }

describe("cadastro de empresa", () => {
  it("aceita CPF válido (pessoa física) além de CNPJ", () => {
    expect(clientSchema.safeParse({ ...base, cnpj: "529.982.247-25" }).success).toBe(true)
    expect(clientSchema.safeParse({ ...base, cnpj: "11.222.333/0001-81" }).success).toBe(true)
    expect(clientSchema.safeParse({ ...base, cnpj: "" }).success).toBe(true)
    expect(clientSchema.safeParse({ ...base, cnpj: "529.982.247-24" }).success).toBe(false)
  })

  it("regime tributário é obrigatório", () => {
    const { taxRegime: _r, ...semRegime } = base
    const r = clientSchema.safeParse(semRegime)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toEqual(["taxRegime"])
  })

  it("UF é salva em maiúsculas", () => {
    const r = clientSchema.safeParse({ ...base, state: " sp " })
    expect(r.success && r.data.state).toBe("SP")
  })

  it("máscara detecta CPF (11 dígitos) e CNPJ", () => {
    expect(formatDocumentInput("52998224725")).toBe("529.982.247-25")
    expect(formatDocumentInput("5299822")).toBe("529.982.2")
    expect(formatDocumentInput("11222333000181")).toBe("11.222.333/0001-81")
    expect(formatDocumentInput("12ABC34501DE35")).toBe("12.ABC.345/01DE-35")
  })
})

describe("empresas arquivadas fora dos selects de novos itens", () => {
  const mk = (id: string, status: "active" | "inactive"): Client => ({ id, name: id, email: "", phone: "", status, createdAt: "" })
  const all = [mk("a", "active"), mk("b", "inactive")]
  it("novo item: só ativas", () => {
    expect(selectableClients(all).map((c) => c.id)).toEqual(["a"])
  })
  it("editando item de empresa arquivada: ela continua disponível", () => {
    expect(selectableClients(all, "b").map((c) => c.id)).toEqual(["a", "b"])
  })
})

describe("busca global por CNPJ", () => {
  const clients = [
    { name: "Alfa", cnpj: "12.ABC.345/01DE-35", email: "" },
    { name: "Beta", cnpj: "11.222.333/0001-81", email: "" },
  ]
  const search = (q: string) => clients.filter((c) => matchesClientSearch(c, q))

  it("acha CNPJ alfanumérico e CNPJ digitado sem máscara", () => {
    expect(search("12.ABC.345").map((c) => c.name)).toEqual(["Alfa"])
    expect(search("11222333").map((c) => c.name)).toEqual(["Beta"])
    expect(search("beta").map((c) => c.name)).toEqual(["Beta"])
  })
})
