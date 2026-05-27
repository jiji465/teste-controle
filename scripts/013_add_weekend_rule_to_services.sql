-- =====================================================================
-- 013_add_weekend_rule_to_services.sql
-- Adiciona a coluna weekend_rule na tabela services pra suportar a regra
-- de fim de semana / feriado igual às outras abas (obrigações, guias e
-- parcelamentos). Valores possíveis:
--   - 'postpone'   (default): se cair em fim de semana/feriado, posterga
--                  pro próximo dia útil
--   - 'anticipate': antecipa pro dia útil anterior
--   - 'keep'      : mantém na data original
--
-- ⚠️ COMO USAR:
--   Rode este SQL inteiro no SQL Editor do Supabase. Idempotente —
--   pode rodar várias vezes (ADD COLUMN IF NOT EXISTS é seguro).
-- =====================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS weekend_rule TEXT NOT NULL DEFAULT 'postpone'
  CHECK (weekend_rule IN ('postpone', 'anticipate', 'keep'));
