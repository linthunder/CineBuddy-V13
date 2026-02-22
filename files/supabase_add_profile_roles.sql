-- ============================================================
-- CineBuddy — Novos perfis de usuário (hierarquia)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Remove o CHECK antigo
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Migra dados ANTES de adicionar o novo constraint (producer -> produtor_executivo)
UPDATE profiles SET role = 'produtor_executivo' WHERE role = 'producer';

-- 3. Adiciona o novo CHECK com todos os roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'atendimento',
    'produtor_executivo',
    'crew',
    'assistente_direcao',
    'convidado'
  ));
