-- ============================================================
-- CineBuddy — Corrigir sequência do job_id
-- Execute no Supabase Dashboard > SQL Editor
--
-- Se o próximo projeto deve ser BZ0003, o contador deve estar em 3.
-- Este script define o próximo job_id com base no maior existente.
-- ============================================================

-- Opção 1: Ajustar manualmente (ex.: próximo = BZ0003)
-- UPDATE job_id_sequence SET next_value = 3 WHERE id = 'default';

-- Opção 2: Sincronizar com o maior job_id existente
-- Extrai o número do job_id (ex.: BZ0039 → 39) e define próximo = max + 1
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(job_id, '^[A-Za-z]*', ''), '')::INTEGER
  ), 0) + 1
  INTO max_num
  FROM projects
  WHERE job_id ~ '^[A-Za-z]+\d+$';

  UPDATE job_id_sequence SET next_value = max_num WHERE id = 'default';
  RAISE NOTICE 'Próximo job_id será: BZ%', LPAD(max_num::TEXT, 4, '0');
END $$;
