-- Renumerar 3 projetos: teste → BZ0001, Corrida noturna Unimed → BZ0002, Ultima chamada 2026 → BZ0003
-- Execute no SQL Editor do Supabase (Dashboard do projeto).

-- =============================================================================
-- RODE DUAS VEZES (duas queries separadas):
-- =============================================================================

-- QUERY 1 (rode primeiro): só isto — para listar os projetos e copiar a coluna "id"
SELECT id, job_id, nome, cliente, created_at
FROM projects
ORDER BY created_at;

-- =============================================================================
-- QUERY 2 (rode depois): substitua os placeholders pelos IDs que você copiou
-- da QUERY 1 e rode TUDO da linha abaixo até o fim (os 4 UPDATEs juntos).
-- =============================================================================

-- Projeto de TESTE → BZ0001
UPDATE projects SET job_id = 'BZ0001' WHERE id = 'COLE_AQUI_O_ID_DO_PROJETO_DE_TESTE';

-- Corrida noturna Unimed → BZ0002
UPDATE projects SET job_id = 'BZ0002' WHERE id = 'COLE_AQUI_O_ID_DA_CORRIDA_NOTURNA';

-- Ultima chamada 2026 → BZ0003
UPDATE projects SET job_id = 'BZ0003' WHERE id = 'COLE_AQUI_O_ID_ULTIMA_CHAMADA';

-- Contador: próximo projeto novo será BZ0004 (rode junto com os 3 UPDATEs acima)
UPDATE job_id_sequence SET next_value = 4 WHERE id = 'default';
