-- 023_papeis_auditoria.sql
-- =====================================================================
-- Papéis deny-by-default, histórico à prova de adulteração, fechamento de
-- competência auditado e search_path fixo em todas as funções.
-- Rode DEPOIS do 022. Idempotente: pode rodar quantas vezes quiser.
--
-- O que muda:
--  1. Papéis (app_metadata.role, definido só pelo servidor/painel):
--       viewer  → lê empresas (clients), obrigações (indicadores do
--                 Dashboard), competências fechadas e feriados. Nada mais.
--       editor  → lê e grava tudo (exceto o histórico, que é só leitura).
--       admin   → igual ao editor.
--       sem papel / login anônimo → NÃO lê nem grava nada.
--     ⚠️ Na PRIMEIRA execução, todas as contas que já existem e estão sem
--     papel recebem role = 'editor' (bloco 2) — ninguém fica trancado do
--     lado de fora. Contas criadas DEPOIS disso nascem sem papel (sem
--     acesso) até alguém definir o papel delas.
--  2. history: só leitura para editor/admin. Ninguém grava direto pela API;
--     os gatilhos (SECURITY DEFINER) gravam o autor a partir do token
--     (e-mail do JWT), não de um campo que a tela possa forjar.
--  3. locked_periods: quem fechou/quando é carimbado pelo servidor e cada
--     fechamento/reabertura vira uma linha no history (entity_type 'period').
--  4. Upsert idêntico em competência fechada volta a funcionar (o BEFORE
--     INSERT não barra mais o INSERT ... ON CONFLICT de um id que já existe).
--  5. Todas as funções com search_path fixo.
--  6. Painel público: sem lista por empresa; grupos com menos de 3 empresas
--     são somados em "outros" (ou omitidos, se ainda forem menos de 3).
--
-- Depois de rodar: cada pessoa precisa SAIR e ENTRAR de novo (ou aguardar até
-- 1h) para o token carregar o papel. O app já tenta renovar o token sozinho.
--
-- Para mudar o papel de alguém (troque o e-mail e o papel):
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"viewer"}'::jsonb
--   where email = 'pessoa@exemplo.com';
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.locked_periods') is null then raise exception 'Rode o 020 antes do 023.'; end if;
  if to_regclass('public.office_holidays') is null then raise exception 'Rode o 021 antes do 023.'; end if;
  if to_regclass('public.apuracao_mensal_revisoes') is null then raise exception 'Rode o 022 antes do 023.'; end if;
end $$;

-- ─── 1. Registro de migrações (interno, invisível pela API) ───────────
create table if not exists public._migracoes (
  id          text primary key,
  aplicada_em timestamptz not null default now(),
  detalhe     text
);
alter table public._migracoes enable row level security;
revoke all on table public._migracoes from anon, authenticated;

-- ─── 2. Backfill ÚNICO de papéis (antes das novas políticas) ──────────
-- Contas existentes sem papel viram 'editor' para manter o acesso de hoje.
-- Roda uma única vez (marcado em _migracoes): numa reexecução, contas novas
-- sem papel continuam SEM acesso — defina o papel delas explicitamente.
-- Contas anônimas (is_anonymous) nunca recebem papel.
do $$
declare
  n integer;
  tem_anon boolean;
begin
  if exists (select 1 from public._migracoes where id = '023_backfill_roles') then
    raise notice '023: backfill de papéis já aplicado antes — nada a fazer.';
    return;
  end if;
  select exists (select 1 from information_schema.columns
                 where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous')
    into tem_anon;
  execute
    'update auth.users
        set raw_app_meta_data = coalesce(raw_app_meta_data, ''{}''::jsonb) || ''{"role":"editor"}''::jsonb
      where coalesce(raw_app_meta_data ->> ''role'', '''') = '''''
    || case when tem_anon then ' and not coalesce(is_anonymous, false)' else '' end;
  get diagnostics n = row_count;
  insert into public._migracoes (id, detalhe) values ('023_backfill_roles', n || ' conta(s) receberam role=editor');
  raise notice '023: % conta(s) existentes sem papel receberam role=editor.', n;
end $$;

-- ─── 3. Funções de papel ──────────────────────────────────────────────
-- Papel do token atual; null para anônimo (sem login ou login anônimo).
create or replace function public.app_role()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when auth.role() is distinct from 'authenticated' then null
    when coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then null
    else nullif(auth.jwt() -> 'app_metadata' ->> 'role', '')
  end
$$;

-- Pode LER as tabelas do Dashboard/Empresas (viewer, editor, admin).
create or replace function public.can_read()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.app_role() in ('viewer', 'editor', 'admin'), false)
$$;

-- Equipe do escritório: lê tudo e grava (editor, admin).
create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.app_role() in ('editor', 'admin'), false)
$$;

-- Mantida por compatibilidade (017).
create or replace function public.is_viewer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'viewer', false)
$$;

revoke all on function public.app_role(), public.can_read(), public.is_staff() from public;
grant execute on function public.app_role(), public.can_read(), public.is_staff() to anon, authenticated, service_role;

-- ─── 4. Políticas deny-by-default ─────────────────────────────────────
-- Remove TODAS as políticas antigas dessas tabelas (016/017/019/020/021/022
-- e eventuais "Allow public access") e recria só as do modelo de papéis.
do $$
declare
  t text;
  p record;
  -- o viewer lê: Empresas + indicadores do Dashboard (obrigações) + travas/feriados
  leitura_viewer text[] := array['clients', 'obligations', 'locked_periods', 'office_holidays'];
  -- só a equipe lê (dados financeiros, LGPD, auditoria, configurações internas)
  leitura_equipe text[] := array['taxes', 'installments', 'services', 'apuracao_mensal',
                                 'apuracao_mensal_revisoes', 'history',
                                 'custom_obligation_templates', 'deleted_default_templates'];
  -- tabelas sem escrita pela API (só gatilhos SECURITY DEFINER gravam)
  somente_leitura text[] := array['history', 'apuracao_mensal_revisoes'];
begin
  foreach t in array leitura_viewer || leitura_equipe loop
    if to_regclass('public.' || t) is null then
      raise notice '023: tabela public.% não existe — pulada.', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    -- anônimo não tem nada a fazer nas tabelas (o painel público usa a função)
    execute format('revoke all on table public.%I from anon', t);

    if t = any (leitura_viewer) then
      execute format('create policy "papel: leitura" on public.%I for select to authenticated using ((select public.can_read()))', t);
    else
      execute format('create policy "papel: leitura" on public.%I for select to authenticated using ((select public.is_staff()))', t);
    end if;

    if t = any (somente_leitura) then
      execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
      execute format('grant select on table public.%I to authenticated', t);
    else
      execute format('create policy "papel: incluir" on public.%I for insert to authenticated with check ((select public.is_staff()))', t);
      execute format('create policy "papel: alterar" on public.%I for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
      execute format('create policy "papel: excluir" on public.%I for delete to authenticated using ((select public.is_staff()))', t);
    end if;
  end loop;
end $$;

-- A view analítica (022) segue o RLS de apuracao_mensal (security_invoker);
-- mesmo assim, o anônimo não precisa dela.
do $$
begin
  if to_regclass('public.apuracao_mensal_resumo') is not null then
    revoke all on table public.apuracao_mensal_resumo from anon;
  end if;
end $$;

-- ─── 5. Histórico ─────────────────────────────────────────────────────
-- entity_key: chave textual para entidades sem uuid (ex.: competência '2026-03').
alter table public.history add column if not exists entity_key text;
alter table public.history add column if not exists user_id uuid;

alter table public.history drop constraint if exists history_entity_type_check;
alter table public.history add constraint history_entity_type_check
  check (entity_type in ('obligation', 'tax', 'installment', 'client', 'service', 'period', 'apuracao'));
alter table public.history drop constraint if exists history_action_check;
alter table public.history add constraint history_action_check
  check (action in ('created', 'updated', 'completed', 'status_changed', 'comment_added', 'deleted', 'locked', 'unlocked'));
create index if not exists idx_history_entity_key on public.history (entity_type, entity_key) where entity_key is not null;

-- Autor = e-mail do token (o usuário não altera). Nunca user_metadata, que
-- o próprio usuário edita via auth.updateUser().
create or replace function public.history_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'Sistema')
$$;

-- Gatilho de auditoria. SECURITY DEFINER: grava no history mesmo sem o
-- usuário ter permissão de INSERT lá. user_name vem SEMPRE do servidor;
-- o completed_by digitado na tela só entra como informação na descrição.
create or replace function public.add_history_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_status       text;
  old_status       text;
  new_completed_at text;
  old_completed_at text;
  new_completed_by text;
begin
  if tg_op = 'INSERT' then
    insert into public.history (entity_type, entity_id, action, description, user_name, user_id)
    values (tg_argv[0], NEW.id, 'created', 'Registro criado', public.history_actor(), auth.uid());
    return NEW;
  end if;

  if tg_op = 'UPDATE' then
    new_status       := to_jsonb(NEW) ->> 'status';
    old_status       := to_jsonb(OLD) ->> 'status';
    new_completed_at := to_jsonb(NEW) ->> 'completed_at';
    old_completed_at := to_jsonb(OLD) ->> 'completed_at';
    new_completed_by := left(nullif(btrim(to_jsonb(NEW) ->> 'completed_by'), ''), 120);

    if new_status is not null and new_status is distinct from old_status then
      insert into public.history (entity_type, entity_id, action, description, user_name, user_id)
      values (
        tg_argv[0], NEW.id, 'status_changed',
        'Status alterado de ' || coalesce(old_status, 'N/A') || ' para ' || new_status,
        public.history_actor(), auth.uid()
      );
    end if;

    if new_completed_at is not null and old_completed_at is null then
      insert into public.history (entity_type, entity_id, action, description, user_name, user_id)
      values (
        tg_argv[0], NEW.id, 'completed',
        'Registro concluído em ' || new_completed_at
          || coalesce(' (responsável informado: ' || new_completed_by || ')', ''),
        public.history_actor(), auth.uid()
      );
    end if;

    return NEW;
  end if;

  if tg_op = 'DELETE' then
    insert into public.history (entity_type, entity_id, action, description, user_name, user_id)
    values (tg_argv[0], OLD.id, 'deleted', 'Registro removido', public.history_actor(), auth.uid());
    return OLD;
  end if;

  return null;
end;
$$;
revoke all on function public.add_history_entry() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('obligations', 'obligation'), ('taxes', 'tax'), ('installments', 'installment'),
      ('clients', 'client'), ('services', 'service')
    ) as v(tbl, kind)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists %I on public.%I', t.tbl || '_history_trigger', t.tbl);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.add_history_entry(%L)',
        t.tbl || '_history_trigger', t.tbl, t.kind
      );
    end if;
  end loop;
end $$;

-- ─── 6. Fechamento de competência: carimbo do servidor + auditoria ────
create or replace function public.locked_periods_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    NEW.locked_at      := now();
    NEW.locked_by      := auth.uid();
    NEW.locked_by_name := public.history_actor();
  else
    -- re-fechar (upsert) não troca o autor/data do fechamento original
    NEW.period         := OLD.period;
    NEW.locked_at      := OLD.locked_at;
    NEW.locked_by      := OLD.locked_by;
    NEW.locked_by_name := OLD.locked_by_name;
  end if;
  return NEW;
end;
$$;

-- entity_id é uuid: usamos um uuid determinístico derivado da competência
-- (md5('period:AAAA-MM')) e a competência legível em entity_key.
create or replace function public.log_period_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text := coalesce(NEW.period, OLD.period);
begin
  insert into public.history (entity_type, entity_id, entity_key, action, description, user_name, user_id)
  values (
    'period', md5('period:' || p)::uuid, p,
    case when tg_op = 'INSERT' then 'locked' else 'unlocked' end,
    case when tg_op = 'INSERT' then 'Competência ' || p || ' fechada'
         else 'Competência ' || p || ' reaberta' end,
    public.history_actor(), auth.uid()
  );
  return coalesce(NEW, OLD);
end;
$$;
revoke all on function public.locked_periods_before_write(), public.log_period_lock() from public, anon, authenticated;

drop trigger if exists locked_periods_a_stamp on public.locked_periods;
create trigger locked_periods_a_stamp
  before insert or update on public.locked_periods
  for each row execute function public.locked_periods_before_write();
drop trigger if exists locked_periods_z_history on public.locked_periods;
create trigger locked_periods_z_history
  after insert or delete on public.locked_periods
  for each row execute function public.log_period_lock();

-- ─── 7. Trava de competência (020/022) com search_path fixo ───────────
create or replace function public.row_competency(r jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(left(r ->> 'competency_month', 7), ''),
    case when r ? 'due_date' and (r ->> 'due_date') is not null
         then left(r ->> 'due_date', 7) end
  )
$$;

create or replace function public.enforce_period_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  comp_old  text;
  comp_new  text;
  ja_existe boolean;
begin
  if tg_op = 'UPDATE' and to_jsonb(NEW) = to_jsonb(OLD) then
    return NEW;  -- upsert idêntico: nada muda
  end if;

  -- INSERT ... ON CONFLICT (upsert do app/PostgREST) de um id que JÁ existe:
  -- vira UPDATE (ou erro de chave) — quem decide é o gatilho de UPDATE.
  if tg_op = 'INSERT' then
    execute format('select exists (select 1 from %I.%I where id = $1)', tg_table_schema, tg_table_name)
      into ja_existe using NEW.id;
    if ja_existe then
      return NEW;
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    comp_old := public.row_competency(to_jsonb(OLD));
    if comp_old is not null and exists (select 1 from public.locked_periods where period = comp_old) then
      raise exception 'Competência % está fechada. Reabra a competência para alterar ou excluir este item.', comp_old
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    comp_new := public.row_competency(to_jsonb(NEW));
    if comp_new is not null and exists (select 1 from public.locked_periods where period = comp_new) then
      raise exception 'Competência % está fechada. Reabra a competência para mover este item para ela.', comp_new
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'INSERT' then
    comp_new := public.row_competency(to_jsonb(NEW));
    if comp_new is not null and exists (select 1 from public.locked_periods where period = comp_new) then
      raise exception 'Competência % está fechada. Reabra a competência para incluir itens nela.', comp_new
        using errcode = 'check_violation';
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create or replace function public.apuracao_conteudo(r jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select r - array['updated_at', 'updated_by', 'updated_by_name', 'version', 'engine_version',
                   'competence_short', 'retificacao_motivo', 'created_at', 'created_by']
$$;

create or replace function public.enforce_apuracao_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and public.apuracao_conteudo(to_jsonb(NEW)) = public.apuracao_conteudo(to_jsonb(OLD)) then
    return NEW;  -- save idêntico passa (mesma regra do 020)
  end if;

  -- upsert de uma apuração que já existe: o gatilho de UPDATE decide
  if tg_op = 'INSERT' and exists (select 1 from public.apuracao_mensal where id = NEW.id) then
    return NEW;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and exists (select 1 from public.locked_periods where period = OLD.comp_key) then
    raise exception 'Competência % está fechada. Reabra a competência para alterar ou excluir esta apuração.', OLD.comp_key
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE'
     and exists (select 1 from public.locked_periods where period = NEW.comp_key) then
    raise exception 'Competência % está fechada. Reabra a competência para alterar esta apuração.', NEW.comp_key
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT'
     and exists (select 1 from public.locked_periods where period = NEW.comp_key) then
    raise exception 'Competência % está fechada. Reabra a competência para incluir esta apuração.', NEW.comp_key
      using errcode = 'check_violation';
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create or replace function public.apuracao_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
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
end;
$$;

create or replace function public.apuracao_log_revisao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
end;
$$;
revoke all on function public.apuracao_log_revisao() from public, anon, authenticated;

-- ─── 8. Painel público: só agregados, sem grupos pequenos ─────────────
create or replace function public.portfolio_publico()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with base as (
    select coalesce(c.tax_regime, 'nao_informado') as regime,
           coalesce(c.business_activity, 'nao_informado') as atividade,
           c.status
    from public.clients c
  ),
  reg as (select regime as k, count(*) as n from base group by regime),
  ati as (select atividade as k, count(*) as n from base group by atividade)
  select jsonb_build_object(
    'total',    (select count(*) from base),
    'ativos',   (select count(*) from base where status = 'active'),
    'inativos', (select count(*) from base where status is distinct from 'active'),
    -- distribuições: grupos com menos de 3 empresas são somados em "outros";
    -- se "outros" também ficar abaixo de 3, ele é omitido.
    'porRegime', (
      select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select k, n from reg where n >= 3
        union all
        select 'outros', sum(n) from reg where n < 3 having sum(n) >= 3
      ) r
    ),
    'porAtividade', (
      select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select k, n from ati where n >= 3
        union all
        select 'outros', sum(n) from ati where n < 3 having sum(n) >= 3
      ) a
    )
  );
$$;
revoke all on function public.portfolio_publico() from public;
grant execute on function public.portfolio_publico() to anon, authenticated;

insert into public._migracoes (id, detalhe) values ('023_papeis_auditoria', 'aplicada')
on conflict (id) do update set aplicada_em = now();

commit;

-- ─── Conferência (rode à parte, depois) ───────────────────────────────
-- Contas e papéis:
--   select email, raw_app_meta_data ->> 'role' as papel from auth.users order by 2 nulls first, 1;
-- Funções sem search_path fixo (deve voltar vazio):
--   select p.oid::regprocedure from pg_proc p
--   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
--     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
