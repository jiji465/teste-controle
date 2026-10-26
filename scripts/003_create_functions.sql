-- Função para adicionar entrada no histórico automaticamente
-- [023] Reexecução segura: se a versão nova do histórico (019/023 —
-- SECURITY DEFINER, autor do servidor) já está instalada, este bloco NÃO
-- sobrescreve a função nem os gatilhos (antes, rodar de novo quebrava a
-- gravação do histórico e devolvia 'Sistema' como autor).
do $do$
begin
  if to_regprocedure('public.history_actor()') is not null then
    raise notice '%: histórico novo (019/023) já instalado — bloco antigo ignorado.', '003';
    return;
  end if;
  execute $stmt$
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
  $stmt$;
  -- Triggers para histórico automático
  execute $stmt$DROP TRIGGER IF EXISTS obligations_history_trigger ON public.obligations$stmt$;
  execute $stmt$CREATE TRIGGER obligations_history_trigger
  AFTER INSERT OR UPDATE ON public.obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('obligation')$stmt$;
  execute $stmt$DROP TRIGGER IF EXISTS taxes_history_trigger ON public.taxes$stmt$;
  execute $stmt$CREATE TRIGGER taxes_history_trigger
  AFTER INSERT OR UPDATE ON public.taxes
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('tax')$stmt$;
  execute $stmt$DROP TRIGGER IF EXISTS installments_history_trigger ON public.installments$stmt$;
  execute $stmt$CREATE TRIGGER installments_history_trigger
  AFTER INSERT OR UPDATE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.add_history_entry('installment')$stmt$;
end $do$;
