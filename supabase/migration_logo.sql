-- ============================================================
-- CineBuddy — Migração: Logo da Produtora (Storage + coluna)
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Adicionar coluna logo_url na tabela company
ALTER TABLE company ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- 2. Criar bucket de storage para logos (público para leitura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de acesso ao storage (permissivo por enquanto)
DO $$
BEGIN
  -- Leitura pública
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow public read logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
  END IF;

  -- Upload (anon)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon upload logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow anon upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
  END IF;

  -- Update (anon)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow anon update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos');
  END IF;

  -- Delete (anon)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon delete logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow anon delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'logos');
  END IF;
END $$;
