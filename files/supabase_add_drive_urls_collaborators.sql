-- Adiciona colunas para links do Google Drive na tabela collaborators.
-- Execute no Supabase: SQL Editor > New query > colar e Run.

ALTER TABLE collaborators
  ADD COLUMN IF NOT EXISTS contract_drive_url text,
  ADD COLUMN IF NOT EXISTS invoice_drive_url text;

COMMENT ON COLUMN collaborators.contract_drive_url IS 'URL do documento do contrato no Google Drive (compartilhável).';
COMMENT ON COLUMN collaborators.invoice_drive_url IS 'URL do documento da nota fiscal no Google Drive (compartilhável).';
