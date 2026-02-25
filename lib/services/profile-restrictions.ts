import { supabase } from '@/lib/supabase'

export type RestrictionType = 'nav_page' | 'config_tab' | 'filme_button' | 'header_button'

export interface ProfileRestriction {
  role: string
  restriction_type: RestrictionType
  restriction_key: string
}

export const NAV_PAGE_KEYS = ['home', 'filme', 'orcamento', 'orc-final', 'fechamento', 'dashboard', 'team'] as const
export const NAV_PAGE_LABELS: Record<(typeof NAV_PAGE_KEYS)[number], string> = {
  home: 'Home', filme: 'Filme', orcamento: 'Orç.Prev.', 'orc-final': 'Orç.Real.', fechamento: 'Fech.', dashboard: 'Dashboard', team: 'Equipe',
}
export const HEADER_BUTTON_KEYS = ['novo', 'abrir', 'salvarCopia', 'salvar', 'config'] as const
export const HEADER_BUTTON_LABELS: Record<(typeof HEADER_BUTTON_KEYS)[number], string> = {
  novo: 'Novo', abrir: 'Abrir', salvarCopia: 'Cópia', salvar: 'Salvar', config: 'Config',
}
export const CONFIG_TAB_KEYS = ['company', 'drive', 'users', 'collaborators', 'cache_tables', 'roles', 'projects', 'icons', 'logs'] as const
export const CONFIG_TAB_LABELS: Record<(typeof CONFIG_TAB_KEYS)[number], string> = {
  company: 'Prod.', drive: 'Drive', users: 'Usuários', collaborators: 'Colab.', cache_tables: 'Cachê', roles: 'Funç.', projects: 'Proj.', icons: 'Ícones', logs: 'Logs',
}
export const FILME_BUTTON_KEYS = ['roteiro', 'decupagem', 'ordemDia', 'cronograma', 'moodboard', 'storyboard', 'orcamento', 'apresentacao', 'drive'] as const

export const FILME_BUTTON_LABELS: Record<(typeof FILME_BUTTON_KEYS)[number], string> = {
  roteiro: 'Roteiro',
  decupagem: 'Decup.',
  ordemDia: 'Ordem',
  cronograma: 'Cron.',
  moodboard: 'Mood',
  storyboard: 'Story',
  orcamento: 'Orç.Prev.',
  apresentacao: 'Apres.',
  drive: 'Drive',
}

/** Se accessToken for passado, usa-o; senão obtém da sessão atual. Evita 401 por race em produção. */
export async function getProfileRestrictions(accessToken?: string | null): Promise<ProfileRestriction[]> {
  try {
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token
    const res = await fetch('/api/permissions/restrictions', {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return []
    const data = await res.json().catch(() => ({})) as { restrictions?: ProfileRestriction[] }
    return Array.isArray(data.restrictions) ? data.restrictions : []
  } catch {
    return []
  }
}

export async function setProfileRestrictions(restrictions: ProfileRestriction[], accessToken?: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token
    const res = await fetch('/api/permissions/restrictions', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ restrictions }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? 'Erro ao salvar.' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar.' }
  }
}
