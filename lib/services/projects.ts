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
  drive_root_folder_id: string | null
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

/** Lista projetos acessíveis ao usuário atual (modal ABRIR). Usa API para filtrar por project_members. */
export async function listAccessibleProjects(search?: string): Promise<Pick<ProjectRecord, 'id' | 'job_id' | 'nome' | 'agencia' | 'cliente' | 'duracao' | 'duracao_unit' | 'updated_at'>[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const url = `/api/projects/list${search ? `?search=${encodeURIComponent(search)}` : ''}`
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
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

/** Define os membros de um projeto. Usa Supabase direto (requer RLS policies em project_members). */
export async function setProjectMembers(projectId: string, memberIds: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Não autorizado.' }

    const finalMemberIds = [...new Set([...memberIds, user.id])]

    const { error: delErr } = await supabase.from('project_members').delete().eq('project_id', projectId)
    if (delErr) {
      console.error('[setProjectMembers] delete', delErr)
      return { ok: false, error: delErr.message ?? 'Erro ao salvar membros.' }
    }

    if (finalMemberIds.length > 0) {
      const rows = finalMemberIds.map((userId) => ({ project_id: projectId, user_id: userId }))
      const { error: insertErr } = await supabase.from('project_members').insert(rows)
      if (insertErr) {
        console.error('[setProjectMembers] insert', insertErr)
        return { ok: false, error: insertErr.message ?? 'Erro ao salvar membros.' }
      }
    }

    return { ok: true }
  } catch (e) {
    console.error('[setProjectMembers]', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar membros.' }
  }
}

/** Retorna os IDs dos projetos aos quais um usuário tem acesso (via API). */
export async function getUserProjectIds(userId: string): Promise<string[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`/api/users/${userId}/projects`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) return []
    const data = await res.json().catch(() => ({})) as { projectIds?: string[] }
    return Array.isArray(data.projectIds) ? data.projectIds : []
  } catch {
    return []
  }
}

/** Define os projetos aos quais um usuário tem acesso (via API). Sincroniza em uma única chamada. */
export async function setUserProjects(userId: string, projectIds: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`/api/users/${userId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ projectIds }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? 'Erro ao salvar projetos.' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar projetos.' }
  }
}

/** Retorna os IDs dos membros de um projeto. Usa Supabase direto (requer RLS policies em project_members). */
export async function getProjectMembers(projectId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (error) {
      console.error('[getProjectMembers]', error)
      return []
    }
    return (data ?? []).map((r) => r.user_id)
  } catch (e) {
    console.error('[getProjectMembers]', e)
    return []
  }
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
