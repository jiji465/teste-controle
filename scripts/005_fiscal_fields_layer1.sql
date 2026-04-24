-- ============================================
-- Migration 005: Camada 1 — campos fiscais críticos
-- - Nome fantasia + CNAE oficial nos clientes
-- - Esfera (federal/estadual/municipal) nos impostos
-- - Mês de competência nas obrigações
-- Idempotente — pode rodar em base já existente.
-- ============================================

-- Clientes: nome fantasia + CNAE oficial vindo da Receita
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnae_code TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnae_description TEXT;

-- Impostos: esfera tributária
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

-- Obrigações: mês-base de competência (formato "YYYY-MM")
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS competency_month TEXT;

CREATE INDEX IF NOT EXISTS idx_taxes_scope ON public.taxes(scope);
CREATE INDEX IF NOT EXISTS idx_obligations_competency_month ON public.obligations(competency_month);

COMMENT ON COLUMN public.clients.trade_name IS 'Nome fantasia (separado da razão social)';
COMMENT ON COLUMN public.clients.cnae_code IS 'CNAE oficial de 7 dígitos (vem da Receita via BrasilAPI)';
COMMENT ON COLUMN public.taxes.scope IS 'Esfera tributária: federal | estadual | municipal';
COMMENT ON COLUMN public.obligations.competency_month IS 'Mês-base do fato gerador (formato AAAA-MM). Ex: 2026-01 = janeiro/2026';
