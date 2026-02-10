-- ============================================================
-- CineBuddy — Contador sequencial para job_id (BZ0001, BZ0002, ...)
-- Execute no Supabase Dashboard > SQL Editor
-- O primeiro projeto criado após rodar este script terá job_id BZ0001.
-- ============================================================

-- Tabela com uma única linha: próximo número a ser usado
CREATE TABLE IF NOT EXISTS job_id_sequence (
  id TEXT PRIMARY KEY DEFAULT 'default',
  next_value INTEGER NOT NULL DEFAULT 1
);

-- Garante que existe uma única linha e define próximo ID = 1 (BZ0001)
INSERT INTO job_id_sequence (id, next_value)
VALUES ('default', 1)
ON CONFLICT (id) DO UPDATE SET next_value = 1;

-- Função atômica: incrementa o contador e retorna o número "consumido" (1, 2, 3...)
CREATE OR REPLACE FUNCTION get_next_job_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE job_id_sequence
  SET next_value = next_value + 1
  WHERE id = 'default'
  RETURNING (next_value - 1) INTO n;
  RETURN n;
END;
$$;

-- Apenas o service_role (usado pela API) deve chamar esta função.
-- Não concedemos EXECUTE a anon/authenticated para evitar abuso.
