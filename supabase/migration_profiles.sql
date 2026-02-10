-- ============================================================
-- CineBuddy — Perfis de usuário (login: admin / produtor)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabela profiles: id = auth.users.id, role, nome, sobrenome, email
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'producer' CHECK (role IN ('admin', 'producer')),
  name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (lower(email));

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read all profiles" ON profiles;
CREATE POLICY "Authenticated can read all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "User can update own profile" ON profiles;
CREATE POLICY "User can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;
CREATE POLICY "Admin can update any profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;
CREATE POLICY "Admin can insert profiles" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Permissão para inserção inicial: se não existir nenhum perfil, permitir um insert (cadastro inicial).
-- Isso será feito via API com service role, então não precisamos de policy para "first user".
-- O primeiro usuário será criado pela API /api/auth/init com service role.
