-- 018_public_portfolio.sql
-- =====================================================================
-- Painel público (sem login): expõe SOMENTE dados agregados/anônimos da
-- carteira — nunca nome, CNPJ, fantasia ou localização.
--
-- Como funciona: uma função "security definer" roda com privilégio do dono
-- (contorna o RLS internamente), mas devolve apenas os campos seguros que
-- estão escritos aqui dentro. As tabelas continuam TRANCADAS para o anônimo;
-- ele só pode chamar esta função (via rpc), nada mais.
-- =====================================================================

create or replace function public.portfolio_publico()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total',   (select count(*) from clients),
    'ativos',  (select count(*) from clients where status = 'active'),
    'inativos',(select count(*) from clients where status is distinct from 'active'),
    -- distribuições (contagens anônimas — não ligam nome a categoria)
    'porRegime', (
      select coalesce(jsonb_object_agg(coalesce(tax_regime, 'nao_informado'), n), '{}'::jsonb)
      from (select tax_regime, count(*) n from clients group by tax_regime) r
    ),
    'porAtividade', (
      select coalesce(jsonb_object_agg(coalesce(business_activity, 'nao_informado'), n), '{}'::jsonb)
      from (select business_activity, count(*) n from clients group by business_activity) a
    ),
    -- lista ANÔNIMA: só regime, atividade e status. Sem id, nome, CNPJ, local.
    'empresas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'regime', tax_regime,
               'atividade', business_activity,
               'status', status
             ) order by tax_regime nulls last, business_activity nulls last), '[]'::jsonb)
      from clients
    )
  );
$$;

-- Só a função é exposta ao anônimo — as tabelas seguem bloqueadas pelo RLS.
revoke all on function public.portfolio_publico() from public;
grant execute on function public.portfolio_publico() to anon, authenticated;
