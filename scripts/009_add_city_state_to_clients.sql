-- ═══════════════════════════════════════════════════════════════════
-- Adiciona cidade e estado em clients (vem da BrasilAPI ao consultar CNPJ).
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_state ON public.clients(state);
CREATE INDEX IF NOT EXISTS idx_clients_city ON public.clients(city);

NOTIFY pgrst, 'reload schema';
