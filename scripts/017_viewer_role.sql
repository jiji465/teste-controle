-- 017_viewer_role.sql
-- =====================================================================
-- Papel "viewer" (somente leitura) no banco.
-- Leitura: qualquer usuário logado. Escrita (insert/update/delete): só quem
-- NÃO for viewer. O papel vem de auth.users.raw_app_meta_data->>'role'
-- (app_metadata) — que só o servidor/painel define, o usuário não altera.
--
-- Rode DEPOIS do 016. É idempotente e ignora tabelas ausentes.
--
-- Para tornar alguém visualizador (troque o e-mail):
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"viewer"}'::jsonb
--   where email = 'visualizador@exemplo.com';
-- (a pessoa precisa sair e entrar de novo para o papel valer no token)
-- =====================================================================

-- true quando o usuário logado tem app_metadata.role = 'viewer'
create or replace function public.is_viewer()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'viewer', false)
$$;

do $$
declare
  t text;
  tabelas text[] := array[
    'clients','taxes','obligations','installments','history',
    'apuracao_mensal','custom_obligation_templates','deleted_default_templates','locked_periods'
  ];
begin
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);

      -- remove políticas anteriores (016 e reexecuções deste)
      execute format('drop policy if exists "Authenticated full access" on public.%I', t);
      execute format('drop policy if exists "read all authenticated" on public.%I', t);
      execute format('drop policy if exists "write non-viewer insert" on public.%I', t);
      execute format('drop policy if exists "write non-viewer update" on public.%I', t);
      execute format('drop policy if exists "write non-viewer delete" on public.%I', t);

      -- LEITURA: qualquer usuário logado
      execute format('create policy "read all authenticated" on public.%I for select to authenticated using (true)', t);

      -- ESCRITA: só quem NÃO é viewer
      execute format('create policy "write non-viewer insert" on public.%I for insert to authenticated with check (not public.is_viewer())', t);
      execute format('create policy "write non-viewer update" on public.%I for update to authenticated using (not public.is_viewer()) with check (not public.is_viewer())', t);
      execute format('create policy "write non-viewer delete" on public.%I for delete to authenticated using (not public.is_viewer())', t);

      raise notice 'Papel viewer aplicado em public.%', t;
    end if;
  end loop;
end $$;
