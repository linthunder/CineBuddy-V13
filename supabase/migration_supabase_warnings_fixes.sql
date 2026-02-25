-- ============================================================
-- CineBuddy — Correções para avisos e sugestões do Supabase
-- Execute no Supabase Dashboard > SQL Editor (em ordem)
-- ============================================================
-- 1. Function Search Path Mutable (Warnings 1 e 2)
-- 2. RLS Enabled No Policy (Sugestões 1 e 2)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. FUNÇÕES: definir search_path fixo (segurança)
-- Resolve: "Function has a role mutable search_path"
-- ══════════════════════════════════════════════════════════════

-- 1.1 update_updated_at_column (usada por triggers em várias tabelas)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.2 roles_rates_reorder (reordenação de funções/cachês)
CREATE OR REPLACE FUNCTION public.roles_rates_reorder(ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..array_length(ordered_ids, 1) LOOP
    UPDATE roles_rates SET ordem = i - 1 WHERE id = ordered_ids[i];
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 2. RLS: políticas para tabelas que tinham RLS ativo sem policy
-- Resolve: "RLS enabled but no policies exist"
-- O app acessa essas tabelas apenas via API com service_role (bypass RLS).
-- Políticas USING (false) = nenhum acesso via RLS; só service_role acessa.
-- ══════════════════════════════════════════════════════════════

-- 2.1 drive_connection (tokens OAuth Google Drive; só backend)
DROP POLICY IF EXISTS "Only backend service role" ON public.drive_connection;
CREATE POLICY "Only backend service role" ON public.drive_connection
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 2.2 job_id_sequence (contador BZ0001, BZ0002; só backend)
DROP POLICY IF EXISTS "Only backend service role" ON public.job_id_sequence;
CREATE POLICY "Only backend service role" ON public.job_id_sequence
  FOR ALL
  USING (false)
  WITH CHECK (false);


-- ══════════════════════════════════════════════════════════════
-- 3. (Opcional) Ajuste em profiles — "Admin can update any profile"
-- Reduz aviso "WITH CHECK clause is always true" mantendo o mesmo efeito.
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
