-- ============================================================
-- CineBuddy — Migração: Tabela activity_logs (Log de atividades)
-- Registra edições feitas por usuários com timestamp.
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read all activity_logs" ON activity_logs;
CREATE POLICY "Authenticated can read all activity_logs" ON activity_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON activity_logs;
CREATE POLICY "Authenticated can insert activity_logs" ON activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);
