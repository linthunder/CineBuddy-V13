-- =============================================================================
-- 1) Garantir que a tabela project_members existe (Table Editor do Supabase)
-- 2) Dar acesso a todos os projetos para o usuário Renan
-- Execute no Supabase: SQL Editor > New query > colar tudo e Run.
-- =============================================================================

-- Passo 1: Criar tabela se não existir (igual ao files/supabase_project_members.sql)
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- Passo 2: Dar acesso a TODOS os projetos para o Renan (nome/sobrenome)
INSERT INTO project_members (user_id, project_id)
SELECT pr.id, p.id
FROM profiles pr
CROSS JOIN projects p
WHERE (pr.name ILIKE '%Renan%' OR pr.surname ILIKE '%Lima%')
  AND NOT EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.user_id = pr.id AND pm.project_id = p.id
  );

-- Passo 3 (opcional): Conferir — quantos projetos cada perfil tem
SELECT pr.name, pr.surname, pr.email, COUNT(pm.project_id) AS projetos
FROM profiles pr
LEFT JOIN project_members pm ON pm.user_id = pr.id
GROUP BY pr.id, pr.name, pr.surname, pr.email
ORDER BY pr.name;
