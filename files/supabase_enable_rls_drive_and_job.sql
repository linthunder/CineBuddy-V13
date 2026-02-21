-- ============================================================
-- CineBuddy — Corrige avisos críticos de segurança no Supabase
-- 1. RLS desabilitado em public.drive_connection
-- 2. RLS desabilitado em public.job_id_sequence
-- 3. Colunas sensíveis (access_token, refresh_token) expostas sem RLS
--
-- Execute no Supabase Dashboard > SQL Editor
-- Após executar, os avisos devem desaparecer.
-- ============================================================

-- ---------- drive_connection ----------
-- Tabela com tokens OAuth (access_token, refresh_token). Acessada APENAS
-- por API routes com service_role (que bypassa RLS). Ao habilitar RLS
-- sem políticas permissivas, bloqueamos anon e authenticated.
ALTER TABLE public.drive_connection ENABLE ROW LEVEL SECURITY;

-- Sem políticas = nenhum acesso para anon/authenticated.
-- O service_role (usado pelas API routes) continua com acesso total.

-- ---------- job_id_sequence ----------
-- Contador sequencial para job_id (BZ0001, BZ0002...). Atualizado apenas
-- pela função get_next_job_number() (SECURITY DEFINER). API acessa via RPC,
-- nunca diretamente. RLS bloqueia acesso direto via PostgREST.
ALTER TABLE public.job_id_sequence ENABLE ROW LEVEL SECURITY;

-- Sem políticas = nenhum acesso para anon/authenticated.
-- A função get_next_job_number() continua funcionando (SECURITY DEFINER).
