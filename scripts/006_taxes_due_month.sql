-- ============================================================
-- Migration 006: adiciona due_month em taxes
-- Necessário pra impostos ANUAIS com data fixa de vencimento
-- (ex: DEFIS=mar, DASN-SIMEI=mai). Quando preenchido em conjunto com
-- recurrence='annual', o vencimento é (year(competencia)+1, due_month, due_day).
-- Idempotente.
-- ============================================================

ALTER TABLE public.taxes
  ADD COLUMN IF NOT EXISTS due_month INTEGER
    CHECK (due_month IS NULL OR (due_month >= 1 AND due_month <= 12));

COMMENT ON COLUMN public.taxes.due_month IS 'Mês fixo de vencimento (1-12), só usado em guias ANUAIS com data fixa (DEFIS=3, DASN-SIMEI=5).';
