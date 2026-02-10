import { supabase } from '@/lib/supabase'

export type ProfileRole = 'admin' | 'producer'

export interface Profile {
  id: string
  role: ProfileRole
  name: string
  surname: string
  email: string
  created_at: string
  updated_at: string
}

export interface ProfileUpdate {
  role?: ProfileRole
  name?: string
  surname?: string
  email?: string
}

/** Lista todos os perfis (usuários com login). Requer autenticação. */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, name, surname, email, created_at, updated_at')
    .order('name')

  if (error) {
    console.error('Erro ao listar perfis:', error)
    return []
  }
  return (data ?? []) as Profile[]
}

/** Busca o perfil do usuário logado. */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, name, surname, email, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Erro ao buscar perfil:', error)
    return null
  }
  return data as Profile
}

/** Busca um perfil por id. */
export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, name, surname, email, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Profile
}

/** Atualiza perfil. O próprio usuário pode atualizar seus dados; admin pode atualizar qualquer um. */
export async function updateProfile(id: string, updates: ProfileUpdate): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(updates.role !== undefined && { role: updates.role }),
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.surname !== undefined && { surname: updates.surname }),
      ...(updates.email !== undefined && { email: updates.email }),
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar perfil:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
