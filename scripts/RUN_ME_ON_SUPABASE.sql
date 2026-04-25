-- ═══════════════════════════════════════════════════════════════════════════
-- RODAR ESTE ARQUIVO NO SQL EDITOR DO SUPABASE
-- (Database → SQL Editor → New query → cole tudo → Run)
--
-- Idempotente — pode rodar quantas vezes quiser, não duplica nem perde dados.
-- Aplica todas as migrations pendentes em sequência: 004 + 005 + custom_templates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ──── Campos do cliente que o código mapeia mas faltavam no schema ─────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tax_regime TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_activity TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ie TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS im TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnae_code TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnae_description TEXT;

-- ──── Impostos: regimes aplicáveis + esfera ────────────────────────────────
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS applicable_regimes TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'taxes' AND column_name = 'scope'
  ) THEN
    ALTER TABLE public.taxes
      ADD COLUMN scope TEXT CHECK (scope IN ('federal', 'estadual', 'municipal'));
  END IF;
END $$;

-- ──── Obrigações: rastreio de origem + competência + template_id ───────────
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
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS competency_month TEXT;

-- ──── Templates customizados (sai do localStorage e vai pro banco) ────────
CREATE TABLE IF NOT EXISTS public.custom_obligation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  obligations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──── Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_obligations_source ON public.obligations(source);
CREATE INDEX IF NOT EXISTS idx_obligations_template_id ON public.obligations(template_id);
CREATE INDEX IF NOT EXISTS idx_obligations_competency_month ON public.obligations(competency_month);
CREATE INDEX IF NOT EXISTS idx_taxes_scope ON public.taxes(scope);

-- ──── Comentários (documentação inline) ────────────────────────────────────
COMMENT ON COLUMN public.clients.tax_regime IS 'simples_nacional | lucro_presumido | lucro_real | mei | imune_isento';
COMMENT ON COLUMN public.clients.business_activity IS 'servicos | comercio | industria | misto';
COMMENT ON COLUMN public.clients.trade_name IS 'Nome fantasia (separado da razão social)';
COMMENT ON COLUMN public.clients.cnae_code IS 'CNAE oficial de 7 dígitos (vem da Receita via BrasilAPI)';
COMMENT ON COLUMN public.taxes.applicable_regimes IS 'Array de regimes aos quais este imposto se aplica (vazio = todos)';
COMMENT ON COLUMN public.taxes.scope IS 'federal | estadual | municipal';
COMMENT ON COLUMN public.obligations.source IS 'manual | template | tax';
COMMENT ON COLUMN public.obligations.competency_month IS 'Mês-base do fato gerador no formato AAAA-MM. Ex: 2026-01';
COMMENT ON TABLE public.custom_obligation_templates IS 'Templates customizados de obrigações (substitui localStorage)';

-- ──── Verificação final (rode isso depois pra confirmar) ───────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('clients','taxes','obligations','custom_obligation_templates')
-- ORDER BY table_name, column_name;
