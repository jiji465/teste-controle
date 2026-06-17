-- 015_apuracao_mensal.sql
-- Camada financeira para o módulo "Relatório Executivo".
-- Guarda, por empresa (client_id) e competência, os números da apuração que
-- alimentam o gráfico de evolução e o PDF executivo. NÃO substitui o controle
-- fiscal (prazos/status) — apenas adiciona os valores em R$.
--
-- RLS aberto (mesma política do restante do app, por enquanto sem login).
-- Rode este arquivo no SQL Editor do Supabase.

create table if not exists public.apuracao_mensal (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  comp_key text not null,                  -- 'AAAA-MM'  (ex.: '2026-05')
  competence_short text,                    -- 'MM/AAAA'
  regime text,
  anexo text,
  atividade text,
  -- entradas
  faturamento numeric default 0,
  rbt12 numeric default 0,
  folha12m numeric default 0,
  pro_labore numeric default 0,
  -- saídas calculadas (snapshot p/ evolução e listagem)
  total_tributos numeric default 0,
  total_pagar numeric default 0,
  aliquota_efetiva numeric default 0,
  economia numeric default 0,
  das numeric default 0,
  -- estado completo do editor (taxes, repartição, retenções, flags, campos opcionais)
  -- permite reabrir uma competência e re-gerar o PDF idêntico
  payload jsonb,
  updated_at timestamptz default now(),
  unique (client_id, comp_key)
);

create index if not exists apuracao_mensal_client_idx on public.apuracao_mensal (client_id);
create index if not exists apuracao_mensal_comp_idx on public.apuracao_mensal (comp_key);

alter table public.apuracao_mensal enable row level security;

drop policy if exists "Allow public access to apuracao_mensal" on public.apuracao_mensal;
create policy "Allow public access to apuracao_mensal"
  on public.apuracao_mensal for all using (true) with check (true);
