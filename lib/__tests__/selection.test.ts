import { describe, expect, it } from "vitest"
import { allVisibleSelected, toggleAllVisible } from "../selection"
import { runBulk } from "../bulk-actions"

describe("selecionar todos = só os itens visíveis", () => {
  it("marca apenas os ids da página/filtro atual, preservando nada fora dela", () => {
    const visible = ["a", "b"]
    const next = toggleAllVisible(new Set(["x"]), visible, true)
    expect([...next].sort()).toEqual(["a", "b", "x"])
    expect(allVisibleSelected(next, visible)).toBe(true)
  })

  it("desmarcar tira só os visíveis", () => {
    const next = toggleAllVisible(new Set(["a", "b", "x"]), ["a", "b"], false)
    expect([...next]).toEqual(["x"])
  })

  it("lista vazia nunca aparece como 'tudo selecionado'", () => {
    expect(allVisibleSelected(new Set(["a"]), [])).toBe(false)
  })
})

describe("runBulk: ignora competência fechada e relata falhas", () => {
  it("itens bloqueados não são processados e entram no aviso", async () => {
    const done: string[] = []
    const items = [
      { id: "a", comp: "2026-09" },
      { id: "b", comp: "2026-10" },
      { id: "c", comp: "2026-10" },
    ]
    const r = await runBulk(
      items,
      async (i) => {
        if (i.id === "c") throw new Error("falhou c")
        done.push(i.id)
      },
      { isLocked: (i) => i.comp === "2026-09", done: { one: "concluída", many: "concluídas" } },
    )
    expect(done).toEqual(["b"])
    expect(r.locked.map((i) => i.id)).toEqual(["a"])
    expect(r.toast).toEqual({
      kind: "warning",
      message: "1 concluída, 1 falhou (falhou c), 1 ignorado (competência fechada)",
    })
  })
})
