import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  deleted: [] as string[],
  clientStatus: "active",
  locked: [] as string[],
}))

vi.mock("@/lib/supabase/core", () => ({
  hasSupabaseConfig: () => true,
  toDbError: (e: { message?: string }) => new Error(e?.message ?? "x"),
  local: {},
  fetchAll: async () => [],
  getSupabaseClient: () => ({
    from: (t: string) => ({
      select: () => ({ eq: async () => ({ data: state.rows[t] ?? [], error: null }) }),
      delete: () => ({
        in: async (_c: string, ids: string[]) => {
          state.deleted.push(...ids.map((id) => `${t}:${id}`))
          return { error: null }
        },
      }),
      update: (v: { status: string }) => ({
        eq: async () => {
          state.clientStatus = v.status
          return { error: null }
        },
      }),
    }),
  }),
}))

vi.mock("@/features/periods/services", () => ({
  getLockedPeriods: async () => state.locked.map((period) => ({ period, lockedAt: "" })),
}))

import { archiveClient } from "@/features/clients/services"

beforeEach(() => {
  state.rows = {
    obligations: [{ id: "o1", status: "pending", client_id: "c1", competency_month: "2026-10" }],
    taxes: [{ id: "t1", status: "pending", client_id: "c1", competency_month: "2026-09" }],
    installments: [],
  }
  state.deleted = []
  state.clientStatus = "active"
  state.locked = []
})

describe("archiveClient (não atômico)", () => {
  it("competência fechada: aborta ANTES de apagar qualquer coisa, com mensagem clara", async () => {
    state.locked = ["2026-09"]
    await expect(archiveClient("c1")).rejects.toThrow(/competência fechada.*2026-09/i)
    expect(state.deleted).toEqual([])
    expect(state.clientStatus).toBe("active")
  })

  it("sem bloqueio: apaga pendentes e arquiva", async () => {
    const r = await archiveClient("c1")
    expect(state.deleted.sort()).toEqual(["obligations:o1", "taxes:t1"])
    expect(state.clientStatus).toBe("inactive")
    expect(r.obrigacoesDeleted + r.guiasDeleted).toBe(2)
  })

  it("concluídos em competência fechada não bloqueiam (são preservados)", async () => {
    state.locked = ["2026-09"]
    state.rows.taxes = [{ id: "t1", status: "completed", client_id: "c1", competency_month: "2026-09" }]
    await archiveClient("c1")
    expect(state.deleted).toEqual(["obligations:o1"])
    expect(state.clientStatus).toBe("inactive")
  })
})
