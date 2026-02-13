import { supabase } from '@/lib/supabase'

export interface RoleRate {
  id: string
  table_id: string | null
  funcao: string
  cache_dia: number
  cache_semana: number
  /** Ordem de exibição; null/undefined = usar created_at. */
  ordem?: number | null
  created_at: string
  updated_at: string
}

/** Linha separadora de departamento: funcao no formato "--- NOME DO DEPARTAMENTO ---" (ex: "--- DIREÇÃO ---"). Não é uma função real; usada só para agrupar na tela. */
export function isRoleSeparator(r: { funcao: string }): boolean {
  return /^---\s*.+\s*---$/.test((r.funcao ?? '').trim())
}

/** table_id e ordem opcionais. */
export type RoleRateInsert = Omit<RoleRate, 'id' | 'created_at' | 'updated_at' | 'table_id'> & { table_id?: string | null; ordem?: number | null }

/**
 * Busca funções por nome (autocomplete).
 * Retorna até `limit` resultados que contenham `term` na função (case-insensitive).
 * @param tableId - UUID da tabela de cachê (opcional; se não informado, busca em todas)
 */
export async function searchRoles(term: string, limit = 10, tableId?: string | null): Promise<RoleRate[]> {
  if (!term || term.length < 2) return []

  let query = supabase
    .from('roles_rates')
    .select('*')
    .ilike('funcao', `%${term}%`)
    .order('funcao')
    .limit(limit)

  if (tableId) {
    query = query.eq('table_id', tableId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar funções:', error)
    return []
  }
  const list = data ?? []
  return list.filter((r) => !isRoleSeparator(r))
}

/** Lista funções e cachês: ordem por `ordem` (nulls por último) e depois created_at.
 * @param tableId - UUID da tabela de cachê (opcional; se não informado, lista todas)
 */
export async function listRoles(tableId?: string | null): Promise<RoleRate[]> {
  let query = supabase
    .from('roles_rates')
    .select('*')
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (tableId) query = query.eq('table_id', tableId)
  const { data, error } = await query

  if (error) {
    console.error('Erro ao listar funções:', error)
    return []
  }
  return data ?? []
}

/** Atualiza a ordem das funções (após arrastar). orderedIds = lista de id na nova ordem. */
export async function updateRolesOrder(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await updateRole(orderedIds[i], { ordem: i })
  }
}

/** Cria uma nova função/cachê (table_id opcional). */
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
 * @param tableId - UUID da tabela de cachê (obrigatório para associar as funções)
 */
export async function importRoles(rows: RoleRateInsert[], tableId: string): Promise<number> {
  if (!rows.length) return 0

  const rowsWithTable = rows.map((r) => ({ ...r, table_id: tableId }))
  const { data, error } = await supabase
    .from('roles_rates')
    .insert(rowsWithTable)
    .select()

  if (error) {
    console.error('Erro ao importar funções:', error)
    return 0
  }
  return data?.length ?? 0
}
