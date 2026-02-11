-- ============================================================
-- CineBuddy — phase_defaults_final (padrões por fase no Orçamento Final)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS phase_defaults_final JSONB DEFAULT '{
  "pre": {"dias": 0, "semanas": 0, "deslocamento": 0, "alimentacaoPerPerson": 0},
  "prod": {"dias": 0, "semanas": 0, "deslocamento": 0, "alimentacaoPerPerson": 0},
  "pos": {"dias": 0, "semanas": 0, "deslocamento": 0, "alimentacaoPerPerson": 0}
}'::jsonb;
