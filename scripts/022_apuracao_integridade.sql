-- 022_apuracao_integridade.sql
-- =====================================================================
-- Integridade, fechamento de competência, versionamento e auditoria da
-- apuracao_mensal (Relatório Executivo). Rode DEPOIS do 015/017/019/020.
-- Idempotente.
--
-- • Trava: competência fechada (locked_periods) não aceita incluir, alterar
--   nem apagar apuração — mesma regra das obrigações/guias (020).
-- • Versão otimista: cada UPDATE precisa trazer a versão que a tela carregou;
--   se outra pessoa salvou antes, o banco recusa (erro 40001) em vez de
--   sobrescrever em silêncio.
-- • Revisões: snapshot append-only de cada alteração/exclusão (o PDF já
--   entregue ao cliente pode ser reconstituído) + linha do tempo em history.
-- • Tipos: valores em numeric(15,2), alíquota numeric(9,6), CHECKs.
--
-- Contrato com o app (features/apuracao/services.ts):
--   competência nova      → INSERT (sem version)
--   competência existente → UPDATE ... WHERE id = :id  (com version carregada)
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.apuracao_mensal') is null then raise exception 'Rode o 015 antes do 022.'; end if;
  if to_regclass('public.locked_periods')  is null then raise exception 'Rode o 020 antes do 022.'; end if;
  if to_regprocedure('public.is_viewer()') is null then raise exception 'Rode o 017 antes do 022.'; end if;
end $$;

-- ─── 1. Colunas novas ────────────────────────────────────────────────
alter table public.apuracao_mensal
  add column if not exists version            integer,
  add column if not exists created_at         timestamptz,
  add column if not exists created_by         uuid,
  add column if not exists updated_by         uuid,
  add column if not exists updated_by_name    text,
  add column if not exists base_carga         numeric(15,2),
  add column if not exists total_provisao     numeric(15,2),
  add column if not exists total_retido       numeric(15,2),
  add column if not exists engine_version     text,
  add column if not exists payload_schema     smallint,
  add column if not exists retificacao_motivo text;

update public.apuracao_mensal set version = 1 where version is null;
update public.apuracao_mensal set created_at = coalesce(updated_at, now()) where created_at is null;
update public.apuracao_mensal set payload_schema = 1 where payload_schema is null;
update public.apuracao_mensal set
  faturamento = coalesce(faturamento, 0), rbt12 = coalesce(rbt12, 0), folha12m = coalesce(folha12m, 0),
  pro_labore = coalesce(pro_labore, 0), total_tributos = coalesce(total_tributos, 0),
  total_pagar = coalesce(total_pagar, 0), aliquota_efetiva = coalesce(aliquota_efetiva, 0),
  economia = coalesce(economia, 0), das = coalesce(das, 0), updated_at = coalesce(updated_at, now())
where faturamento is null or rbt12 is null or folha12m is null or pro_labore is null
   or total_tributos is null or total_pagar is null or aliquota_efetiva is null
   or economia is null or das is null or updated_at is null;

alter table public.apuracao_mensal
  alter column version        set default 1,     alter column version        set not null,
  alter column created_at     set default now(), alter column created_at     set not null,
  alter column created_by     set default auth.uid(),
  alter column updated_at     set default now(), alter column updated_at     set not null,
  alter column payload_schema set default 1,     alter column payload_schema set not null;

-- ─── 2. Tipos monetários (só altera se ainda for numeric sem escala) ─
do $$
declare
  c text;
  monet text[] := array['faturamento','rbt12','folha12m','pro_labore','total_tributos',
                        'total_pagar','economia','das'];
begin
  foreach c in array monet loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'apuracao_mensal'
                 and column_name = c and numeric_scale is null) then
      execute format('alter table public.apuracao_mensal alter column %I type numeric(15,2) using round(%I, 2)', c, c);
    end if;
    execute format('alter table public.apuracao_mensal alter column %I set default 0', c);
    execute format('alter table public.apuracao_mensal alter column %I set not null', c);
  end loop;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'apuracao_mensal'
               and column_name = 'aliquota_efetiva' and numeric_scale is null) then
    -- cargaEfetiva é percentual (ex.: 10.45) — ver engine.js resumoApuracao
    alter table public.apuracao_mensal alter column aliquota_efetiva type numeric(9,6) using round(aliquota_efetiva, 6);
  end if;
  alter table public.apuracao_mensal alter column aliquota_efetiva set default 0;
  alter table public.apuracao_mensal alter column aliquota_efetiva set not null;
end $$;

-- ─── 3. CHECKs (NOT VALID + tentativa de validar) ─────────────────────
alter table public.apuracao_mensal drop constraint if exists apuracao_comp_key_chk;
alter table public.apuracao_mensal add  constraint apuracao_comp_key_chk
  check (comp_key ~ '^\d{4}-(0[1-9]|1[0-2])$') not valid;

alter table public.apuracao_mensal drop constraint if exists apuracao_valores_nao_negativos_chk;
alter table public.apuracao_mensal add  constraint apuracao_valores_nao_negativos_chk
  check (faturamento >= 0 and rbt12 >= 0 and folha12m >= 0 and pro_labore >= 0
         and total_tributos >= 0 and das >= 0 and aliquota_efetiva >= 0) not valid;

alter table public.apuracao_mensal drop constraint if exists apuracao_payload_obj_chk;
alter table public.apuracao_mensal add  constraint apuracao_payload_obj_chk
  check (payload is null or jsonb_typeof(payload) = 'object') not valid;

do $$
declare k text;
begin
  foreach k in array array['apuracao_comp_key_chk', 'apuracao_valores_nao_negativos_chk', 'apuracao_payload_obj_chk'] loop
    begin
      execute format('alter table public.apuracao_mensal validate constraint %I', k);
    exception when check_violation then
      raise notice 'Constraint % NÃO validada: há linhas antigas fora da regra (novas gravações já são checadas).', k;
    end;
  end loop;
end $$;

-- ─── 4. Índices ───────────────────────────────────────────────────────
drop index if exists public.apuracao_mensal_client_idx;  -- coberto pelo unique (client_id, comp_key)
create index if not exists apuracao_mensal_comp_idx on public.apuracao_mensal (comp_key);

-- ─── 5. Trava de competência fechada ──────────────────────────────────
-- Colunas que mudam a cada save mas não são "conteúdo".
create or replace function public.apuracao_conteudo(r jsonb)
returns jsonb language sql immutable as $$
  select r - array['updated_at', 'updated_by', 'updated_by_name', 'version', 'engine_version',
                   'competence_short', 'retificacao_motivo', 'created_at', 'created_by']
$$;

create or replace function public.enforce_apuracao_lock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and public.apuracao_conteudo(to_jsonb(NEW)) = public.apuracao_conteudo(to_jsonb(OLD)) then
    return NEW;  -- save idêntico passa (mesma regra do 020)
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and exists (select 1 from public.locked_periods where period = OLD.comp_key) then
    raise exception 'Competência % está fechada. Reabra a competência para alterar esta apuração.', OLD.comp_key
      using errcode = 'check_violation';
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and exists (select 1 from public.locked_periods where period = NEW.comp_key) then
    raise exception 'Competência % está fechada. Reabra a competência para incluir esta apuração.', NEW.comp_key
      using errcode = 'check_violation';
  end if;

  return coalesce(NEW, OLD);
end $$;

-- ─── 6. Carimbo do servidor + controle otimista de versão ─────────────
create or replace function public.apuracao_before_write()
returns trigger language plpgsql as $$
begin
  NEW.competence_short := substr(NEW.comp_key, 6, 2) || '/' || left(NEW.comp_key, 4);

  if tg_op = 'INSERT' then
    NEW.version    := 1;
    NEW.created_at := now();
    NEW.created_by := auth.uid();
  else
    if NEW.client_id is distinct from OLD.client_id or NEW.comp_key is distinct from OLD.comp_key then
      raise exception 'Não é permitido trocar empresa/competência de uma apuração salva. Salve como nova competência.'
        using errcode = 'check_violation';
    end if;
    -- a tela envia a versão que carregou; diferente => alguém salvou antes
    if NEW.version is distinct from OLD.version then
      raise exception 'Esta competência foi alterada por outra pessoa (versão % no banco, % na tela). Recarregue antes de salvar.',
        OLD.version, coalesce(NEW.version::text, 'sem versão') using errcode = '40001';
    end if;
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    if public.apuracao_conteudo(to_jsonb(NEW)) = public.apuracao_conteudo(to_jsonb(OLD)) then
      NEW.updated_at := OLD.updated_at; NEW.updated_by := OLD.updated_by;
      NEW.updated_by_name := OLD.updated_by_name;
      return NEW;  -- nada mudou: não incrementa a versão
    end if;
    NEW.version := OLD.version + 1;
  end if;

  NEW.updated_at      := now();
  NEW.updated_by      := auth.uid();
  NEW.updated_by_name := coalesce(auth.jwt() ->> 'email', 'Sistema');
  return NEW;
end $$;

-- ─── 7. Revisões (append-only) ────────────────────────────────────────
create table if not exists public.apuracao_mensal_revisoes (
  id               bigint generated always as identity primary key,
  apuracao_id      uuid        not null,          -- sem FK: sobrevive ao DELETE/cascade
  client_id        uuid        not null,
  comp_key         text        not null,
  version          integer     not null,          -- versão do snapshot (OLD)
  op               text        not null check (op in ('UPDATE', 'DELETE')),
  motivo           text,
  snapshot         jsonb       not null,
  changed_at       timestamptz not null default now(),
  changed_by       uuid,
  changed_by_name  text
);
create index if not exists apuracao_rev_client_comp_idx
  on public.apuracao_mensal_revisoes (client_id, comp_key, version desc);

alter table public.apuracao_mensal_revisoes enable row level security;
drop policy if exists "read non-viewer" on public.apuracao_mensal_revisoes;
create policy "read non-viewer" on public.apuracao_mensal_revisoes
  for select to authenticated using (not public.is_viewer());
-- sem políticas de escrita: só o trigger (security definer) grava
revoke insert, update, delete, truncate on public.apuracao_mensal_revisoes from anon, authenticated;

create or replace function public.apuracao_log_revisao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and NEW.version = OLD.version then
    return NEW;  -- no-op, nada a registrar
  end if;
  insert into public.apuracao_mensal_revisoes
    (apuracao_id, client_id, comp_key, version, op, motivo, snapshot, changed_by, changed_by_name)
  values
    (OLD.id, OLD.client_id, OLD.comp_key, OLD.version, tg_op,
     case when tg_op = 'UPDATE' then NEW.retificacao_motivo end,
     to_jsonb(OLD), auth.uid(), coalesce(auth.jwt() ->> 'email', 'Sistema'));
  return coalesce(NEW, OLD);
end $$;
revoke all on function public.apuracao_log_revisao() from public, anon, authenticated;

-- ─── 8. Gatilhos (ordem alfabética: lock → stamp; revisão AFTER) ──────
drop trigger if exists apuracao_mensal_a_lock          on public.apuracao_mensal;
drop trigger if exists apuracao_mensal_b_stamp         on public.apuracao_mensal;
drop trigger if exists apuracao_mensal_z_revisao       on public.apuracao_mensal;
drop trigger if exists apuracao_mensal_history_trigger on public.apuracao_mensal;

create trigger apuracao_mensal_a_lock
  before insert or update or delete on public.apuracao_mensal
  for each row execute function public.enforce_apuracao_lock();
create trigger apuracao_mensal_b_stamp
  before insert or update on public.apuracao_mensal
  for each row execute function public.apuracao_before_write();
create trigger apuracao_mensal_z_revisao
  after update or delete on public.apuracao_mensal
  for each row execute function public.apuracao_log_revisao();

-- ─── 9. Linha do tempo geral (history): criado/removido ───────────────
alter table public.history drop constraint if exists history_entity_type_check;
alter table public.history add constraint history_entity_type_check
  check (entity_type in ('obligation', 'tax', 'installment', 'client', 'service', 'period', 'apuracao'));
create trigger apuracao_mensal_history_trigger
  after insert or delete on public.apuracao_mensal
  for each row execute function public.add_history_entry('apuracao');

-- ─── 10. View analítica (evolução anual / comparativo entre empresas) ─
create or replace view public.apuracao_mensal_resumo
with (security_invoker = true) as
select a.client_id, c.name as client_name, a.comp_key,
       left(a.comp_key, 4)::int as ano, substr(a.comp_key, 6, 2)::int as mes,
       a.regime, a.faturamento, a.total_tributos, a.base_carga, a.total_pagar,
       a.aliquota_efetiva, a.das, a.economia, a.version, a.updated_at
from public.apuracao_mensal a
join public.clients c on c.id = a.client_id;

commit;

-- ─── 11. OPCIONAL (LGPD) — DECISÃO DO ESCRITÓRIO ──────────────────────
-- Hoje o perfil somente leitura (viewer) lê a apuração inteira, inclusive o
-- payload com NOME e PRÓ-LABORE de cada sócio (dado pessoal). Descomente se o
-- viewer NÃO deve ver esse detalhe — ele passa a ver só um resumo por empresa.
-- drop policy if exists "read all authenticated" on public.apuracao_mensal;
-- create policy "read non-viewer" on public.apuracao_mensal
--   for select to authenticated using (not public.is_viewer());
-- create or replace function public.apuracao_resumo_viewer(p_client uuid)
-- returns table (comp_key text, faturamento numeric, total_tributos numeric,
--                total_pagar numeric, aliquota_efetiva numeric)
-- language sql stable security definer set search_path = public as $$
--   select comp_key, faturamento, total_tributos, total_pagar, aliquota_efetiva
--   from public.apuracao_mensal
--   where client_id = p_client and auth.role() = 'authenticated'
--   order by comp_key
-- $$;
-- revoke all on function public.apuracao_resumo_viewer(uuid) from public, anon;
-- grant execute on function public.apuracao_resumo_viewer(uuid) to authenticated;
