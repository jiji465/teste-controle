-- Habilitar Row Level Security (RLS) em todas as tabelas
-- Como o sistema permite acesso público, vamos criar políticas permissivas

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para acesso público
-- Qualquer pessoa pode ler, criar, atualizar e deletar

-- Clients
-- [019] política pública removida — acesso controlado pelo 017/019 (só usuários logados).
DROP POLICY IF EXISTS "Allow public access to clients" ON public.clients;

-- Taxes
-- [019] política pública removida — acesso controlado pelo 017/019 (só usuários logados).
DROP POLICY IF EXISTS "Allow public access to taxes" ON public.taxes;

-- Obligations
-- [019] política pública removida — acesso controlado pelo 017/019 (só usuários logados).
DROP POLICY IF EXISTS "Allow public access to obligations" ON public.obligations;

-- Installments
-- [019] política pública removida — acesso controlado pelo 017/019 (só usuários logados).
DROP POLICY IF EXISTS "Allow public access to installments" ON public.installments;

-- History
-- [019] política pública removida — acesso controlado pelo 017/019 (só usuários logados).
DROP POLICY IF EXISTS "Allow public access to history" ON public.history;
