-- ============================================================
-- CineBuddy — phase_defaults_initial (padrões por fase)
-- Valores padrão: dias, semanas, deslocamento, alimentação por pessoa
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS phase_defaults_initial JSONB DEFAULT '{
  "pre": {"dias": 0, "semanas": 0, "deslocamento": 0, "alimentacaoPerPerson": 0},
  "prod": {"dias": 0, "semanas": 0, "deslocamento": 0, "alimentacaoPerPerson": 0},
  "pos": {"dias": 0, "semanas": 0, "deslocamento": 0, "alimentacaoPerPerson": 0}
}'::jsonb;
