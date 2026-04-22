-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Impostos
CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  federal_tax_code TEXT,
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to TEXT,
  protocol TEXT,
  realization_date TIMESTAMPTZ,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Obrigações
CREATE TABLE IF NOT EXISTS public.obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('sped', 'tax_guide', 'certificate', 'declaration', 'other')),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_id UUID REFERENCES public.taxes(id) ON DELETE SET NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  due_month INTEGER CHECK (due_month >= 1 AND due_month <= 12),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'custom')),
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  recurrence_interval INTEGER,
  recurrence_end_date DATE,
  auto_generate BOOLEAN NOT NULL DEFAULT true,
  weekend_rule TEXT NOT NULL DEFAULT 'postpone' CHECK (weekend_rule IN ('postpone', 'anticipate', 'keep')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to TEXT,
  protocol TEXT,
  realization_date TIMESTAMPTZ,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  attachments TEXT[],
  parent_obligation_id UUID REFERENCES public.obligations(id) ON DELETE SET NULL,
  generated_for TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Parcelamentos
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_id UUID REFERENCES public.taxes(id) ON DELETE SET NULL,
  installment_count INTEGER NOT NULL CHECK (installment_count > 0),
  current_installment INTEGER NOT NULL CHECK (current_installment > 0),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  first_due_date DATE NOT NULL,
  weekend_rule TEXT NOT NULL DEFAULT 'postpone' CHECK (weekend_rule IN ('postpone', 'anticipate', 'keep')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to TEXT,
  protocol TEXT,
  realization_date TIMESTAMPTZ,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  tags TEXT[],
  payment_method TEXT,
  reference_number TEXT,
  auto_generate BOOLEAN NOT NULL DEFAULT true,
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  recurrence_interval INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Histórico
CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('obligation', 'tax', 'installment')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'status_changed', 'comment_added')),
  description TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_obligations_client_id ON public.obligations(client_id);
CREATE INDEX IF NOT EXISTS idx_obligations_tax_id ON public.obligations(tax_id);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON public.obligations(status);
CREATE INDEX IF NOT EXISTS idx_obligations_parent_id ON public.obligations(parent_obligation_id);
CREATE INDEX IF NOT EXISTS idx_installments_client_id ON public.installments(client_id);
CREATE INDEX IF NOT EXISTS idx_installments_tax_id ON public.installments(tax_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_history_entity ON public.history(entity_type, entity_id);

-- Comentários nas tabelas
COMMENT ON TABLE public.clients IS 'Clientes da contabilidade';
COMMENT ON TABLE public.taxes IS 'Impostos e tributos';
COMMENT ON TABLE public.obligations IS 'Obrigações acessórias fiscais';
COMMENT ON TABLE public.installments IS 'Parcelamentos de impostos e obrigações';
COMMENT ON TABLE public.history IS 'Histórico de ações em todas as entidades';
