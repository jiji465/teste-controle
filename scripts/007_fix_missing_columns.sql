-- ═══════════════════════════════════════════════════════════════════
-- FIX: colunas que o código manda mas o schema não tinha.
-- Idempotente — pode rodar quantas vezes quiser.
-- ═══════════════════════════════════════════════════════════════════

-- TAXES: recurrence_end_date estava só em obligations
ALTER TABLE public.taxes
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

-- OBLIGATIONS: amount (valor monetário da obrigação)
ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2);

-- INSTALLMENTS: total_amount e installment_amount
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2);

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(15, 2);

-- Recarrega o cache do schema do PostgREST (Supabase) imediatamente
NOTIFY pgrst, 'reload schema';
