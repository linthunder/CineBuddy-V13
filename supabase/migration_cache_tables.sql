-- ============================================================
-- CineBuddy — Múltiplas tabelas de cachê
-- Permite importar, editar e alternar entre tabelas (SINDICINE, etc.)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabela de definição das tabelas de cachê
CREATE TABLE IF NOT EXISTS cache_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  source TEXT DEFAULT '',        -- ex: "SINDICINE 2024", "Outro conteúdo"
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adiciona table_id em roles_rates (FK para cache_tables)
ALTER TABLE roles_rates
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES cache_tables(id) ON DELETE CASCADE;

-- Índice para buscas por table_id
CREATE INDEX IF NOT EXISTS idx_roles_rates_table_id ON roles_rates (table_id);

-- Cria tabela padrão e associa dados existentes
DO $$
DECLARE
  default_id UUID;
BEGIN
  -- Se não existir nenhuma cache_table, cria a padrão
  IF NOT EXISTS (SELECT 1 FROM cache_tables LIMIT 1) THEN
    INSERT INTO cache_tables (name, description, source, is_default)
    VALUES ('SINDICINE 2024', 'Tabela audiovisual SINDICINE 23-24', 'SINDICINE 2024', true)
    RETURNING id INTO default_id;
    
    -- Atualiza roles_rates existentes para usar a tabela padrão
    UPDATE roles_rates SET table_id = default_id WHERE table_id IS NULL;
  END IF;
END $$;

-- Garante só uma is_default por vez (apenas uma linha pode ter is_default = true)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_tables_single_default
  ON cache_tables ((1)) WHERE is_default = true;

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at_cache_tables ON cache_tables;
CREATE TRIGGER set_updated_at_cache_tables
  BEFORE UPDATE ON cache_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Adiciona cache_table_id em projects (tabela selecionada para o projeto)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cache_table_id UUID REFERENCES cache_tables(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE cache_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cache_tables" ON cache_tables;
CREATE POLICY "Allow all on cache_tables" ON cache_tables FOR ALL USING (true) WITH CHECK (true);
