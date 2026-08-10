-- 016_auth_rls_lockdown.sql
-- =====================================================================
-- Tranca o banco: acesso somente para usuários LOGADOS (Supabase Auth).
-- Modelo: escritório compartilhado — qualquer usuário autenticado vê e
-- edita os mesmos dados. Também corrige os alertas "RLS Disabled in Public"
-- das tabelas de templates (que estavam sem RLS).
--
-- ⚠️ ORDEM: rode este script SÓ DEPOIS de:
--   1. criar sua conta (Authentication > Users, ou pela tela /login), e
--   2. confirmar que você consegue ENTRAR no sistema.
-- Rodar antes disso trancaria o acesso antes de você ter um login válido.
--
-- É idempotente (pode rodar de novo sem erro) e ignora tabelas que ainda
-- não existam (ex.: apuracao_mensal, se você ainda não rodou o 015).
-- =====================================================================

do $$
declare
  t text;
  tabelas text[] := array[
    'clients',
    'taxes',
    'obligations',
    'installments',
    'history',
    'apuracao_mensal',
    'custom_obligation_templates',
    'deleted_default_templates',
    'locked_periods'
  ];
begin
  foreach t in array tabelas loop
    -- só mexe se a tabela existir de fato
    if to_regclass('public.' || t) is not null then
      -- 1) liga o RLS (nega tudo por padrão até haver política)
      execute format('alter table public.%I enable row level security', t);

      -- 2) remove políticas antigas que liberavam acesso público/anônimo
      execute format('drop policy if exists "Allow public access to %s" on public.%I', t, t);
      execute format('drop policy if exists "Authenticated full access" on public.%I', t);

      -- 3) nova política: só o papel "authenticated" (logado) acessa; dados compartilhados
      execute format(
        'create policy "Authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
        t
      );

      raise notice 'RLS aplicado em public.%', t;
    end if;
  end loop;
end $$;
