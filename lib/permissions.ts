/**
 * Permissões por perfil de usuário.
 * Hierarquia: admin > atendimento > produtor_executivo > crew | convidado > assistente_direcao
 * Suporta restrições dinâmicas da tabela profile_restrictions quando disponíveis.
 */

import type { ViewId } from '@/components/BottomNav'
import type { ProfileRestriction } from '@/lib/services/profile-restrictions'

export type ProfileRole =
  | 'admin'
  | 'atendimento'
  | 'produtor_executivo'
  | 'crew'
  | 'assistente_direcao'
  | 'convidado'

export const PROFILE_LABELS: Record<ProfileRole, string> = {
  admin: 'Administrador',
  atendimento: 'Atendimento',
  produtor_executivo: 'Produtor Executivo',
  crew: 'Crew',
  assistente_direcao: 'Assistente de Direção',
  convidado: 'Convidado',
}

/** Abas da Config (todas as do menu). */
export const CONFIG_TAB_IDS = ['company', 'drive', 'users', 'collaborators', 'cache_tables', 'roles', 'projects', 'icons', 'logs'] as const
export type ConfigRestrictedTab = (typeof CONFIG_TAB_IDS)[number]

function normalizeRole(role: string | null | undefined): ProfileRole | null | undefined {
  if (!role) return undefined
  if (role === 'producer') return 'produtor_executivo'
  return role as ProfileRole
}

function isRestricted(role: string, type: ProfileRestriction['restriction_type'], key: string, restrictions: ProfileRestriction[]): boolean {
  const r = normalizeRole(role) ?? role
  return restrictions.some((x) => (normalizeRole(x.role) ?? x.role) === r && x.restriction_type === type && x.restriction_key === key)
}

/** Views do BottomNav bloqueadas por perfil. Usa restrictions quando a tabela tem dados, senão fallback hardcoded. */
export function getRoleDisabledViews(
  role: ProfileRole | string | null | undefined,
  restrictions?: ProfileRestriction[] | null
): ViewId[] {
  const r = normalizeRole(role)
  if (!r || r === 'admin') return []
  const useDb = Array.isArray(restrictions) && restrictions.length > 0
  if (useDb) {
    const navViews: ViewId[] = ['home', 'filme', 'orcamento', 'orc-final', 'fechamento', 'dashboard', 'team']
    return navViews.filter((v) => isRestricted(String(r), 'nav_page', v, restrictions!))
  }
  if (r === 'atendimento') return []
  if (r === 'produtor_executivo') return ['home']
  if (r === 'crew') return ['fechamento', 'orc-final', 'orcamento', 'dashboard']
  if (r === 'assistente_direcao' || r === 'convidado') return ['home', 'fechamento', 'orc-final', 'orcamento', 'dashboard']
  return []
}

/** Botões do header restritos para o perfil. Usa restrictions quando há dados, senão fallback hardcoded. */
export function getRestrictedHeaderButtons(
  role: ProfileRole | string | null | undefined,
  restrictions?: ProfileRestriction[] | null
): string[] {
  const r = normalizeRole(role)
  if (!r || r === 'admin') return []
  const useDb = Array.isArray(restrictions) && restrictions.length > 0
  if (useDb) {
    return (restrictions!)
      .filter((x) => (normalizeRole(x.role) ?? x.role) === r && x.restriction_type === 'header_button')
      .map((x) => x.restriction_key)
  }
  if (r === 'assistente_direcao' || r === 'convidado') return ['novo', 'abrir', 'salvarCopia', 'salvar', 'config']
  return []
}

/** Se o perfil deve ver apenas o botão SAIR no header (todos os outros restritos). */
export function shouldRestrictHeaderToLogoutOnly(
  role: ProfileRole | string | null | undefined,
  restrictions?: ProfileRestriction[] | null
): boolean {
  const restricted = getRestrictedHeaderButtons(role, restrictions)
  const allButtons = ['novo', 'abrir', 'salvarCopia', 'salvar', 'config']
  return allButtons.every((btn) => restricted.includes(btn))
}

/** Abas da Config restritas para o perfil. Usa restrictions quando há dados, senão fallback (drive, projects, logs). */
export function getRestrictedConfigTabs(
  role: ProfileRole | string | null | undefined,
  restrictions?: ProfileRestriction[] | null
): string[] {
  const r = normalizeRole(role)
  if (!r || r === 'admin') return []
  const useDb = Array.isArray(restrictions) && restrictions.length > 0
  if (useDb) {
    return (restrictions!)
      .filter((x) => (normalizeRole(x.role) ?? x.role) === r && x.restriction_type === 'config_tab')
      .map((x) => x.restriction_key)
  }
  return ['drive', 'projects', 'logs']
}

/** @deprecated Use getRestrictedConfigTabs. Retorna true se o perfil tem alguma aba config restrita. */
export function shouldHideConfigRestrictedTabs(
  role: ProfileRole | string | null | undefined,
  restrictions?: ProfileRestriction[] | null
): boolean {
  return getRestrictedConfigTabs(role, restrictions).length > 0
}

/** Retorna os IDs dos botões da página Filme bloqueados para o perfil. */
export function getRoleDisabledFilmeButtons(
  role: ProfileRole | string | null | undefined,
  restrictions?: ProfileRestriction[] | null
): string[] {
  const r = normalizeRole(role)
  if (!r || r === 'admin') return []
  if (!restrictions || restrictions.length === 0) return []
  return restrictions
    .filter((x) => (normalizeRole(x.role) ?? x.role) === r && x.restriction_type === 'filme_button')
    .map((x) => x.restriction_key)
}

/** Perfis incluídos automaticamente na seleção de membros ao criar projeto (podem ser desmarcados). */
export const PROJECT_AUTO_INCLUDE_ROLES: ProfileRole[] = ['admin', 'atendimento', 'crew']
