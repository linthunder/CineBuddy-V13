-- =============================================================================
-- Corrigir acesso do usuário aos projetos (ex.: Renan não vê projetos no ABRIR)
-- Execute no Supabase: SQL Editor > New query > colar e Run.
-- =============================================================================

-- Opção A: Dar acesso a TODOS os projetos para o Renan (ajuste o filtro se precisar)
-- Este INSERT usa o perfil cujo nome contém "Renan" ou sobrenome "Lima".
INSERT INTO project_members (user_id, project_id)
SELECT pr.id, p.id
FROM profiles pr
CROSS JOIN projects p
WHERE (pr.name ILIKE '%Renan%' OR pr.surname ILIKE '%Lima%')
  AND NOT EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.user_id = pr.id AND pm.project_id = p.id
  );

-- Opção B: Se quiser fazer para um usuário específico, use o id dele (troque o UUID):
-- INSERT INTO project_members (user_id, project_id)
-- SELECT 'COLE-O-UUID-DO-RENAN-AQUI', p.id
-- FROM projects p
-- WHERE NOT EXISTS (
--   SELECT 1 FROM project_members pm
--   WHERE pm.user_id = 'COLE-O-UUID-DO-RENAN-AQUI' AND pm.project_id = p.id
-- );

-- Para conferir: listar perfis e quantos projetos cada um tem
-- SELECT pr.name, pr.surname, pr.email, COUNT(pm.project_id) AS projetos
-- FROM profiles pr
-- LEFT JOIN project_members pm ON pm.user_id = pr.id
-- GROUP BY pr.id, pr.name, pr.surname, pr.email;
