-- ============================================================
-- CineBuddy — Reorganizar job_id e sincronizar com banco
-- Execute no Supabase Dashboard > SQL Editor
--
-- Objetivo:
--   • BZ0039 (PROJETO TESTE) → BZ0001
--   • BZ0002 (Última Chamada 2026) → permanece
--   • BZ0003 (20ª Corrida Noturna) → permanece
--   • Próximo projeto criado (novo ou cópia) → BZ0004
--
-- Execute na ordem indicada.
-- ============================================================

-- ========== PASSO 1: Conferir os projetos atuais ==========
-- Execute e confira se os dados batem antes de alterar.
SELECT id, job_id, nome, agencia, cliente, updated_at
FROM projects
ORDER BY job_id;

-- ========== PASSO 2: Renumerar BZ0039 → BZ0001 ==========
UPDATE projects
SET job_id = 'BZ0001'
WHERE job_id = 'BZ0039';

-- Se não afetou nenhuma linha, verifique se o job_id está correto (ex.: BZ0039 ou BZ39).

-- ========== PASSO 3: Limpar drive_root_folder_id ==========
-- Necessário pois você vai excluir as pastas do Drive e recriá-las.
-- O sistema recriará as pastas ao salvar cada projeto.
UPDATE projects SET drive_root_folder_id = NULL;

-- ========== PASSO 4: Ajustar sequência para o próximo ser BZ0004 ==========
-- O próximo projeto criado (novo ou via Salvar cópia) receberá BZ0004.
UPDATE job_id_sequence
SET next_value = 4
WHERE id = 'default';

-- ========== PASSO 5: Conferir resultado ==========
SELECT id, job_id, nome, drive_root_folder_id
FROM projects
ORDER BY job_id;

SELECT * FROM job_id_sequence;
