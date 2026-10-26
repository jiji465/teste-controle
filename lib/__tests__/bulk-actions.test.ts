import { describe, expect, it } from "vitest"
import { bulkResultToast, settleAll } from "../bulk-actions"

describe("ações em lote com falha parcial", () => {
  it("roda todos os itens e separa sucesso de falha", async () => {
    const saved: string[] = []
    const save = async (id: string) => {
      if (id === "b") throw new Error("Competência 2026-09 está fechada.")
      saved.push(id)
    }
    const r = await settleAll(["a", "b", "c"], save)
    expect(saved.sort()).toEqual(["a", "c"])
    expect(r.succeeded).toEqual(["a", "c"])
    expect(r.failed.map((f) => f.item)).toEqual(["b"])
  })

  it("toast: 'X concluídas, Y falhou (motivo)'", async () => {
    const r = await settleAll(["a", "b"], async (id) => {
      if (id === "b") throw new Error("Competência 2026-09 está fechada.")
    })
    expect(bulkResultToast(r, { one: "concluída", many: "concluídas" })).toEqual({
      kind: "warning",
      message: "1 concluída, 1 falhou (Competência 2026-09 está fechada.)",
    })
  })

  it("toast de sucesso total e de falha total", async () => {
    expect(bulkResultToast(await settleAll([1, 2], async () => {}), "excluídas").kind).toBe("success")
    const allFail = await settleAll([1], async () => {
      throw new Error("x")
    })
    expect(bulkResultToast(allFail, "excluídas")).toEqual({ kind: "error", message: "0 excluídas, 1 falhou (x)" })
  })

  it("itens ignorados (competência fechada) aparecem no aviso", async () => {
    const r = await settleAll([1], async () => {})
    expect(bulkResultToast(r, "concluídas", { count: 2, reason: "competência fechada" })).toEqual({
      kind: "warning",
      message: "1 concluídas, 2 ignorados (competência fechada)",
    })
  })
})
