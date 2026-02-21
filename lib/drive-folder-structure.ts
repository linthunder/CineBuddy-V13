/**
 * Estrutura fixa de pastas por projeto no Google Drive.
 * Espelha Arquivos/(_ID_NOME_DO_PROJETO) — pastas entre parênteses são nomeadas pelo sistema.
 */

/** Caminhos relativos à raiz do projeto (cada string = caminho completo com /). EQUIPE e CASTING sob PRESTAÇÃO DE CONTAS/PRODUÇÃO recebem pastas dinâmicas por membro. */
export const FIXED_PROJECT_FOLDER_PATHS: string[] = [
  '__BRUTAS',
  '__BRUTAS/AUDIO',
  '__BRUTAS/AUDIO/DIA01',
  '__BRUTAS/VIDEO',
  '__BRUTAS/VIDEO/DIA01',
  '__EXTRAS',
  '__EXTRAS/KVs',
  '__EXTRAS/ORDEM DO DIA',
  '__EXTRAS/REFs',
  '__EXTRAS/ROTEIRO',
  '__EXTRAS/STORYBOARD',
  '_COLOR',
  '_COLOR/EXTRAS',
  '_COLOR/EXTRAS/FONTS',
  '_COLOR/EXTRAS/GRAPHICS',
  '_COLOR/EXTRAS/IA',
  '_COLOR/EXTRAS/REFs',
  '_COLOR/RENDERS',
  '_COLOR/RENDERS/_WIP',
  '_COLOR/RENDERS/COLOR_CONFORM',
  '_COLOR/STILLS',
  '_COLOR/TIMELINES',
  '_EDIT',
  '_EDIT/EXTRAS',
  '_EDIT/EXTRAS/SUBTITLES',
  '_EDIT/FOOTAGE',
  '_EDIT/FOOTAGE/AUDIO',
  '_EDIT/FOOTAGE/STOCK',
  '_EDIT/MIX',
  '_EDIT/PROJECTS',
  '_EDIT/PROJECTS/RESOLVE',
  '_EDIT/RENDERS',
  '_EDIT/RENDERS/_DELIVERY',
  '_EDIT/RENDERS/_WIP',
  '_EDIT/RENDERS/AUDIO_CONFORM',
  '_EDIT/RENDERS/COLOR_CONFORM',
  '_EDIT/RENDERS/MOTION_CONFORM',
  '_EDIT/RENDERS/VFX_CONFORM',
  '_EDIT/STILLS',
  '_EDIT/TIMELINES',
  '_MOTION',
  '_MOTION/3D',
  '_MOTION/3D/ASSETS',
  '_MOTION/3D/ASSETS/HDRI',
  '_MOTION/3D/ASSETS/MESHES',
  '_MOTION/3D/ASSETS/TEXTURES',
  '_MOTION/3D/BLENDER',
  '_MOTION/EXTRAS',
  '_MOTION/EXTRAS/FONTS',
  '_MOTION/EXTRAS/GRAPHICS',
  '_MOTION/EXTRAS/IA',
  '_MOTION/EXTRAS/REFs',
  '_MOTION/FOOTAGE',
  '_MOTION/FOOTAGE/AUDIO',
  '_MOTION/FOOTAGE/STOCK',
  '_MOTION/PROJECTS',
  '_MOTION/PROJECTS/AE',
  '_MOTION/RENDERS',
  '_MOTION/RENDERS/_DELIVERY',
  '_MOTION/RENDERS/_WIP',
  '_MOTION/RENDERS/AE',
  '_MOTION/STILLS',
  '_MOTION/STILLS/CLEANPLATES',
  '_PRODUÇÃO',
  '_PRODUÇÃO/JURÍDICO E SEGUROS',
  '_PRODUÇÃO/LIBERAÇÕES',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/EQUIPE',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/CASTING',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/ARTE E CENOGRAFIA',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/FIGURINO E MAQUIAGEM',
  '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/FOTOGRAFIA E TÉCNICA',
  '_VFX',
  '_VFX/3D',
  '_VFX/3D/ASSETS',
  '_VFX/3D/ASSETS/HDRI',
  '_VFX/3D/ASSETS/MESHES',
  '_VFX/3D/ASSETS/TEXTURES',
  '_VFX/3D/BLENDER',
  '_VFX/EXTRAS',
  '_VFX/EXTRAS/FONTS',
  '_VFX/EXTRAS/GRAPHICS',
  '_VFX/EXTRAS/IA',
  '_VFX/EXTRAS/REFs',
  '_VFX/FOOTAGE',
  '_VFX/FOOTAGE/AUDIO',
  '_VFX/FOOTAGE/STOCK',
  '_VFX/PROJECTS',
  '_VFX/PROJECTS/AE',
  '_VFX/RENDERS',
  '_VFX/RENDERS/_DELIVERY',
  '_VFX/RENDERS/_WIP',
  '_VFX/RENDERS/FUSION',
  '_VFX/STILLS',
  '_VFX/STILLS/CLEANPLATES',
]

/** Subpastas dentro de cada pasta de membro em EQUIPE e CASTING. CONTRATO e NOTA FISCAL (nota fiscal do profissional). */
export const EQUIPE_MEMBER_SUBFOLDERS = ['CONTRATO', 'NOTA FISCAL'] as const

/** Path base para membros da equipe (labor) — sob PRESTAÇÃO DE CONTAS/PRODUÇÃO. */
export const EQUIPE_DRIVE_PATH = '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/EQUIPE'

/** Path base para casting — sob PRESTAÇÃO DE CONTAS/PRODUÇÃO. */
export const CASTING_DRIVE_PATH = '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/CASTING'

export interface TeamMemberForDrive {
  name: string
  role: string
}

/** Gera o nome da pasta do membro: "Nome (Função)". */
export function memberFolderName(m: TeamMemberForDrive): string {
  const name = (m.name || '').trim() || 'Sem nome'
  const role = (m.role || '').trim()
  return role ? `${name} (${role})` : name
}

/** Extrai { name, role } de um nome de pasta "Nome (Função)" ou "Nome". */
export function parseMemberFolderName(folderName: string): { name: string; role: string } {
  const s = (folderName || '').trim()
  const match = s.match(/^(.+?)\s*\(([^)]*)\)\s*$/)
  if (match) return { name: match[1].trim(), role: match[2].trim() }
  return { name: s || 'Sem nome', role: '' }
}

/** Extrai lista única de membros da equipe (labor) a partir de budget_lines_final. Exclui CASTING (tratado em extractCastingFromBudgetLines). */
export function extractTeamFromBudgetLines(budgetLines: Record<string, unknown>): TeamMemberForDrive[] {
  const phases = ['pre', 'prod', 'pos'] as const
  const seen = new Set<string>()
  const list: TeamMemberForDrive[] = []
  for (const phase of phases) {
    const phaseData = budgetLines[phase]
    if (!phaseData || typeof phaseData !== 'object') continue
    const depts = phaseData as Record<string, unknown>
    for (const [deptName, dept] of Object.entries(depts)) {
      if (deptName === 'CASTING' || !Array.isArray(dept)) continue
      for (const row of dept) {
        if (!row || typeof row !== 'object') continue
        const r = row as { type?: string; itemName?: string; roleFunction?: string }
        if (r.type !== 'labor') continue
        const name = (r.itemName ?? '').toString().trim() || 'Sem nome'
        const role = (r.roleFunction ?? '').toString().trim()
        const key = `${name}__${role}`
        if (seen.has(key)) continue
        seen.add(key)
        list.push({ name, role })
      }
    }
  }
  return list
}

/** Extrai lista de casting (Nome/Descrição) a partir de budget_lines_final. */
export function extractCastingFromBudgetLines(budgetLines: Record<string, unknown>): TeamMemberForDrive[] {
  const phases = ['pre', 'prod', 'pos'] as const
  const seen = new Set<string>()
  const list: TeamMemberForDrive[] = []
  for (const phase of phases) {
    const phaseData = budgetLines[phase]
    if (!phaseData || typeof phaseData !== 'object') continue
    const depts = phaseData as Record<string, unknown>
    const casting = depts['CASTING']
    if (!Array.isArray(casting)) continue
    for (const row of casting) {
      if (!row || typeof row !== 'object') continue
      const r = row as { itemName?: string; roleFunction?: string }
      const name = (r.itemName ?? '').toString().trim() || 'Sem nome'
      const role = (r.roleFunction ?? '').toString().trim()
      const key = `${name}__${role}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ name, role })
    }
  }
  return list
}

/** Departamentos de custo (não-labor) que têm pastas sob PRODUÇÃO no Drive. */
export const COST_DEPARTMENTS_FOR_DRIVE = ['EQUIPAMENTOS', 'LOCAÇÕES', 'TRANSPORTE', 'CATERING', 'DESPESAS GERAIS'] as const

/** Extrai itens de custo por departamento (EQUIPAMENTOS, LOCAÇÕES, etc.) a partir de budget_lines_final. */
export function extractCostItemsByDepartment(budgetLines: Record<string, unknown>): Record<string, TeamMemberForDrive[]> {
  const byDept: Record<string, TeamMemberForDrive[]> = {}
  const phases = ['pre', 'prod', 'pos'] as const
  for (const dept of COST_DEPARTMENTS_FOR_DRIVE) {
    const seen = new Set<string>()
    const list: TeamMemberForDrive[] = []
    for (const phase of phases) {
      const phaseData = budgetLines[phase]
      if (!phaseData || typeof phaseData !== 'object') continue
      const depts = phaseData as Record<string, unknown>
      const rows = depts[dept]
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const r = row as { type?: string; itemName?: string; roleFunction?: string }
        if (r.type === 'people') continue
        const name = (r.itemName ?? '').toString().trim() || 'Sem nome'
        const role = (r.roleFunction ?? '').toString().trim()
        const key = `${name}__${role}`
        if (seen.has(key)) continue
        seen.add(key)
        list.push({ name, role })
      }
    }
    if (list.length > 0) byDept[dept] = list
  }
  return byDept
}

/** Nome da pasta para item de custo (ex.: EQUIPAMENTOS/Link Remoto). Deve bater com o path usado no upload. */
export function costItemFolderName(m: TeamMemberForDrive): string {
  const raw = (m.name || '').trim() || (m.role || '').trim() || 'Sem nome'
  return raw.replace(/\//g, '-')
}
