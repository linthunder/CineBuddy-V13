-- ============================================================
-- CineBuddy — Setup Drive + Job ID
-- Execute TUDO no Supabase Dashboard > SQL Editor
-- Copie e cole cada bloco abaixo e clique em "Run" (um de cada vez)
-- ============================================================

-- ========== BLOCO 1: Estrutura (execute primeiro) ==========
ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_root_folder_id text;

CREATE TABLE IF NOT EXISTS job_id_sequence (
  id TEXT PRIMARY KEY DEFAULT 'default',
  next_value INTEGER NOT NULL DEFAULT 1
);

INSERT INTO job_id_sequence (id, next_value) VALUES ('default', 1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION get_next_job_number()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE job_id_sequence SET next_value = next_value + 1 WHERE id = 'default'
  RETURNING (next_value - 1) INTO n;
  RETURN n;
END;
$$;

-- ========== BLOCO 2: Corrigir job_id (execute após o Bloco 1) ==========
-- Próximo projeto criado será BZ0003 (troque o 3 pelo número que quiser)
UPDATE job_id_sequence SET next_value = 3 WHERE id = 'default';

-- ========== BLOCO 3: Forçar recriação de pasta (opcional) ==========
-- Use apenas se a pasta do projeto foi excluída do Drive e não recriou ao salvar.
-- Antes de executar: vá em Table Editor > projects, copie o "id" do projeto (ex: a1b2c3d4-...).
-- Cole o id entre as aspas abaixo e execute.
-- UPDATE projects SET drive_root_folder_id = NULL WHERE id = 'COLE-O-ID-AQUI';
