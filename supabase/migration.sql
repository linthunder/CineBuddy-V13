-- ============================================================
-- CineBuddy — Migração inicial
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. TABELA: projects (Projetos)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  agencia TEXT DEFAULT '',
  cliente TEXT DEFAULT '',
  duracao TEXT DEFAULT '',
  duracao_unit TEXT DEFAULT 'segundos' CHECK (duracao_unit IN ('segundos', 'minutos')),

  -- Dados do orçamento armazenados como JSONB (flexível)
  budget_lines_initial JSONB DEFAULT '{}',
  verba_lines_initial JSONB DEFAULT '{}',
  budget_lines_final JSONB DEFAULT '{}',
  verba_lines_final JSONB DEFAULT '{}',
  closing_lines JSONB DEFAULT '[]',

  -- Mini Tables
  mini_tables JSONB DEFAULT '{"contingencia": 0, "crt": 0, "bvagencia": 0}',
  mini_tables_final JSONB DEFAULT '{"contingencia": 0, "crt": 0, "bvagencia": 0}',

  -- Valores financeiros
  job_value NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  job_value_final NUMERIC DEFAULT 0,
  tax_rate_final NUMERIC DEFAULT 0,

  -- Notas / observações por fase
  notes_initial JSONB DEFAULT '{"pre": "", "prod": "", "pos": ""}',
  notes_final JSONB DEFAULT '{"pre": "", "prod": "", "pos": ""}',

  -- Status de lock (cascata)
  status JSONB DEFAULT '{"initial": "open", "final": "locked", "closing": "locked"}',

  -- Dados da produtora (snapshot no momento do save)
  company_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca por nome do projeto
CREATE INDEX IF NOT EXISTS idx_projects_nome ON projects (nome);

-- ══════════════════════════════════════════════════════════════
-- 2. TABELA: collaborators (Colaboradores / Profissionais)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT DEFAULT '',
  rg TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  mei TEXT DEFAULT '',
  cnpj TEXT DEFAULT '',
  pix TEXT DEFAULT '',
  banco TEXT DEFAULT '',
  agencia TEXT DEFAULT '',
  conta TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca autocomplete por nome (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_collaborators_nome ON collaborators (lower(nome));

-- ══════════════════════════════════════════════════════════════
-- 3. TABELA: roles_rates (Funções e Cachês)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS roles_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcao TEXT NOT NULL,
  cache_dia NUMERIC DEFAULT 0,
  cache_semana NUMERIC DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca autocomplete por função (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_roles_rates_funcao ON roles_rates (lower(funcao));

-- ══════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS)
--    Por enquanto, acesso público (anon) liberado para CRUD.
--    Quando implementarmos autenticação, adicionaremos políticas
--    mais restritivas.
-- ══════════════════════════════════════════════════════════════
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_rates ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas temporárias (acesso total via anon key)
-- Remove políticas existentes antes de recriar (evita erro de duplicata)
DROP POLICY IF EXISTS "Allow all on projects" ON projects;
DROP POLICY IF EXISTS "Allow all on collaborators" ON collaborators;
DROP POLICY IF EXISTS "Allow all on roles_rates" ON roles_rates;

CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on collaborators" ON collaborators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on roles_rates" ON roles_rates FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 5. FUNÇÃO: atualizar updated_at automaticamente
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_projects ON projects;
CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_collaborators ON collaborators;
CREATE TRIGGER set_updated_at_collaborators
  BEFORE UPDATE ON collaborators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_roles_rates ON roles_rates;
CREATE TRIGGER set_updated_at_roles_rates
  BEFORE UPDATE ON roles_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- 6. SEED: Colaborador de exemplo (só insere se tabela estiver vazia)
-- ══════════════════════════════════════════════════════════════
INSERT INTO collaborators (nome, cpf, rg, telefone, email, endereco, pix)
SELECT 'Lincoln Barela', '06673803967', '96964617', '41984955938', 'lincoln.barela@gmail.com', 'Rua Professor Álvaro Jorge, 381 - Casa 2 - Vila Izabel', '41984955938'
WHERE NOT EXISTS (SELECT 1 FROM collaborators LIMIT 1);

-- ══════════════════════════════════════════════════════════════
-- 7. SEED: Funções e Cachês (Tabela 2023-2024)
--    Só insere se a tabela estiver vazia
-- ══════════════════════════════════════════════════════════════
INSERT INTO roles_rates (funcao, cache_dia, cache_semana)
SELECT * FROM (VALUES
('Autor / Roteirista', 8173.12, 40865.61),
('Pesquisador Cinematográfico', 602.23, 3011.14),
('Diretor', 995.68, 4978.38),
('Diretor de Cena', 706.93, 3534.65),
('Diretor de Imagem', 501.92, 2509.59),
('1º Assistente de Direção', 439.61, 2198.03),
('2º Assistente de Direção', 248.66, 1243.28),
('Continuista', 366.69, 1833.44),
('Preparador de Elenco', 361.10, 1805.48),
('Coordenador de Elenco', 312.12, 1560.60),
('Produtor de Elenco / Figuração', 304.35, 1521.75),
('Assistente de Preparador de Elenco / Figuração', 248.66, 1243.28),
('Produtor Geral', 300.52, 1502.62),
('Produtor Executivo', 882.89, 4414.46),
('Assistente de Produtor Executivo', 618.02, 3090.08),
('Coordenador de Produção', 618.02, 3090.08),
('Diretor de Produção', 657.31, 3286.55),
('1º Assistente de Produção', 366.69, 1833.44),
('2º Assistente de Produção', 248.66, 1243.28),
('Produtor de Set', 366.69, 1833.44),
('Produtor de Platô', 366.69, 1833.44),
('Assistente de Platô', 248.66, 1243.28),
('Produtor de Locação', 366.69, 1833.44),
('Assistente de Locação', 248.66, 1243.28),
('Assistente de Set (Ajudante Especial)', 270.83, 1354.14),
('Diretor de Arte', 657.31, 3286.55),
('Produtor de Arte', 366.69, 1833.44),
('1º Assistente de Arte', 248.66, 1243.28),
('2º Assistente de Arte', 174.06, 870.29),
('Cenógrafo', 602.23, 3011.14),
('Assistente de Cenografia', 280.66, 1403.31),
('Cenotécnico', 366.69, 1833.44),
('Assistente de Cenotécnico', 248.66, 1243.28),
('Técnico de Efeitos Especiais', 476.56, 2382.82),
('Contrarregra', 169.45, 847.24),
('Aderecista', 280.66, 1403.31),
('Produtor de Objeto', 366.69, 1833.44),
('Assistente de Objeto', 248.66, 1243.28),
('Figurinista', 602.23, 3011.14),
('Produtor de Figurino', 366.69, 1833.44),
('1º Assistente de Figurino', 248.66, 1243.28),
('Camareiro(a) / Guarda-Roupeiro(a)', 270.83, 1354.14),
('Costureira', 192.29, 961.44),
('Maquiador', 366.69, 1833.44),
('Maquiador de Efeitos Especiais', 366.69, 1833.44),
('Cabeleireiro', 439.61, 2198.03),
('Assistente de Maquiador', 169.45, 847.24),
('Assistente de Cabeleireiro', 169.45, 847.24),
('Diretor de Fotografia', 657.31, 3286.55),
('Diretor de Fotografia / Operador de Câmera', 881.59, 4407.95),
('Operador de Câmera', 602.23, 3011.14),
('1º Assistente de Câmera', 476.56, 2382.82),
('2º Assistente de Câmera', 280.66, 1403.31),
('Tid', 476.56, 2382.82),
('Gma', 280.66, 1403.31),
('Operador de Vídeo Assist', 169.45, 847.24),
('Operador de Cabo', 169.45, 847.24),
('Operador de Steadicam', 602.23, 3011.14),
('Operador de 2ª Câmera', 427.58, 2137.89),
('Assistente de 2ª Câmera', 303.58, 1517.90),
('Fotógrafo Still', 280.66, 1403.31),
('Making Off', 138.70, 693.52),
('Operador de Áudio', 571.49, 2857.44),
('Técnico de Som Direto', 657.31, 3286.55),
('Técnico de Som Guia', 439.61, 2198.03),
('Microfonista', 439.61, 2198.03),
('Assistente de Som', 386.85, 1934.27),
('Gaffer', 476.56, 2382.82),
('Eletricista Chefe', 476.56, 2382.82),
('Maquinista Chefe', 476.56, 2382.82),
('Eletricista / Maquinista', 366.69, 1833.44),
('Assistente de Eletricista', 248.66, 1243.28),
('Assistente de Maquinista', 248.66, 1243.28),
('Operador de Movimento de Câmera', 366.69, 1833.44),
('Operador de Gerador', 366.69, 1833.44),
('Produtor de Finalização', 366.69, 1833.44),
('Editor / Montador', 657.31, 3286.55),
('Assistente de Edição', 280.66, 1403.31),
('Assistente de Montagem', 280.66, 1403.31),
('Supervisor de Edição de Som', 346.69, 1733.45),
('Editor de Som', 647.29, 3236.45),
('Finalizador', 393.00, 1964.99),
('Operador de Estereoscopia', 346.69, 1733.45),
('Diretor de Animação', 882.89, 4414.46),
('Assistente de Direção de Animação', 203.02, 1015.10),
('Animador', 559.74, 2798.70),
('Assistente de Animação', 169.45, 846.24),
('Arte-Finalista', 602.23, 3011.14)
) AS v(funcao, cache_dia, cache_semana)
WHERE NOT EXISTS (SELECT 1 FROM roles_rates LIMIT 1);
