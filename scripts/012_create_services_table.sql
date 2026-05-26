-- =====================================================================
-- 012_create_services_table.sql
-- Nova entidade "Serviços Avulsos" — 4º tipo de tarefa (além de
-- obrigações, guias e parcelamentos).
--
-- Usa data única (due_date) em vez de "competência + dia". Tem categoria
-- (nf_emission/consulting/other). Pode ser recorrente ou one-off.
--
-- ⚠️ COMO USAR:
--   Rode este SQL inteiro no SQL Editor do Supabase. Idempotente —
--   pode rodar várias vezes que CREATE IF NOT EXISTS é seguro.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('nf_emission', 'consulting', 'other')),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  -- Recorrência opcional (NULL = serviço one-off, sem repetição)
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  recurrence_interval INT,
  recurrence_end_date DATE,
  auto_generate BOOLEAN DEFAULT false,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  history JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices pras buscas mais comuns
CREATE INDEX IF NOT EXISTS services_client_id ON public.services(client_id);
CREATE INDEX IF NOT EXISTS services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS services_due_date ON public.services(due_date);
CREATE INDEX IF NOT EXISTS services_category ON public.services(category);
