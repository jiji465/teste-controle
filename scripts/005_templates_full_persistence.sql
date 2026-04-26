-- ============================================
-- Migration 005: persistência completa de templates
-- - Adiciona regime/activity em custom_obligation_templates (faltavam)
-- - Cria tabela template_deletion_log pra lembrar quais padrões o usuário
--   apagou (evita ressuscitar via seed)
-- Idempotente — pode rodar várias vezes sem efeito colateral.
-- ============================================

-- Campos faltantes em custom_obligation_templates (estavam só no TS, não persistiam)
ALTER TABLE public.custom_obligation_templates
  ADD COLUMN IF NOT EXISTS regime TEXT
    CHECK (regime IS NULL OR regime IN ('simples_nacional','lucro_presumido','lucro_real','mei','imune_isento'));

ALTER TABLE public.custom_obligation_templates
  ADD COLUMN IF NOT EXISTS activity TEXT
    CHECK (activity IS NULL OR activity IN ('servicos','comercio','industria','misto'));

COMMENT ON COLUMN public.custom_obligation_templates.regime IS 'Regime tributário pré-associado ao template (matching automático)';
COMMENT ON COLUMN public.custom_obligation_templates.activity IS 'Atividade pré-associada ao template (matching automático)';

-- Lista negra de templates padrão que o usuário deletou explicitamente.
-- Quando o seed roda, pula nomes que estão aqui — assim nada ressuscita.
CREATE TABLE IF NOT EXISTS public.deleted_default_templates (
  name TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.deleted_default_templates IS 'Nomes de templates "Padrão · ..." que o usuário apagou e não devem ser recriados pelo seed';
