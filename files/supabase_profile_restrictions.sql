-- ============================================================
-- CineBuddy — Restrições de perfis (configuráveis)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================
-- 3 níveis: PROJETO (project_members), PÁGINAS (nav/config), FILME (botões)
-- PROJETO = project_members. PÁGINAS = nav_page + config_tab. FILME = filme_button.
--
-- RESTRIÇÕES PADRÃO:
-- 1. ADMINISTRADOR: Acesso completo (nenhuma linha).
-- 2. ATENDIMENTO: Abas Config → Drive, Projetos, Logs ocultas.
-- 3. PRODUTOR EXECUTIVO: Igual Atendimento + página HOME (nav) oculta.
-- 4. CREW: Igual Atendimento + páginas Fechamento, Orç. Realizado, Orç. Previsto, Dashboard ocultas.
-- 5. ASSISTENTE DE DIREÇÃO: Igual Crew + página HOME oculta + Header (todos os botões restritos, só SAIR).
-- 6. CONVIDADO: Igual Assistente de Direção.

CREATE TABLE IF NOT EXISTS profile_restrictions (
  role TEXT NOT NULL,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('nav_page', 'config_tab', 'filme_button', 'header_button')),
  restriction_key TEXT NOT NULL,
  PRIMARY KEY (role, restriction_type, restriction_key)
);

COMMENT ON TABLE profile_restrictions IS 'Itens bloqueados por perfil. Ex: crew não vê fechamento, orc-final, etc.';

-- RLS (obrigatório para tabelas públicas no Supabase)
ALTER TABLE profile_restrictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_restrictions_select_authenticated" ON profile_restrictions;
CREATE POLICY "profile_restrictions_select_authenticated"
  ON profile_restrictions FOR SELECT TO authenticated USING (true);

-- Índices para buscas
CREATE INDEX IF NOT EXISTS idx_profile_restrictions_role ON profile_restrictions(role);

-- Seed com valores atuais (baseado em lib/permissions.ts)
-- admin: sem restrições
-- atendimento: sem restrições
-- produtor_executivo: bloqueia home
INSERT INTO profile_restrictions (role, restriction_type, restriction_key) VALUES
  ('produtor_executivo', 'nav_page', 'home')
ON CONFLICT (role, restriction_type, restriction_key) DO NOTHING;

-- crew: fechamento, orc-final, orcamento, dashboard
INSERT INTO profile_restrictions (role, restriction_type, restriction_key) VALUES
  ('crew', 'nav_page', 'fechamento'),
  ('crew', 'nav_page', 'orc-final'),
  ('crew', 'nav_page', 'orcamento'),
  ('crew', 'nav_page', 'dashboard')
ON CONFLICT (role, restriction_type, restriction_key) DO NOTHING;

-- assistente_direcao e convidado: home, fechamento, orc-final, orcamento, dashboard
INSERT INTO profile_restrictions (role, restriction_type, restriction_key) VALUES
  ('assistente_direcao', 'nav_page', 'home'),
  ('assistente_direcao', 'nav_page', 'fechamento'),
  ('assistente_direcao', 'nav_page', 'orc-final'),
  ('assistente_direcao', 'nav_page', 'orcamento'),
  ('assistente_direcao', 'nav_page', 'dashboard'),
  ('convidado', 'nav_page', 'home'),
  ('convidado', 'nav_page', 'fechamento'),
  ('convidado', 'nav_page', 'orc-final'),
  ('convidado', 'nav_page', 'orcamento'),
  ('convidado', 'nav_page', 'dashboard')
ON CONFLICT (role, restriction_type, restriction_key) DO NOTHING;

-- config_tab: drive, projects, logs (para todos exceto admin)
-- Por ora não vamos seedar config_tab aqui - a lógica shouldHideConfigRestrictedTabs 
-- esconde para role !== admin. Podemos adicionar à tabela depois.
-- Para flexibilidade, inserimos as restrições de config que existem hoje:
INSERT INTO profile_restrictions (role, restriction_type, restriction_key) VALUES
  ('atendimento', 'config_tab', 'drive'),
  ('atendimento', 'config_tab', 'projects'),
  ('atendimento', 'config_tab', 'logs'),
  ('produtor_executivo', 'config_tab', 'drive'),
  ('produtor_executivo', 'config_tab', 'projects'),
  ('produtor_executivo', 'config_tab', 'logs'),
  ('crew', 'config_tab', 'drive'),
  ('crew', 'config_tab', 'projects'),
  ('crew', 'config_tab', 'logs'),
  ('assistente_direcao', 'config_tab', 'drive'),
  ('assistente_direcao', 'config_tab', 'projects'),
  ('assistente_direcao', 'config_tab', 'logs'),
  ('convidado', 'config_tab', 'drive'),
  ('convidado', 'config_tab', 'projects'),
  ('convidado', 'config_tab', 'logs')
ON CONFLICT (role, restriction_type, restriction_key) DO NOTHING;

-- header_button: assistente_direcao e convidado — todos os botões do header restritos (novo, abrir, salvarCopia, salvar, config)
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
