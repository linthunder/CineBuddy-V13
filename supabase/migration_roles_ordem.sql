-- Ordem customizada das funções (arrastar para cima/baixo na tela Funções e Cachês)
ALTER TABLE roles_rates
  ADD COLUMN IF NOT EXISTS ordem INTEGER;

COMMENT ON COLUMN roles_rates.ordem IS 'Ordem de exibição; NULL = usar created_at. Atualizado ao arrastar linhas.';
