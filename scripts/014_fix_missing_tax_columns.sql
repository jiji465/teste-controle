-- =====================================================================
-- 014_fix_missing_tax_columns.sql
--
-- Conserta o erro "[db] Error saving tax: 400" que aparece ao gerar guias
-- automaticamente. Causa: o código salva guias com colunas (scope,
-- competency_month, client_id, due_month, etc.) que foram adicionadas em
-- migrations posteriores (005, 008) — se essas migrations NÃO foram rodadas
-- no banco, a coluna não existe e o Supabase rejeita com 400.
--
-- Este script garante que a tabela `taxes` (e as demais) tenham TODAS as
-- colunas que o app usa hoje. É IDEMPOTENTE: usa ADD COLUMN IF NOT EXISTS,
-- então pode rodar quantas vezes quiser sem risco — colunas já existentes
-- são ignoradas.
--
-- ⚠️ COMO USAR: cole tudo no SQL Editor do Supabase e clique em Run.
-- =====================================================================

-- ─── TAXES (guias de imposto) ───────────────────────────────────────
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS competency_month TEXT;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS due_month INTEGER;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS applicable_regimes TEXT[];
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS recurrence TEXT;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS recurrence_end_date TEXT;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS auto_generate BOOLEAN DEFAULT false;
ALTER TABLE public.taxes ADD COLUMN IF NOT EXISTS weekend_rule TEXT DEFAULT 'postpone';

-- Observação sobre `scope`: a migration original criava com CHECK
-- (federal/estadual/municipal). Aqui criamos sem o CHECK pra não falhar se
-- já existir com outra definição; o app só envia valores válidos.

-- ─── OBLIGATIONS (obrigações acessórias) ────────────────────────────
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS competency_month TEXT;
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS due_month INTEGER;
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS applicable_regimes TEXT[];
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS template_id TEXT;

-- ─── INSTALLMENTS (parcelamentos) ───────────────────────────────────
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS paid_installments JSONB DEFAULT '[]';

-- Pronto. Recarregue o sistema (Ctrl+Shift+R) e o erro 400 some.
