-- ============================================
-- SCRIPT COMPLETO DE CONFIGURAÇÃO DO BANCO DE DADOS
-- Sistema de Controle Fiscal
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- PASSO 1: CRIAR TABELAS
-- ============================================

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
  auto_generate BOOLEAN NOT NULL DEFAULT true,
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  recurrence_interval INTEGER,
  weekend_rule TEXT NOT NULL DEFAULT 'postpone' CHECK (weekend_rule IN ('postpone', 'anticipate', 'keep')),
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
  entity_type TEXT NOT NULL CHECK (entity_type IN ('obligation', 'tax', 'installment', 'client')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'status_changed', 'comment_added', 'deleted')),
  description TEXT NOT NULL,
  user_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PASSO 2: CRIAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_obligations_client_id ON public.obligations(client_id);
CREATE INDEX IF NOT EXISTS idx_obligations_tax_id ON public.obligations(tax_id);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON public.obligations(status);
CREATE INDEX IF NOT EXISTS idx_obligations_parent_id ON public.obligations(parent_obligation_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_day ON public.obligations(due_day);
CREATE INDEX IF NOT EXISTS idx_installments_client_id ON public.installments(client_id);
CREATE INDEX IF NOT EXISTS idx_installments_tax_id ON public.installments(tax_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_due_day ON public.installments(due_day);
CREATE INDEX IF NOT EXISTS idx_taxes_status ON public.taxes(status);
CREATE INDEX IF NOT EXISTS idx_taxes_due_day ON public.taxes(due_day);
CREATE INDEX IF NOT EXISTS idx_history_entity ON public.history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON public.history(created_at DESC);

-- ============================================
-- PASSO 3: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASSO 4: CRIAR POLÍTICAS DE ACESSO PÚBLICO
-- ============================================

-- Clients
DROP POLICY IF EXISTS "Allow public access to clients" ON public.clients;
CREATE POLICY "Allow public access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- Taxes
DROP POLICY IF EXISTS "Allow public access to taxes" ON public.taxes;
CREATE POLICY "Allow public access to taxes" ON public.taxes FOR ALL USING (true) WITH CHECK (true);

-- Obligations
DROP POLICY IF EXISTS "Allow public access to obligations" ON public.obligations;
CREATE POLICY "Allow public access to obligations" ON public.obligations FOR ALL USING (true) WITH CHECK (true);

-- Installments
DROP POLICY IF EXISTS "Allow public access to installments" ON public.installments;
CREATE POLICY "Allow public access to installments" ON public.installments FOR ALL USING (true) WITH CHECK (true);

-- History
DROP POLICY IF EXISTS "Allow public access to history" ON public.history;
CREATE POLICY "Allow public access to history" ON public.history FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PASSO 5: CRIAR FUNÇÕES E TRIGGERS
-- ============================================

-- Função para adicionar entrada no histórico automaticamente
CREATE OR REPLACE FUNCTION public.add_history_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
    VALUES (TG_ARGV[0], NEW.id, 'created', 'Registro criado', 'Sistema');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
      VALUES (TG_ARGV[0], NEW.id, 'status_changed', 
              'Status alterado de ' || OLD.status || ' para ' || NEW.status, 
              COALESCE(NEW.completed_by, 'Sistema'));
    END IF;
    
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
      INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
      VALUES (TG_ARGV[0], NEW.id, 'completed', 
              'Registro concluído em ' || NEW.completed_at::TEXT, 
              COALESCE(NEW.completed_by, 'Sistema'));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
    VALUES (TG_ARGV[0], OLD.id, 'deleted', 'Registro excluído', 'Sistema');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para histórico automático
DROP TRIGGER IF EXISTS obligations_history_trigger ON public.obligations;
CREATE TRIGGER obligations_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('obligation');

DROP TRIGGER IF EXISTS taxes_history_trigger ON public.taxes;
CREATE TRIGGER taxes_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.taxes
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('tax');

DROP TRIGGER IF EXISTS installments_history_trigger ON public.installments;
CREATE TRIGGER installments_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('installment');

DROP TRIGGER IF EXISTS clients_history_trigger ON public.clients;
CREATE TRIGGER clients_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('client');

-- ============================================
-- PASSO 6: ADICIONAR COMENTÁRIOS
-- ============================================

COMMENT ON TABLE public.clients IS 'Clientes da contabilidade';
COMMENT ON TABLE public.taxes IS 'Impostos e tributos com controle de vencimento';
COMMENT ON TABLE public.obligations IS 'Obrigações acessórias fiscais';
COMMENT ON TABLE public.installments IS 'Parcelamentos de impostos e obrigações';
COMMENT ON TABLE public.history IS 'Histórico de ações em todas as entidades';

-- ============================================
-- CONFIGURAÇÃO CONCLUÍDA!
-- ============================================
-- Agora você pode usar o sistema de controle fiscal
-- Todas as tabelas, índices, políticas e triggers foram criados
-- ============================================
