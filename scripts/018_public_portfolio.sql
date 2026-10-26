-- 018_public_portfolio.sql
-- =====================================================================
-- Painel público (sem login): expõe SOMENTE dados agregados/anônimos da
-- carteira — nunca nome, CNPJ, fantasia ou localização. Sem lista por
-- empresa e sem grupos com menos de 3 empresas (somados em "outros" ou
-- omitidos), para que ninguém deduza regime/atividade de uma empresa.
-- Mesma definição do 023 (rodar de novo não regride).
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

-- Só a função é exposta ao anônimo — as tabelas seguem bloqueadas pelo RLS.
revoke all on function public.portfolio_publico() from public;
grant execute on function public.portfolio_publico() to anon, authenticated;
