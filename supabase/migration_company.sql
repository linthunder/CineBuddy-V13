-- ============================================================
-- CineBuddy — Migração: Tabela company (Dados da Produtora)
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS company (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT DEFAULT '',
  nome_fantasia TEXT DEFAULT '',
  cnpj TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  site TEXT DEFAULT '',
  endereco TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on company" ON company;
CREATE POLICY "Allow all on company" ON company FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at_company ON company;
CREATE TRIGGER set_updated_at_company
  BEFORE UPDATE ON company
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed: criar um registro vazio (só se a tabela estiver vazia)
INSERT INTO company (razao_social)
SELECT ''
WHERE NOT EXISTS (SELECT 1 FROM company LIMIT 1);
