-- ============================================================
-- CineBuddy — Políticas RLS para project_members
-- Permite que admin/atendimento e membros do projeto gerenciem
-- Execute no Supabase Dashboard > SQL Editor (após supabase_project_members.sql)
--
-- ============================================================

-- Remove políticas antigas (se existirem, para evitar conflito)
DROP POLICY IF EXISTS "project_members_member_manage" ON project_members;
DROP POLICY IF EXISTS "project_members_admin_atendimento_all" ON project_members;

-- Função que verifica se o usuário é membro (evita recursão na policy)
CREATE OR REPLACE FUNCTION public.is_project_member(proj_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = proj_id AND user_id = uid
  );
$$;

-- Admin e atendimento: acesso total
CREATE POLICY "project_members_admin_atendimento_all"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento')
    )
  );

-- Membros do projeto: podem ver e gerenciar (usa função SECURITY DEFINER para evitar recursão)
CREATE POLICY "project_members_member_manage"
  ON project_members FOR ALL
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
