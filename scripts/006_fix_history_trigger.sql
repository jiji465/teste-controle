-- ═══════════════════════════════════════════════════════════════════
-- FIX: trigger add_history_entry quebrava em tabelas sem `completed_at`
-- Reescreve a função para acessar campos dinamicamente via to_jsonb,
-- assim funciona para clients/taxes/obligations/installments sem erro.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.add_history_entry()
RETURNS TRIGGER AS $$
DECLARE
  new_status      TEXT;
  old_status      TEXT;
  new_completed_at TEXT;
  old_completed_at TEXT;
  new_completed_by TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
    VALUES (TG_ARGV[0], NEW.id, 'created', 'Registro criado', 'Sistema');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    new_status        := to_jsonb(NEW) ->> 'status';
    old_status        := to_jsonb(OLD) ->> 'status';
    new_completed_at  := to_jsonb(NEW) ->> 'completed_at';
    old_completed_at  := to_jsonb(OLD) ->> 'completed_at';
    new_completed_by  := to_jsonb(NEW) ->> 'completed_by';

    IF new_status IS NOT NULL AND new_status IS DISTINCT FROM old_status THEN
      INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
      VALUES (
        TG_ARGV[0], NEW.id, 'status_changed',
        'Status alterado de ' || COALESCE(old_status, 'N/A') || ' para ' || new_status,
        COALESCE(new_completed_by, 'Sistema')
      );
    END IF;

    IF new_completed_at IS NOT NULL AND old_completed_at IS NULL THEN
      INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
      VALUES (
        TG_ARGV[0], NEW.id, 'completed',
        'Registro concluído em ' || new_completed_at,
        COALESCE(new_completed_by, 'Sistema')
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.history (entity_type, entity_id, action, description, user_name)
    VALUES (TG_ARGV[0], OLD.id, 'deleted', 'Registro removido', 'Sistema');
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
