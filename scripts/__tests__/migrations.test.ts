/**
 * Testes dos scripts SQL (scripts/*.sql) num Postgres real (PGlite) com stubs
 * do Supabase — ver pg-harness.ts. Cobre:
 *  - instalação nova e banco antigo, cada script rodado 2x + cadeia inteira de novo;
 *  - reexecutar scripts antigos depois do 023 não regride nada;
 *  - papéis deny-by-default (anon, sem papel, login anônimo, viewer, editor, admin);
 *  - histórico só-leitura e com autor do servidor; fechamento auditado;
 *  - upsert idêntico em competência fechada; search_path fixo; painel público.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { PGlite } from "@electric-sql/pglite"
import {
  ORDER_FRESH, ORDER_LEGACY, USERS, as, makeDb, q, runAll, runScript, securitySnapshot, upsertSql,
} from "./pg-harness"

const T = 180_000
const CL = "aaaaaaaa-0000-0000-0000-000000000001"
const EDITOR = USERS.editor as { sub: string; email: string }

const TABLES_VIEWER = ["clients", "obligations", "locked_periods", "office_holidays"]
const TABLES_STAFF = [
  "taxes", "installments", "services", "apuracao_mensal", "apuracao_mensal_revisoes", "history",
  "custom_obligation_templates", "deleted_default_templates",
]
const ALL_TABLES = [...TABLES_VIEWER, ...TABLES_STAFF]

/** Dados mínimos em todas as tabelas (como o dono do banco, sem RLS). */
async function seed(db: PGlite) {
  await as(db, "postgres")
  await db.exec(`
    insert into clients (id, name, cnpj, tax_regime, business_activity) values ('${CL}', 'Seed SA', '11.111.111/0001-11', 'simples_nacional', 'servicos');
    insert into taxes (name, client_id, competency_month) values ('DAS', '${CL}', '2026-01');
    insert into obligations (name, client_id, due_day, competency_month) values ('DCTF', '${CL}', 15, '2026-01');
    insert into installments (name, client_id, installment_count, current_installment, due_day, first_due_date) values ('Parc', '${CL}', 10, 1, 20, '2026-01-20');
    insert into services (id, name, client_id, due_date) values (gen_random_uuid(), 'NF', '${CL}', '2026-01-10');
    insert into apuracao_mensal (client_id, comp_key, faturamento) values ('${CL}', '2026-01', 1000);
    update apuracao_mensal set faturamento = 2000, version = 1 where client_id = '${CL}';
    insert into custom_obligation_templates (name) values ('Tpl');
    insert into deleted_default_templates (name) values ('Padrão · X');
    insert into locked_periods (period) values ('2025-12');
    insert into office_holidays (holiday_date, name) values ('2026-01-25', 'Aniversário SP');
  `)
}

async function count(db: PGlite, table: string): Promise<number | string> {
  const r = await q<{ c: number }>(db, `select count(*)::int as c from public.${table}`)
  return r.ok ? r.rows[0].c : `ERR ${r.code}`
}

describe("cadeia de instalação (cada script 2x + cadeia inteira de novo)", () => {
  it("instalação nova: setup_complete → RUN_ME → 004…023", async () => {
    const db = await makeDb()
    await runAll(db, ORDER_FRESH, 2)
    await runAll(db, ORDER_FRESH, 1)
  }, T)

  it("banco antigo: 001 → 018 → 019 → 022 → 023", async () => {
    const db = await makeDb()
    await runAll(db, ORDER_LEGACY, 2)
    await runAll(db, ORDER_LEGACY, 1)
  }, T)

  it("os dois caminhos chegam às mesmas políticas, funções e gatilhos", async () => {
    const a = await makeDb()
    await runAll(a, ORDER_FRESH)
    const b = await makeDb()
    await runAll(b, ORDER_LEGACY)
    const sa = await securitySnapshot(a)
    const sb = await securitySnapshot(b)
    expect(sb.pols).toEqual(sa.pols)
    expect(sb.fns).toEqual(sa.fns)
    expect(sb.grants).toEqual(sa.grants)
    // history: mesmos CHECKs nos dois caminhos
    expect(sb.chk.filter((c) => c.t === "history")).toEqual(sa.chk.filter((c) => c.t === "history"))
  }, T)

  it("reexecutar QUALQUER script antigo depois do 023 não muda a segurança", async () => {
    const db = await makeDb()
    await runAll(db, ORDER_FRESH)
    const before = await securitySnapshot(db)
    for (const f of [...ORDER_LEGACY.slice(0, 3), ...ORDER_FRESH.slice(0, -1)]) {
      await runScript(db, f)
      const after = await securitySnapshot(db)
      expect({ f, ...after }).toEqual({ f, ...before })
    }
  }, T)
})

describe("banco instalado (023 aplicado)", () => {
  let db: PGlite

  beforeAll(async () => {
    db = await makeDb()
    // até o 022, depois cria contas como estariam em produção, depois 023 (2x)
    await runAll(db, ORDER_FRESH.slice(0, -1))
    await as(db, "postgres")
    await db.exec(`
      insert into auth.users (id, email, raw_app_meta_data) values
        ('${EDITOR.sub}', '${EDITOR.email}', '{"provider":"email"}'),
        ('22222222-2222-2222-2222-222222222222', 'viewer@escritorio.com', '{"role":"viewer"}'),
        ('77777777-7777-7777-7777-777777777777', 'antigo@escritorio.com', '{"role":""}');
      insert into auth.users (id, raw_app_meta_data, is_anonymous) values
        ('66666666-6666-6666-6666-666666666666', '{"provider":"anonymous"}', true);
    `)
    await runScript(db, "023_papeis_auditoria.sql")
    await runScript(db, "023_papeis_auditoria.sql")
    await seed(db)
  }, T)

  it("backfill: contas existentes sem papel viram editor (uma única vez); viewer e anônimo intocados", async () => {
    await as(db, "postgres")
    const roles = async () =>
      Object.fromEntries(
        (await db.query<{ id: string; r: string | null }>(`select id, raw_app_meta_data ->> 'role' as r from auth.users`)).rows.map(
          (x) => [x.id, x.r],
        ),
      )
    const r1 = await roles()
    expect(r1[EDITOR.sub]).toBe("editor")
    expect(r1["77777777-7777-7777-7777-777777777777"]).toBe("editor")
    expect(r1["22222222-2222-2222-2222-222222222222"]).toBe("viewer")
    expect(r1["66666666-6666-6666-6666-666666666666"]).toBeNull()
    // conta criada DEPOIS do 023 continua sem papel mesmo se o 023 rodar de novo
    await db.exec(`insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'depois@x.com')`)
    await runScript(db, "023_papeis_auditoria.sql")
    expect((await roles())["88888888-8888-8888-8888-888888888888"]).toBeNull()
  }, T)

  it("anônimo (sem login) não lê nem grava nenhuma tabela; só chama o painel público", async () => {
    await as(db, "anon")
    for (const t of ALL_TABLES) {
      const r = await q(db, `select * from public.${t} limit 1`)
      expect(r.ok, t).toBe(false)
    }
    expect((await q(db, `insert into clients (name, cnpj) values ('x', '1')`)).ok).toBe(false)
    expect((await q(db, `select public.portfolio_publico()`)).ok).toBe(true)
  })

  it.each(["norole", "anonymous"] as const)("logado %s: não lê nada e não grava nada", async (who) => {
    await as(db, who)
    for (const t of ALL_TABLES) expect(await count(db, t), t).toBe(0)
    const ins = await q(db, `insert into clients (name, cnpj) values ('x', '99')`)
    expect(ins.ok).toBe(false)
    const upd = await q(db, `update clients set notes = 'x'`)
    expect(upd.ok && upd.affected).toBe(0)
  })

  it("viewer: lê só empresas/obrigações/fechamentos/feriados; não grava", async () => {
    await as(db, "viewer")
    for (const t of TABLES_VIEWER) expect(await count(db, t), t).toBeGreaterThan(0)
    for (const t of TABLES_STAFF) expect(await count(db, t), t).toBe(0)
    expect((await q(db, `insert into clients (name, cnpj) values ('x', '98')`)).ok).toBe(false)
    expect((await q(db, `insert into locked_periods (period) values ('2030-01')`)).ok).toBe(false)
    const upd = await q(db, `update obligations set notes = 'x'`)
    expect(upd.ok && upd.affected).toBe(0)
    const del = await q(db, `delete from clients`)
    expect(del.ok && del.affected).toBe(0)
  })

  it.each(["editor", "admin"] as const)("%s: lê tudo e grava (menos o histórico)", async (who) => {
    await as(db, who)
    for (const t of ALL_TABLES) expect(await count(db, t), t).toBeGreaterThan(0)
    expect((await q(db, `update clients set notes = 'ok' where id = '${CL}'`)).ok).toBe(true)
    const ins = await q(db, `insert into office_holidays (holiday_date, name) values ('2031-01-0${who === "admin" ? 2 : 1}', 'F')`)
    expect(ins.ok).toBe(true)
  })

  it("history: ninguém insere/altera/apaga pela API (nem editor)", async () => {
    await as(db, "editor")
    const ins = await q(db, `insert into history (entity_type, entity_id, action, description) values ('client', '${CL}', 'updated', 'forjado')`)
    expect(ins.ok).toBe(false)
    expect((await q(db, `update history set description = 'adulterado'`)).ok).toBe(false)
    expect((await q(db, `delete from history`)).ok).toBe(false)
    expect((await q(db, `insert into apuracao_mensal_revisoes (apuracao_id, client_id, comp_key, version, op, snapshot) values (gen_random_uuid(), '${CL}', '2026-01', 9, 'UPDATE', '{}')`)).ok).toBe(false)
  })

  it("history: autor vem do token (e-mail), não do user_metadata nem do completed_by", async () => {
    await as(db, "editor")
    const id = "bbbbbbbb-0000-0000-0000-0000000000f1"
    expect((await q(db, `insert into obligations (id, name, client_id, due_day, competency_month) values ('${id}', 'X', '${CL}', 1, '2026-06')`)).ok).toBe(true)
    expect((await q(db, `update obligations set status = 'completed', completed_at = now(), completed_by = 'Fulano Forjado' where id = '${id}'`)).ok).toBe(true)
    const h = await q<{ action: string; user_name: string; user_id: string; description: string }>(
      db, `select action, user_name, user_id, description from history where entity_id = '${id}' order by created_at, action`,
    )
    expect(h.ok).toBe(true)
    if (!h.ok) return
    expect(h.rows.length).toBeGreaterThanOrEqual(3)
    for (const r of h.rows) {
      expect(r.user_name).toBe(EDITOR.email)
      expect(r.user_id).toBe(EDITOR.sub)
    }
    expect(h.rows.find((r) => r.action === "completed")?.description).toContain("responsável informado: Fulano Forjado")
  })

  it("fechamento: autor carimbado pelo servidor e fechar/reabrir vira histórico", async () => {
    await as(db, "editor")
    const r = await q(db, `insert into locked_periods (period, locked_by, locked_by_name, locked_at)
      values ('2026-07', '99999999-9999-9999-9999-999999999999', 'Forjado', '2000-01-01')
      on conflict (period) do update set locked_by_name = excluded.locked_by_name`)
    expect(r.ok).toBe(true)
    // re-fechar (upsert) também não troca o autor
    await q(db, `insert into locked_periods (period, locked_by_name) values ('2026-07', 'Outro') on conflict (period) do update set locked_by_name = excluded.locked_by_name`)
    const lp = await q<{ locked_by: string; locked_by_name: string; y: number }>(
      db, `select locked_by, locked_by_name, extract(year from locked_at)::int as y from locked_periods where period = '2026-07'`,
    )
    expect(lp.ok && lp.rows[0]).toEqual({ locked_by: EDITOR.sub, locked_by_name: EDITOR.email, y: new Date().getFullYear() })
    expect((await q(db, `delete from locked_periods where period = '2026-07'`)).ok).toBe(true)
    const h = await q<{ action: string; entity_key: string; user_name: string; same: boolean }>(
      db, `select action, entity_key, user_name, entity_id = md5('period:2026-07')::uuid as same
             from history where entity_type = 'period' and entity_key = '2026-07' order by created_at, action`,
    )
    expect(h.ok && h.rows.map((x) => x.action).sort()).toEqual(["locked", "unlocked"])
    expect(h.ok && h.rows.every((x) => x.user_name === EDITOR.email && x.same)).toBe(true)
  })

  it("competência fechada: upsert idêntico passa; mudança/inclusão/mover/excluir são barrados com a mensagem certa", async () => {
    await as(db, "editor")
    const O1 = "bbbbbbbb-0000-0000-0000-000000000001"
    const o = {
      id: O1, name: "DCTFWeb", client_id: CL, due_day: 15, competency_month: "2026-03", status: "pending",
      notes: null, completed_by: null, created_at: "2026-03-01T10:00:00.000Z",
    }
    const cols = Object.keys(o)
    const up = upsertSql("obligations", cols)
    expect((await q(db, up, [JSON.stringify(o)])).ok).toBe(true)
    expect((await q(db, `insert into locked_periods (period) values ('2026-03')`)).ok).toBe(true)

    expect(await q(db, up, [JSON.stringify(o)])).toMatchObject({ ok: true, affected: 1 })

    const mudou = await q(db, up, [JSON.stringify({ ...o, status: "completed" })])
    expect(mudou.ok).toBe(false)
    if (!mudou.ok) {
      expect(mudou.message).toMatch(/2026-03 está fechada/)
      expect(mudou.message).not.toMatch(/incluir/)
    }

    const novo = await q(db, up, [JSON.stringify({ ...o, id: "bbbbbbbb-0000-0000-0000-000000000002", name: "Outra" })])
    expect(!novo.ok && novo.message).toMatch(/incluir itens/)

    const O3 = "bbbbbbbb-0000-0000-0000-000000000003"
    expect((await q(db, up, [JSON.stringify({ ...o, id: O3, name: "Abr", competency_month: "2026-04" })])).ok).toBe(true)
    const mover = await q(db, up, [JSON.stringify({ ...o, id: O3, name: "Abr", competency_month: "2026-03" })])
    expect(!mover.ok && mover.message).toMatch(/mover este item/)

    const del = await q(db, `delete from obligations where id = '${O1}'`)
    expect(!del.ok && del.message).toMatch(/alterar ou excluir/)

    // guias e serviços: upsert idêntico em competência fechada também passa
    const t = { id: "cccccccc-0000-0000-0000-000000000001", name: "DAS-M", client_id: CL, competency_month: "2026-03", status: "pending" }
    await as(db, "postgres")
    await db.exec(`delete from locked_periods where period = '2026-03'`)
    await as(db, "editor")
    expect((await q(db, upsertSql("taxes", Object.keys(t)), [JSON.stringify(t)])).ok).toBe(true)
    const s = { id: "dddddddd-0000-0000-0000-000000000001", name: "NF", client_id: CL, due_date: "2026-03-16", status: "pending" }
    expect((await q(db, upsertSql("services", Object.keys(s)), [JSON.stringify(s)])).ok).toBe(true)
    expect((await q(db, `insert into locked_periods (period) values ('2026-03')`)).ok).toBe(true)
    expect((await q(db, upsertSql("taxes", Object.keys(t)), [JSON.stringify(t)])).ok).toBe(true)
    expect((await q(db, upsertSql("services", Object.keys(s)), [JSON.stringify(s)])).ok).toBe(true)
    expect((await q(db, upsertSql("taxes", Object.keys(t)), [JSON.stringify({ ...t, status: "completed" })])).ok).toBe(false)
  })

  it("apuração salva depois de reexecutar o 019 (CHECK do history mantém 'apuracao')", async () => {
    await runScript(db, "019_hardening.sql")
    await as(db, "editor")
    const r = await q(db, `insert into apuracao_mensal (client_id, comp_key, faturamento) values ('${CL}', '2026-08', 10)`)
    expect(r.ok).toBe(true)
    const h = await q<{ c: number }>(db, `select count(*)::int as c from history where entity_type = 'apuracao'`)
    expect(h.ok && h.rows[0].c).toBeGreaterThan(0)
  })

  it("reexecutar o 016 não devolve escrita ao viewer", async () => {
    await runScript(db, "016_auth_rls_lockdown.sql")
    await as(db, "viewer")
    expect((await q(db, `insert into clients (name, cnpj) values ('x', '97')`)).ok).toBe(false)
    expect(await count(db, "taxes")).toBe(0)
  })

  it("todas as funções de public têm search_path fixo", async () => {
    await as(db, "postgres")
    const r = await db.query<{ fn: string }>(`
      select p.oid::regprocedure::text as fn from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)
    expect(r.rows).toEqual([])
  })

  it("rollback documentado (rollback/023_reverter.sql + 017/019/020/021/022) volta ao modelo antigo e o 023 reaplica", async () => {
    const r = await makeDb()
    await runAll(r, ORDER_FRESH)
    await seed(r)
    await runAll(r, ["rollback/023_reverter.sql", "017_viewer_role.sql", "019_hardening.sql",
      "020_locked_periods.sql", "021_office_holidays.sql", "022_apuracao_integridade.sql"])
    await as(r, "norole") // modelo antigo: logado sem papel lê e grava
    expect(await count(r, "taxes")).toBeGreaterThan(0)
    expect((await q(r, `update clients set notes = 'rb' where id = '${CL}'`)).ok).toBe(true)
    await as(r, "viewer")
    expect((await q(r, `insert into clients (name, cnpj) values ('v', 'rb1')`)).ok).toBe(false)
    // histórico continua protegido e com autor do servidor
    await as(r, "editor")
    expect((await q(r, `insert into history (entity_type, entity_id, action, description) values ('client', '${CL}', 'updated', 'x')`)).ok).toBe(false)
    expect((await q(r, `insert into locked_periods (period) values ('2029-01')`)).ok).toBe(true)
    // reaplicar o 023
    await runScript(r, "023_papeis_auditoria.sql")
    await as(r, "norole")
    expect(await count(r, "taxes")).toBe(0)
  }, T)

  it("painel público: sem lista por empresa e sem grupos < 3", async () => {
    await as(db, "postgres")
    await db.exec(`
      insert into clients (name, cnpj, tax_regime, business_activity) values
        ('A', '01', 'simples_nacional', 'servicos'), ('B', '02', 'simples_nacional', 'servicos'),
        ('C', '03', 'simples_nacional', 'servicos'), ('D', '04', 'lucro_real', 'comercio'),
        ('E', '05', 'lucro_presumido', 'industria'), ('F', '06', 'mei', 'comercio');`)
    await as(db, "anon")
    const r = await q<{ p: Record<string, unknown> }>(db, `select public.portfolio_publico() as p`)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const p = r.rows[0].p
    expect(p).not.toHaveProperty("empresas")
    expect(p.total).toBe(7)
    // simples_nacional: seed + 3 = 4; demais (1+1+1) = 3 → "outros"
    expect(p.porRegime).toEqual({ simples_nacional: 4, outros: 3 })
    // servicos: 4; comercio 2 + industria 1 = 3 → "outros"
    expect(p.porAtividade).toEqual({ servicos: 4, outros: 3 })
    for (const n of [...Object.values(p.porRegime as object), ...Object.values(p.porAtividade as object)]) {
      expect(n as number).toBeGreaterThanOrEqual(3)
    }
  })
})
