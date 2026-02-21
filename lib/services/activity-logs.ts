import { supabase } from '@/lib/supabase'

export interface ActivityLog {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: Record<string, unknown>
  created_at: string
}

export type ActivityLogInsert = Omit<ActivityLog, 'id' | 'created_at'>

/** Ações suportadas */
export type LogAction = 'create' | 'update' | 'delete' | 'open' | 'save' | 'copy' | 'upload' | 'import'

/** Tipos de entidade suportados */
export type LogEntityType =
  | 'project'
  | 'company'
  | 'collaborator'
  | 'role'
  | 'cache_table'
  | 'profile'
  | 'logo'
  | 'project_data'

export interface AddLogParams {
  action: LogAction
  entityType: LogEntityType
  entityId?: string | null
  entityName?: string | null
  details?: Record<string, unknown>
}

/** Registra uma entrada no log de atividades. Falha em silêncio quando não há sessão ou RLS bloqueia (ex.: uso local sem login). */
export async function addLog(params: AddLogParams): Promise<ActivityLog | null> {
  let user: { id: string; email?: string } | null = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    user = session?.user ?? null
  } catch {
    // Refresh token inválido/expirado: não bloquear o fluxo; registra sem user
  }
  let userName: string | null = null
  if (user) {
    try {
      const userProfile = await import('@/lib/services/profiles').then((m) => m.getMyProfile())
      userName = userProfile ? `${userProfile.name} ${userProfile.surname}`.trim() || userProfile.email : user?.email ?? null
    } catch {
      userName = user?.email ?? null
    }
  }

  const row: ActivityLogInsert = {
    user_id: user?.id ?? null,
    user_name: userName ?? '',
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    entity_name: params.entityName ?? null,
    details: params.details ?? {},
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .insert(row)
    .select()
    .single()

  if (error) {
    // RLS (42501) ou não autorizado = esperado sem login; não poluir console
    const isExpected = error.code === '42501' || /row-level security|unauthorized|401/i.test(String(error.message))
    if (!isExpected) console.error('Erro ao registrar log:', error)
    return null
  }
  return data as ActivityLog
}

export interface ListLogsParams {
  entityType?: LogEntityType
  limit?: number
  offset?: number
}

/** Lista logs de atividade, ordenados do mais recente para o mais antigo. */
export async function listLogs(params: ListLogsParams = {}): Promise<ActivityLog[]> {
  const { entityType, limit = 100, offset = 0 } = params

  let q = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (entityType) {
    q = q.eq('entity_type', entityType)
  }

  const { data, error } = await q

  if (error) {
    console.error('Erro ao listar logs:', error)
    return []
  }
  return (data ?? []) as ActivityLog[]
}
