-- 019_hardening.sql
-- =====================================================================
-- Blindagem de segurança e integridade. Rode DEPOIS do 017/018.
-- Idempotente: pode rodar várias vezes.
--
-- 1. RLS na tabela `services` (estava sem RLS: qualquer um com a anon key
--    lia e escrevia).
-- 2. Remove as políticas antigas "Allow public access ..." (USING true) que
--    os scripts 002/015/setup_complete criavam — elas SOMAM às políticas
--    restritas e reabriam as tabelas.
-- 3. Índices únicos: CNPJ por cliente e (cliente, nome, competência) em
--    guias/obrigações. Se houver duplicatas, o índice NÃO é criado e um
--    aviso é exibido (rode o 011_cleanup_duplicates.sql antes).
-- 4. Tabela `history`: CHECKs aceitam 'deleted', 'client', 'service' e o
--    autor passa a ser o usuário logado (e-mail do JWT), não 'Sistema'.
--
-- Reexecução segura: as funções aqui são as mesmas do 023 e, se o 023 já
-- foi aplicado, as políticas NÃO são recriadas (o 023 as governa). A lista
-- do CHECK de history é a completa (inclui 'apuracao' do 022).
-- =====================================================================

-- ─── 1 + 2. RLS ───────────────────────────────────────────────────────
do $$
declare
  t text;
  tabelas text[] := array[
    'clients','taxes','obligations','installments','history','services',
    'apuracao_mensal','custom_obligation_templates','deleted_default_templates'
  ];
begin
  if to_regprocedure('public.is_staff()') is not null then
    raise notice '019: 023 já aplicado — políticas mantidas (governadas pelo 023).';
    return;
  end if;

  foreach t in array tabelas loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);

      -- políticas públicas antigas
      execute format('drop policy if exists %I on public.%I', 'Allow public access to ' || t, t);
      execute format('drop policy if exists "Authenticated full access" on public.%I', t);

      -- mesmas políticas do 017 (leitura: logado; escrita: não-viewer)
      execute format('drop policy if exists "read all authenticated" on public.%I', t);
      execute format('drop policy if exists "write non-viewer insert" on public.%I', t);
      execute format('drop policy if exists "write non-viewer update" on public.%I', t);
      execute format('drop policy if exists "write non-viewer delete" on public.%I', t);
      execute format('create policy "read all authenticated" on public.%I for select to authenticated using (true)', t);
      execute format('create policy "write non-viewer insert" on public.%I for insert to authenticated with check (not public.is_viewer())', t);
      execute format('create policy "write non-viewer update" on public.%I for update to authenticated using (not public.is_viewer()) with check (not public.is_viewer())', t);
      execute format('create policy "write non-viewer delete" on public.%I for delete to authenticated using (not public.is_viewer())', t);
    end if;
  end loop;
end $$;

-- ─── 3. Índices únicos (só cria se não houver duplicatas) ─────────────
do $$
begin
  if exists (
    select 1 from public.clients
    where coalesce(cnpj, '') <> ''
    group by upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g'))
    having count(*) > 1
  ) then
    raise notice 'CNPJ duplicado em clients — índice único NÃO criado. Resolva as duplicatas e rode de novo.';
  else
    create unique index if not exists clients_unique_cnpj
      on public.clients (upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g')))
      where coalesce(cnpj, '') <> '';
  end if;

  if exists (
    select 1 from public.taxes
    where client_id is not null and competency_month is not null
    group by client_id, name, competency_month having count(*) > 1
  ) then
    raise notice 'Guias duplicadas por competência — rode 011_cleanup_duplicates.sql antes.';
  else
    create unique index if not exists taxes_unique_per_competency
      on public.taxes (client_id, name, competency_month)
      where client_id is not null and competency_month is not null;
  end if;

  if exists (
    select 1 from public.obligations
    where client_id is not null and competency_month is not null
    group by client_id, name, competency_month having count(*) > 1
  ) then
    raise notice 'Obrigações duplicadas por competência — rode 011_cleanup_duplicates.sql antes.';
  else
    create unique index if not exists obligations_unique_per_competency
      on public.obligations (client_id, name, competency_month)
      where client_id is not null and competency_month is not null;
  end if;
end $$;

-- ─── 4. Histórico ─────────────────────────────────────────────────────
alter table public.history drop constraint if exists history_entity_type_check;
alter table public.history add constraint history_entity_type_check
  check (entity_type in ('obligation', 'tax', 'installment', 'client', 'service', 'period', 'apuracao'));

alter table public.history drop constraint if exists history_action_check;
alter table public.history add constraint history_action_check
  check (action in ('created', 'updated', 'completed', 'status_changed', 'comment_added', 'deleted', 'locked', 'unlocked'));

alter table public.history add column if not exists user_id uuid;
create index if not exists idx_history_entity on public.history(entity_type, entity_id);

-- Autor = e-mail do token (servidor). completed_by (digitado na tela) só
-- aparece na descrição — não define o autor.
create or replace function public.history_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'Sistema')
$$;

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

-- Gatilhos (inclui DELETE e a tabela services)
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
