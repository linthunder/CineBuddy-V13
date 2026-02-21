-- Adiciona coluna para armazenar o ID da pasta raiz do projeto no Google Drive.
-- Execute no SQL Editor do Supabase (Dashboard do projeto).

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS drive_root_folder_id text;

COMMENT ON COLUMN projects.drive_root_folder_id IS 'ID da pasta raiz do projeto no Google Drive (preenchido após primeira sincronização).';
