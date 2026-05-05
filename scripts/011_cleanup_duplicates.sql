-- =====================================================================
-- 011_cleanup_duplicates.sql
-- Remove guias e obrigações duplicadas geradas pelo bug do motor de
-- recorrência (corrigido em lib/auto-recurrence.ts no commit 7ab2e79).
--
-- Estratégia de dedup:
--   Chave   = (client_id, name, competency_month)
--   Mantém  = a "melhor" linha de cada grupo, com prioridade:
--             1. status='completed' (preserva trabalho do usuário)
--             2. menor created_at (a original que veio antes do bug)
--   Apaga   = todas as outras do grupo
--
-- Linhas com client_id NULL ou competency_month NULL são IGNORADAS
-- (provavelmente one-offs reais, não duplicatas do bug).
--
-- ⚠️ COMO USAR:
--   1. Cole este arquivo INTEIRO no SQL Editor do Supabase.
--   2. Rode SOMENTE o bloco "PREVIEW" primeiro (linhas marcadas com -- PREVIEW).
--      Veja quantas duplicatas seriam apagadas e quais.
--   3. Se concordar, rode o bloco "EXECUTE" (commit explícito no fim).
--   4. Se algo parecer errado, NÃO rode o COMMIT — dê ROLLBACK.
-- =====================================================================


-- ─── PREVIEW ─────────────────────────────────────────────────────────
-- Roda em SELECT, não altera nada. Mostra exatamente o que seria apagado.

WITH ranked_taxes AS (
  SELECT
    id,
    client_id,
    name,
    competency_month,
    status,
    created_at,
    completed_at,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name, competency_month
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM taxes
  WHERE client_id IS NOT NULL
    AND competency_month IS NOT NULL
)
SELECT
  'tax' AS tipo,
  id,
  client_id,
  name,
  competency_month,
  status,
  created_at,
  '⮕ SERÁ APAGADA' AS acao
FROM ranked_taxes
WHERE rn > 1

UNION ALL

SELECT
  'obligation' AS tipo,
  id,
  client_id,
  name,
  competency_month,
  status,
  created_at,
  '⮕ SERÁ APAGADA' AS acao
FROM (
  SELECT
    id,
    client_id,
    name,
    competency_month,
    status,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name, competency_month
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM obligations
  WHERE client_id IS NOT NULL
    AND competency_month IS NOT NULL
) ranked_obligations
WHERE rn > 1

ORDER BY tipo, client_id, name, competency_month, created_at;


-- ─── CONTAGEM RESUMIDA (também só leitura) ───────────────────────────
-- Roda separadamente se quiser só o número total.

SELECT
  'taxes' AS tabela,
  COUNT(*) AS duplicatas_a_remover
FROM (
  SELECT
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name, competency_month
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM taxes
  WHERE client_id IS NOT NULL AND competency_month IS NOT NULL
) t
WHERE rn > 1

UNION ALL

SELECT
  'obligations' AS tabela,
  COUNT(*) AS duplicatas_a_remover
FROM (
  SELECT
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name, competency_month
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM obligations
  WHERE client_id IS NOT NULL AND competency_month IS NOT NULL
) o
WHERE rn > 1;


-- =====================================================================
-- ─── EXECUTE ─────────────────────────────────────────────────────────
-- ⚠️ DESTRUTIVO. Só rode depois de conferir o PREVIEW acima.
--
-- Copie e rode o bloco abaixo SEPARADAMENTE no SQL Editor.
-- Está envolto em transação — se algo errado, dê ROLLBACK em vez de COMMIT.
-- =====================================================================

/*
BEGIN;

-- Apaga taxes duplicadas
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name, competency_month
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM taxes
  WHERE client_id IS NOT NULL AND competency_month IS NOT NULL
)
DELETE FROM taxes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Apaga obligations duplicadas
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name, competency_month
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM obligations
  WHERE client_id IS NOT NULL AND competency_month IS NOT NULL
)
DELETE FROM obligations
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Confere quantas linhas restaram
SELECT 'taxes' AS tabela, COUNT(*) AS total FROM taxes
UNION ALL
SELECT 'obligations', COUNT(*) FROM obligations;

-- Se os números acima fizerem sentido, confirme:
COMMIT;

-- Se algo parecer errado:
-- ROLLBACK;
*/


-- =====================================================================
-- ─── (OPCIONAL) BLINDAGEM CONTRA DUPLICATAS FUTURAS ──────────────────
-- Cria UNIQUE INDEX que impede o banco de aceitar duplicatas no futuro,
-- mesmo se o código tentar inserir. Roda DEPOIS da limpeza.
-- =====================================================================

/*
CREATE UNIQUE INDEX IF NOT EXISTS taxes_unique_per_competency
  ON taxes (client_id, name, competency_month)
  WHERE client_id IS NOT NULL AND competency_month IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obligations_unique_per_competency
  ON obligations (client_id, name, competency_month)
  WHERE client_id IS NOT NULL AND competency_month IS NOT NULL;
*/
