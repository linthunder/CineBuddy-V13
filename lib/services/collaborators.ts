import { supabase } from '@/lib/supabase'

export interface Collaborator {
  id: string
  nome: string
  cpf: string
  rg: string
  telefone: string
  email: string
  endereco: string
  mei: string
  cnpj: string
  pix: string
  banco: string
  agencia: string
  conta: string
  created_at: string
  updated_at: string
}

export type CollaboratorInsert = Omit<Collaborator, 'id' | 'created_at' | 'updated_at'>

/**
 * Busca colaboradores por nome (autocomplete).
 * Retorna até `limit` resultados que contenham `term` no nome (case-insensitive).
 */
export async function searchCollaborators(term: string, limit = 10): Promise<Collaborator[]> {
  if (!term || term.length < 2) return []

  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .ilike('nome', `%${term}%`)
    .order('nome')
    .limit(limit)

  if (error) {
    console.error('Erro ao buscar colaboradores:', error)
    return []
  }
  return data ?? []
}

/** Lista todos os colaboradores, ordenados por nome. */
export async function listCollaborators(): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .order('nome')

  if (error) {
    console.error('Erro ao listar colaboradores:', error)
    return []
  }
  return data ?? []
}

/** Cria um novo colaborador. */
export async function createCollaborator(collab: CollaboratorInsert): Promise<Collaborator | null> {
  const { data, error } = await supabase
    .from('collaborators')
    .insert(collab)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar colaborador:', error)
    return null
  }
  return data
}

/** Atualiza um colaborador existente. */
export async function updateCollaborator(id: string, updates: Partial<CollaboratorInsert>): Promise<Collaborator | null> {
  const { data, error } = await supabase
    .from('collaborators')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar colaborador:', error)
    return null
  }
  return data
}

/** Remove um colaborador. */
export async function deleteCollaborator(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('collaborators')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao remover colaborador:', error)
    return false
  }
  return true
}

/**
 * Importa colaboradores a partir de um array de objetos (ex: CSV parseado).
 * Insere todos de uma vez (upsert por nome para evitar duplicatas).
 */
export async function importCollaborators(rows: CollaboratorInsert[]): Promise<number> {
  if (!rows.length) return 0

  const { data, error } = await supabase
    .from('collaborators')
    .insert(rows)
    .select()

  if (error) {
    console.error('Erro ao importar colaboradores:', error)
    return 0
  }
  return data?.length ?? 0
}
