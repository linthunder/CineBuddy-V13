-- Tabela para armazenar a conexão OAuth do Google Drive (uma única linha para o app).
-- Usado quando não há Shared Drive; o admin conecta sua conta pessoal.
CREATE TABLE IF NOT EXISTS drive_connection (
  id text PRIMARY KEY DEFAULT 'default',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  email text,
  root_folder_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE drive_connection IS 'Tokens OAuth do Google Drive. Uma linha = uma conexão (conta do admin).';
