import { supabase } from '@/lib/supabase'

export interface ProjectRecord {
  id: string
  job_id: string
  nome: string
  agencia: string
  cliente: string
  duracao: string
  duracao_unit: string
  cache_table_id: string | null
  budget_lines_initial: Record<string, unknown>
  verba_lines_initial: Record<string, unknown>
  budget_lines_final: Record<string, unknown>
  verba_lines_final: Record<string, unknown>
  closing_lines: unknown[]
  mini_tables: Record<string, number>
  mini_tables_final: Record<string, number>
  job_value: number
  tax_rate: number
  job_value_final: number
  tax_rate_final: number
  notes_initial: Record<string, string>
  notes_final: Record<string, string>
  status: Record<string, string>
  company_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ProjectInsert = Omit<ProjectRecord, 'id' | 'created_at' | 'updated_at'>

/** Lista todos os projetos (resumo). */
export async function listProjects(): Promise<Pick<ProjectRecord, 'id' | 'job_id' | 'nome' | 'agencia' | 'cliente' | 'duracao' | 'duracao_unit' | 'updated_at'>[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, job_id, nome, agencia, cliente, duracao, duracao_unit, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar projetos:', error)
    return []
  }
  return data ?? []
}

/** Busca projetos por nome (para modal ABRIR). */
export async function searchProjects(term: string): Promise<Pick<ProjectRecord, 'id' | 'job_id' | 'nome' | 'agencia' | 'cliente' | 'duracao' | 'duracao_unit' | 'updated_at'>[]> {
  if (!term) return listProjects()

  const { data, error } = await supabase
    .from('projects')
    .select('id, job_id, nome, agencia, cliente, duracao, duracao_unit, updated_at')
    .ilike('nome', `%${term}%`)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar projetos:', error)
    return []
  }
  return data ?? []
}

/** Carrega um projeto completo pelo ID. */
export async function getProject(id: string): Promise<ProjectRecord | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Erro ao carregar projeto:', error)
    return null
  }
  return data
}

/** Cria um novo projeto. */
export async function createProject(project: Partial<ProjectInsert>): Promise<ProjectRecord | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar projeto:', error)
    return null
  }
  return data
}

/** Atualiza um projeto existente. */
export async function updateProject(id: string, updates: Partial<ProjectInsert>): Promise<ProjectRecord | null> {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar projeto:', error)
    return null
  }
  return data
}

/** Remove um projeto. */
export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao remover projeto:', error)
    return false
  }
  return true
}
