import { supabase } from '@/lib/supabase'

export interface CacheTable {
  id: string
  name: string
  description: string
  source: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export type CacheTableInsert = Omit<CacheTable, 'id' | 'created_at' | 'updated_at'>

/** Lista todas as tabelas de cachê */
export async function listCacheTables(): Promise<CacheTable[]> {
  const { data, error } = await supabase
    .from('cache_tables')
    .select('*')
    .order('name')

  if (error) {
    console.error('Erro ao listar tabelas de cachê:', error)
    return []
  }
  return data ?? []
}

/** Obtém a tabela padrão (is_default = true) */
export async function getDefaultCacheTable(): Promise<CacheTable | null> {
  const { data, error } = await supabase
    .from('cache_tables')
    .select('*')
    .eq('is_default', true)
    .single()

  if (error) return null
  return data
}

/** Cria uma nova tabela de cachê */
export async function createCacheTable(table: CacheTableInsert): Promise<CacheTable | null> {
  if (table.is_default) {
    await supabase.from('cache_tables').update({ is_default: false })
  }
  const { data, error } = await supabase
    .from('cache_tables')
    .insert(table)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar tabela de cachê:', error)
    return null
  }
  return data
}

/** Atualiza uma tabela de cachê */
export async function updateCacheTable(id: string, updates: Partial<CacheTableInsert>): Promise<CacheTable | null> {
  if (updates.is_default === true) {
    await supabase.from('cache_tables').update({ is_default: false }).not('id', 'eq', id)
  }
  const { data, error } = await supabase
    .from('cache_tables')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar tabela de cachê:', error)
    return null
  }
  return data
}

/** Remove uma tabela de cachê e suas funções (CASCADE) */
export async function deleteCacheTable(id: string): Promise<boolean> {
  const { error } = await supabase.from('cache_tables').delete().eq('id', id)
  if (error) {
    console.error('Erro ao remover tabela de cachê:', error)
    return false
  }
  return true
}

/** Define uma tabela como padrão */
export async function setDefaultCacheTable(id: string): Promise<boolean> {
  const updated = await updateCacheTable(id, { is_default: true })
  return !!updated
}

/** Duplica uma tabela de cachê (metadados + todas as funções/cachês) */
export async function duplicateCacheTable(id: string): Promise<CacheTable | null> {
  const { data: source } = await supabase.from('cache_tables').select('*').eq('id', id).single()
  if (!source) return null

  const { data: roles } = await supabase.from('roles_rates').select('funcao, cache_dia, cache_semana').eq('table_id', id)
  const newTable: CacheTableInsert = {
    name: `${source.name} (cópia)`,
    description: source.description || '',
    source: source.source || '',
    is_default: false,
  }
  const created = await createCacheTable(newTable)
  if (!created || !roles?.length) return created

  const rows = roles.map((r) => ({ funcao: r.funcao, cache_dia: r.cache_dia, cache_semana: r.cache_semana, table_id: created.id }))
  await supabase.from('roles_rates').insert(rows)
  return created
}
