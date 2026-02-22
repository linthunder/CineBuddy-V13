-- ============================================================
-- CineBuddy — Adicionar restrições de HEADER (botões do header)
-- Execute APÓS supabase_profile_restrictions.sql
-- ============================================================
-- Adiciona header_button ao tipo e insere restrições para assistente_direcao e convidado.

-- 1. Atualizar o CHECK da coluna restriction_type (para tabelas já criadas)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profile_restrictions') THEN
    ALTER TABLE profile_restrictions DROP CONSTRAINT IF EXISTS profile_restrictions_restriction_type_check;
    ALTER TABLE profile_restrictions ADD CONSTRAINT profile_restrictions_restriction_type_check
      CHECK (restriction_type IN ('nav_page', 'config_tab', 'filme_button', 'header_button'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Se o constraint tiver outro nome, execute manualmente: SELECT conname FROM pg_constraint WHERE conrelid = ''profile_restrictions''::regclass;';
END $$;

-- 2. Seed: assistente_direcao e convidado — todos os botões do header restritos (só SAIR visível)
INSERT INTO profile_restrictions (role, restriction_type, restriction_key) VALUES
  ('assistente_direcao', 'header_button', 'novo'),
  ('assistente_direcao', 'header_button', 'abrir'),
  ('assistente_direcao', 'header_button', 'salvarCopia'),
  ('assistente_direcao', 'header_button', 'salvar'),
  ('assistente_direcao', 'header_button', 'config'),
  ('convidado', 'header_button', 'novo'),
  ('convidado', 'header_button', 'abrir'),
  ('convidado', 'header_button', 'salvarCopia'),
  ('convidado', 'header_button', 'salvar'),
  ('convidado', 'header_button', 'config')
ON CONFLICT (role, restriction_type, restriction_key) DO NOTHING;
