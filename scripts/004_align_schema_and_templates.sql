-- ============================================
-- Migration 004: alinha schema com o código TypeScript
-- e prepara tabelas para templates persistidos e rastreio de origem.
-- Idempotente — pode rodar em base já existente sem risco.
-- ============================================

-- Campos de cliente que o código mapeia em features/clients/services.ts
-- mas que não existiam no schema original (001_create_tables.sql).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tax_regime TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_activity TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ie TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS im TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- Regimes aplicáveis de um imposto — suporta o filtro automático
-- por regime que será usado na Fase 4 (auto-vínculo de impostos ao cadastrar empresa).
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS applicable_regimes TEXT[];

-- Rastreio de origem das obrigações (Fase 4 e 8).
-- manual   = criada pelo usuário
-- template = criada via template de regime+atividade
-- tax      = gerada automaticamente a partir de um imposto aplicável
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'obligations' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.obligations
      ADD COLUMN source TEXT CHECK (source IN ('manual', 'template', 'tax'));
  END IF;
END $$;

ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS template_id UUID;

-- Tabela para templates customizados (hoje só em localStorage).
-- Usada pela Fase 7.
CREATE TABLE IF NOT EXISTS public.custom_obligation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  obligations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obligations_source ON public.obligations(source);
CREATE INDEX IF NOT EXISTS idx_obligations_template_id ON public.obligations(template_id);

COMMENT ON COLUMN public.clients.tax_regime IS 'Regime tributário: simples_nacional | lucro_presumido | lucro_real | mei | imune_isento';
COMMENT ON COLUMN public.clients.business_activity IS 'Atividade de negócio: servicos | comercio | industria | misto';
COMMENT ON COLUMN public.taxes.applicable_regimes IS 'Array de regimes aos quais este imposto se aplica (vazio = todos)';
COMMENT ON COLUMN public.obligations.source IS 'Origem: manual | template | tax — usado para retroaplicação de templates';
COMMENT ON TABLE public.custom_obligation_templates IS 'Templates customizados de obrigações criados pelo usuário';
