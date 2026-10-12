-- 021_office_holidays.sql
-- =====================================================================
-- Feriados ESTADUAIS / MUNICIPAIS do escritório (ex.: aniversário da
-- cidade, Data Magna do estado). Entram no cálculo de dia útil junto com os
-- feriados nacionais — vencimentos que caem neles antecipam/postergam.
-- Cadastrados em Configurações. Rode DEPOIS do 017. Idempotente.
-- =====================================================================

create table if not exists public.office_holidays (
  holiday_date  date primary key,
  name          text not null,
  scope         text not null default 'municipal' check (scope in ('estadual', 'municipal', 'facultativo')),
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid()
);

alter table public.office_holidays enable row level security;

drop policy if exists "read all authenticated" on public.office_holidays;
drop policy if exists "write non-viewer insert" on public.office_holidays;
drop policy if exists "write non-viewer update" on public.office_holidays;
drop policy if exists "write non-viewer delete" on public.office_holidays;
create policy "read all authenticated" on public.office_holidays for select to authenticated using (true);
create policy "write non-viewer insert" on public.office_holidays for insert to authenticated with check (not public.is_viewer());
create policy "write non-viewer update" on public.office_holidays for update to authenticated using (not public.is_viewer()) with check (not public.is_viewer());
create policy "write non-viewer delete" on public.office_holidays for delete to authenticated using (not public.is_viewer());
