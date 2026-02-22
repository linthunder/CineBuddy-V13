-- ============================================================
-- CineBuddy — Habilitar RLS em profile_restrictions
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================
-- Corrige o aviso: "Table public.profile_restrictions is public, but RLS has not been enabled"
-- O acesso à tabela é feito via API routes (service_role, que ignora RLS).
-- As políticas abaixo regem acesso direto via PostgREST (anon/authenticated).

ALTER TABLE profile_restrictions ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários autenticados podem ler (necessário para carregar restrições)
DROP POLICY IF EXISTS "profile_restrictions_select_authenticated" ON profile_restrictions;
CREATE POLICY "profile_restrictions_select_authenticated"
  ON profile_restrictions FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: apenas via service_role (API). Sem política para authenticated/anon = negado.
