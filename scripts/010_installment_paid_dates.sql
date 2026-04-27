-- ============================================================
-- Migration 010: paid_installments em parcelamentos
-- ============================================================
-- Permite registrar a data exata de pagamento de CADA parcela
-- de um parcelamento, em vez de só o status da parcela atual.
--
-- Estrutura: array JSONB com objetos { number, paid_at, paid_by? }
--   Ex: [
--     { "number": 1, "paid_at": "2025-01-15T10:00:00Z", "paid_by": "Contador" },
--     { "number": 2, "paid_at": "2025-02-13T09:30:00Z" }
--   ]
--
-- Uso no app:
--  - Quando usuário clica "Pagar parcela X/N", adiciona um item
--    nesse array, incrementa current_installment, volta status pra
--    "pending" (próxima parcela).
--  - Quando current_installment > installment_count, marca o
--    parcelamento todo como "completed".
-- ============================================================

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS paid_installments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Índice GIN pra buscar rápido se precisarmos filtrar por número
-- de parcela paga no futuro (ex: relatório "todos que pagaram parcela 5")
CREATE INDEX IF NOT EXISTS idx_installments_paid
  ON public.installments USING GIN (paid_installments);

-- Comentário documentando o campo
COMMENT ON COLUMN public.installments.paid_installments IS
  'Array JSONB com histórico de pagamentos por parcela: [{number, paid_at, paid_by?}]';
