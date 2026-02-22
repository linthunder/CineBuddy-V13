-- ============================================================
-- CineBuddy — Resetar job_ids e sequência
-- Execute no Supabase Dashboard > SQL Editor
--
-- Objetivo:
--   • Renumerar os 3 projetos existentes para BZ0001, BZ0002, BZ0003
--   • Limpar drive_root_folder_id (pastas serão recriadas ao salvar)
--   • Próximo projeto (novo ou cópia) será BZ0004
--
-- Execute os blocos NA ORDEM indicada.
-- ============================================================

-- ========== PASSO 1: Ver os projetos atuais ==========
-- Confira os 3 projetos antes de alterar.
SELECT id, job_id, nome, agencia, cliente, updated_at
FROM projects
ORDER BY updated_at ASC;
-- A ordem acima (por updated_at, mais antigo primeiro) será usada:
-- 1º projeto → BZ0001
-- 2º projeto → BZ0002  
-- 3º projeto → BZ0003


-- ========== PASSO 2: Renumerar para BZ0001, BZ0002, BZ0003 ==========
-- ATENÇÃO: Ajuste os IDs abaixo conforme o resultado do PASSO 1.
-- Substitua 'ID-DO-1º-PROJETO', 'ID-DO-2º-PROJETO', 'ID-DO-3º-PROJETO'
-- pelos valores da coluna "id" (UUID) de cada projeto, na ordem desejada.

-- Exemplo (substitua pelos seus IDs reais):
-- UPDATE projects SET job_id = 'BZ0001' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
-- UPDATE projects SET job_id = 'BZ0002' WHERE id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
-- UPDATE projects SET job_id = 'BZ0003' WHERE id = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

-- Ou use por job_id atual (se preferir definir a ordem manualmente):
-- UPDATE projects SET job_id = 'BZ0001' WHERE job_id = 'BZ4521';   -- ex.: Cerveja Aurora
-- UPDATE projects SET job_id = 'BZ0002' WHERE job_id = 'BZ2718';   -- ex.: Banco Nacional
-- UPDATE projects SET job_id = 'BZ0003' WHERE job_id = 'BZ9317';   -- ex.: o 3º projeto

-- Versão automática (ordena por updated_at ASC, id ASC — mais antigo = BZ0001):
WITH ordenados AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY updated_at ASC, id ASC) AS rn
  FROM projects
)
UPDATE projects p
SET job_id = 'BZ' || LPAD(o.rn::TEXT, 4, '0')
FROM ordenados o
WHERE p.id = o.id;


-- ========== PASSO 3: Limpar drive_root_folder_id ==========
-- Para que as pastas no Drive sejam recriadas com os novos nomes (#BZ0001, etc.)
UPDATE projects SET drive_root_folder_id = NULL;


-- ========== PASSO 4: Ajustar sequência para próximo = BZ0004 ==========
UPDATE job_id_sequence
SET next_value = 4
WHERE id = 'default';


-- ========== PASSO 5: Conferir resultado ==========
SELECT id, job_id, nome, drive_root_folder_id
FROM projects
ORDER BY job_id;

SELECT * FROM job_id_sequence;
