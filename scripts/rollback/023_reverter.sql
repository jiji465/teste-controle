-- rollback/023_reverter.sql
-- =====================================================================
-- DESFAZ as políticas de papéis do 023 (volta ao modelo do 017: qualquer
-- usuário logado lê tudo; quem não é viewer grava). Use SÓ em emergência —
-- por exemplo, se alguém da equipe ficou sem acesso e você precisa liberar
-- já, enquanto corrige o papel da conta.
--
-- Passo a passo:
--   1. Rode ESTE arquivo.
--   2. Rode, nesta ordem: 017_viewer_role.sql, 019_hardening.sql,
--      020_locked_periods.sql, 021_office_holidays.sql, 022_apuracao_integridade.sql
--      (sem as funções do 023, eles recriam as políticas antigas).
--
-- O que NÃO é desfeito (é seguro manter): histórico só-leitura com autor do
-- servidor, carimbo/auditoria do fechamento, trava de competência corrigida,
-- search_path fixo, painel público sem lista, papéis gravados nas contas.
-- Para voltar ao 023 depois: rode 023_papeis_auditoria.sql de novo.
-- =====================================================================
begin;

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and policyname like 'papel: %'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

drop function if exists public.is_staff();
drop function if exists public.can_read();
drop function if exists public.app_role();

delete from public._migracoes where id = '023_papeis_auditoria';

commit;
