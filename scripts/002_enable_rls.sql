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
CREATE POLICY "Allow public access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- Taxes
CREATE POLICY "Allow public access to taxes" ON public.taxes FOR ALL USING (true) WITH CHECK (true);

-- Obligations
CREATE POLICY "Allow public access to obligations" ON public.obligations FOR ALL USING (true) WITH CHECK (true);

-- Installments
CREATE POLICY "Allow public access to installments" ON public.installments FOR ALL USING (true) WITH CHECK (true);

-- History
CREATE POLICY "Allow public access to history" ON public.history FOR ALL USING (true) WITH CHECK (true);
