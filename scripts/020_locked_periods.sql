-- 020_locked_periods.sql
-- =====================================================================
-- Fechamento de competência no BANCO (antes vivia só no navegador).
--
-- • Tabela locked_periods: uma linha por competência fechada ('YYYY-MM').
-- • Trigger BEFORE em obligations / taxes / services: recusa criar,
--   alterar ou apagar item de competência fechada. Vale para qualquer
--   usuário, tela ou script — a trava é real.
--   Exceção: UPDATE que não muda nada (upsert idêntico) passa.
-- • Fechar/reabrir: só quem NÃO é viewer (mesma regra do 017).
--
-- Rode DEPOIS do 017/019. Idempotente.
-- =====================================================================

create table if not exists public.locked_periods (
  period          text primary key check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  locked_at       timestamptz not null default now(),
  locked_by       uuid default auth.uid(),
  locked_by_name  text,
  note            text
);

alter table public.locked_periods enable row level security;

drop policy if exists "read all authenticated" on public.locked_periods;
drop policy if exists "write non-viewer insert" on public.locked_periods;
drop policy if exists "write non-viewer update" on public.locked_periods;
drop policy if exists "write non-viewer delete" on public.locked_periods;
create policy "read all authenticated" on public.locked_periods for select to authenticated using (true);
create policy "write non-viewer insert" on public.locked_periods for insert to authenticated with check (not public.is_viewer());
create policy "write non-viewer update" on public.locked_periods for update to authenticated using (not public.is_viewer()) with check (not public.is_viewer());
create policy "write non-viewer delete" on public.locked_periods for delete to authenticated using (not public.is_viewer());

-- Competência de uma linha: competency_month (obrigações/guias) ou o mês
-- de due_date (serviços).
create or replace function public.row_competency(r jsonb)
returns text
language sql
immutable
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
as $$
declare
  comp_old text;
  comp_new text;
begin
  if tg_op = 'UPDATE' and to_jsonb(NEW) = to_jsonb(OLD) then
    return NEW;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    comp_old := public.row_competency(to_jsonb(OLD));
    if comp_old is not null and exists (select 1 from public.locked_periods where period = comp_old) then
      raise exception 'Competência % está fechada. Reabra a competência para alterar este item.', comp_old
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    comp_new := public.row_competency(to_jsonb(NEW));
    if comp_new is not null and exists (select 1 from public.locked_periods where period = comp_new) then
      raise exception 'Competência % está fechada. Reabra a competência para incluir itens nela.', comp_new
        using errcode = 'check_violation';
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['obligations', 'taxes', 'services'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_period_lock', t);
      execute format(
        'create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_period_lock()',
        t || '_period_lock', t
      );
    end if;
  end loop;
end $$;
