/**
 * Harness de banco para testar os scripts SQL em um Postgres REAL (PGlite,
 * Postgres compilado para WASM — roda dentro do Node, sem servidor) com stubs
 * mínimos do Supabase: papéis anon/authenticated/service_role, schema `auth`
 * com auth.users, auth.jwt(), auth.uid() e auth.role() iguais aos do Supabase,
 * e os privilégios padrão que o Supabase dá a anon/authenticated em `public`.
 *
 * Não conecta em nenhum banco remoto. Usado por migrations.test.ts.
 */
import { PGlite } from "@electric-sql/pglite"
import fs from "node:fs"
import path from "node:path"

export const SCRIPTS_DIR = process.env.SQL_SCRIPTS_DIR ?? path.resolve(__dirname, "..")

const SUPABASE_STUB = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key, email text,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
  is_anonymous boolean not null default false
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

/** Ordem de instalação NOVA documentada (docs/MANUTENCAO.md). */
export const ORDER_FRESH = [
  "setup_complete.sql", "RUN_ME_ON_SUPABASE.sql",
  "004_align_schema_and_templates.sql", "005_fiscal_fields_layer1.sql", "005_templates_full_persistence.sql",
  "006_fix_history_trigger.sql", "006_taxes_due_month.sql", "007_fix_missing_columns.sql",
  "008_padronizacao_guias_acessorias.sql", "009_add_city_state_to_clients.sql", "010_installment_paid_dates.sql",
  "011_cleanup_duplicates.sql", "012_create_services_table.sql", "013_add_weekend_rule_to_services.sql",
  "014_fix_missing_tax_columns.sql", "015_apuracao_mensal.sql",
  "016_auth_rls_lockdown.sql", "017_viewer_role.sql", "018_public_portfolio.sql", "019_hardening.sql",
  "020_locked_periods.sql", "021_office_holidays.sql", "022_apuracao_integridade.sql", "023_papeis_auditoria.sql",
]

/** Banco antigo: 001 → 018 → 019 → 022 → 023. */
export const ORDER_LEGACY = [
  "001_create_tables.sql", "002_enable_rls.sql", "003_create_functions.sql", ...ORDER_FRESH.slice(2),
]

export type Who = "anon" | "postgres" | "editor" | "admin" | "viewer" | "norole" | "anonymous"

export const USERS: Record<Exclude<Who, "anon" | "postgres">, Record<string, unknown>> = {
  editor: {
    sub: "11111111-1111-1111-1111-111111111111", email: "editor@escritorio.com", role: "authenticated",
    app_metadata: { role: "editor" }, user_metadata: { name: "Nome Que O Usuário Escolheu" },
  },
  admin: {
    sub: "44444444-4444-4444-4444-444444444444", email: "admin@escritorio.com", role: "authenticated",
    app_metadata: { role: "admin" }, user_metadata: {},
  },
  viewer: {
    sub: "22222222-2222-2222-2222-222222222222", email: "viewer@escritorio.com", role: "authenticated",
    app_metadata: { role: "viewer" }, user_metadata: {},
  },
  // conta logada sem papel (ex.: alguém que se cadastrou sozinho)
  norole: {
    sub: "55555555-5555-5555-5555-555555555555", email: "novo@qualquer.com", role: "authenticated",
    app_metadata: {}, user_metadata: {},
  },
  // login anônimo do Supabase — mesmo que um papel apareça, não vale
  anonymous: {
    sub: "66666666-6666-6666-6666-666666666666", role: "authenticated", is_anonymous: true,
    app_metadata: { provider: "anonymous", role: "editor" }, user_metadata: {},
  },
}

export async function makeDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  return db
}

export function readScript(name: string): string {
  return fs.readFileSync(path.join(SCRIPTS_DIR, name), "utf8")
}

/** Roda um script inteiro; lança com o nome do arquivo se falhar. */
export async function runScript(db: PGlite, name: string): Promise<string[]> {
  const notices: string[] = []
  await as(db, "postgres")
  try {
    await db.exec(readScript(name), { onNotice: (n) => notices.push(n.message ?? "") })
  } catch (e) {
    try { await db.exec("rollback") } catch { /* sem transação aberta */ }
    throw new Error(`${name}: ${(e as Error).message}`)
  }
  return notices
}

export async function runAll(db: PGlite, files: string[], times = 1): Promise<void> {
  for (const f of files) for (let i = 0; i < times; i++) await runScript(db, f)
}

/** Troca a "sessão" (JWT + papel do Postgres), como o PostgREST faz. */
export async function as(db: PGlite, who: Who): Promise<void> {
  await db.exec("reset role")
  if (who === "postgres") {
    await db.query("select set_config('request.jwt.claims', '', false)")
    return
  }
  if (who === "anon") {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "anon" })])
    await db.exec("set role anon")
    return
  }
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(USERS[who])])
  await db.exec("set role authenticated")
}

export type QResult<T = Record<string, unknown>> =
  | { ok: true; rows: T[]; affected: number }
  | { ok: false; code: string; message: string }

/** Executa sem lançar: devolve linhas/linhas afetadas ou o erro do Postgres. */
export async function q<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<QResult<T>> {
  try {
    const r = await db.query<T>(sql, params)
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 }
  } catch (e) {
    const err = e as { code?: string; message?: string }
    return { ok: false, code: err.code ?? "", message: err.message ?? String(e) }
  }
}

/** Mesmo SQL que o PostgREST gera para `.upsert(obj)` (ON CONFLICT na PK). */
export function upsertSql(table: string, cols: string[]): string {
  return `insert into ${table} (${cols.join(",")}) select ${cols.join(",")} from json_populate_record(null::${table}, $1::json)
    on conflict (id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}`
}

/** Fotografia do que define a segurança: políticas, funções, gatilhos, CHECKs, grants. */
export async function securitySnapshot(db: PGlite) {
  await as(db, "postgres")
  const pols = await db.query(
    `select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`,
  )
  const fns = await db.query(
    `select p.oid::regprocedure::text as fn, p.prosecdef, p.proconfig::text as cfg, md5(p.prosrc) as src
       from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1`,
  )
  const trg = await db.query(
    `select tgrelid::regclass::text as t, tgname, tgfoid::regproc::text as fn, tgtype from pg_trigger where not tgisinternal order by 1, 2`,
  )
  const chk = await db.query(
    `select conrelid::regclass::text as t, conname, pg_get_constraintdef(oid) as def
       from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' order by 1, 2`,
  )
  const grants = await db.query(
    `select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
       from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
      group by 1, 2 order by 1, 2`,
  )
  return { pols: pols.rows, fns: fns.rows, trg: trg.rows, chk: chk.rows, grants: grants.rows }
}
