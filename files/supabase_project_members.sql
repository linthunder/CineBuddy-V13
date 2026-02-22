-- ============================================================
-- CineBuddy — Controle de acesso por projeto (project_members)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

COMMENT ON TABLE project_members IS 'Usuários com acesso a cada projeto. Se um projeto não tem nenhuma linha, todos têm acesso (retrocompatibilidade).';

-- RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
