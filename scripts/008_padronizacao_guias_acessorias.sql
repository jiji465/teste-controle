-- ═══════════════════════════════════════════════════════════════════
-- PADRONIZAÇÃO: Guias de Imposto + Obrigações Acessórias
-- ───────────────────────────────────────────────────────────────────
-- Adiciona colunas que faltavam para padronizar os dois formulários:
--   • taxes      → client_id, competency_month
--   • obligations → scope, applicable_regimes
-- Tudo idempotente — pode rodar várias vezes sem problema.
-- ═══════════════════════════════════════════════════════════════════

-- ─── TAXES ─────────────────────────────────────────────────────────
-- Cliente (cada guia agora pertence a um cliente)
ALTER TABLE public.taxes
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Mês de competência (ex: "2026-01")
ALTER TABLE public.taxes
  ADD COLUMN IF NOT EXISTS competency_month TEXT;

CREATE INDEX IF NOT EXISTS idx_taxes_client_id ON public.taxes(client_id);
CREATE INDEX IF NOT EXISTS idx_taxes_competency_month ON public.taxes(competency_month);

-- ─── OBLIGATIONS ───────────────────────────────────────────────────
-- Esfera (federal/estadual/municipal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'obligations'
      AND column_name = 'scope'
  ) THEN
    ALTER TABLE public.obligations
      ADD COLUMN scope TEXT CHECK (scope IN ('federal', 'estadual', 'municipal'));
  END IF;
END $$;

-- Regimes tributários aplicáveis (array de TEXT)
ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS applicable_regimes TEXT[];

-- Recarrega cache do PostgREST (Supabase) imediatamente
NOTIFY pgrst, 'reload schema';
