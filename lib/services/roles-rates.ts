import { supabase } from '@/lib/supabase'

export interface RoleRate {
  id: string
  funcao: string
  cache_dia: number
  cache_semana: number
  created_at: string
  updated_at: string
}

export type RoleRateInsert = Omit<RoleRate, 'id' | 'created_at' | 'updated_at'>

/**
 * Busca funções por nome (autocomplete).
 * Retorna até `limit` resultados que contenham `term` na função (case-insensitive).
 */
export async function searchRoles(term: string, limit = 10): Promise<RoleRate[]> {
  if (!term || term.length < 2) return []

  const { data, error } = await supabase
    .from('roles_rates')
    .select('*')
    .ilike('funcao', `%${term}%`)
    .order('funcao')
    .limit(limit)

  if (error) {
    console.error('Erro ao buscar funções:', error)
    return []
  }
  return data ?? []
}

/** Lista todas as funções e cachês, ordenados por nome. */
export async function listRoles(): Promise<RoleRate[]> {
  const { data, error } = await supabase
    .from('roles_rates')
    .select('*')
    .order('funcao')

  if (error) {
    console.error('Erro ao listar funções:', error)
    return []
  }
  return data ?? []
}

/** Cria uma nova função/cachê. */
export async function createRole(role: RoleRateInsert): Promise<RoleRate | null> {
  const { data, error } = await supabase
    .from('roles_rates')
    .insert(role)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar função:', error)
    return null
  }
  return data
}

/** Atualiza uma função/cachê existente. */
export async function updateRole(id: string, updates: Partial<RoleRateInsert>): Promise<RoleRate | null> {
  const { data, error } = await supabase
    .from('roles_rates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar função:', error)
    return null
  }
  return data
}

/** Remove uma função/cachê. */
export async function deleteRole(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('roles_rates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao remover função:', error)
    return false
  }
  return true
}

/**
 * Importa funções/cachês a partir de um array de objetos (ex: CSV parseado).
 */
export async function importRoles(rows: RoleRateInsert[]): Promise<number> {
  if (!rows.length) return 0

  const { data, error } = await supabase
    .from('roles_rates')
    .insert(rows)
    .select()

  if (error) {
    console.error('Erro ao importar funções:', error)
    return 0
  }
  return data?.length ?? 0
}
