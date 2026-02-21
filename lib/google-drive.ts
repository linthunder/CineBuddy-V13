/**
 * Cliente Google Drive API (v3) usando OAuth.
 * Usado no servidor (API routes) para criar/atualizar estrutura de pastas por projeto.
 * A conexão é feita em Configurações → Drive (conta do admin).
 */

import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { getAuthenticatedClient, getDriveRootFolderId } from '@/lib/google-drive-oauth'
import {
  FIXED_PROJECT_FOLDER_PATHS,
  EQUIPE_MEMBER_SUBFOLDERS,
  memberFolderName,
  parseMemberFolderName,
  extractCastingFromBudgetLines,
  extractCostItemsByDepartment,
  costItemFolderName,
  type TeamMemberForDrive,
} from '@/lib/drive-folder-structure'

async function getDrive() {
  const auth = await getAuthenticatedClient()
  return google.drive({ version: 'v3', auth })
}

/** Cria uma pasta no Drive. Retorna o ID da pasta criada. */
export async function createFolder(parentId: string, name: string): Promise<string> {
  const drive = await getDrive()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  const id = res.data.id
  if (!id) throw new Error('Drive API não retornou id da pasta.')
  return id
}

/** Lista pastas (só pastas) dentro de um pai. Retorna mapa nome -> id. */
export async function listFolderIdsByName(parentId: string): Promise<Map<string, string>> {
  const drive = await getDrive()
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 500,
    supportsAllDrives: true,
  })
  const map = new Map<string, string>()
  for (const f of res.data.files ?? []) {
    if (f.id && f.name) map.set(f.name, f.id)
  }
  return map
}

/** Verifica se uma pasta existe e está acessível no Drive (não na lixeira). */
export async function folderExistsInDrive(folderId: string): Promise<boolean> {
  if (!folderId?.trim()) return false
  try {
    const drive = await getDrive()
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id,trashed',
      supportsAllDrives: true,
    })
    const ok = res.data.id && res.data.trashed !== true
    return !!ok
  } catch {
    return false
  }
}

/** Tenta usar a pasta raiz (criar subpasta). Se falhar, a pasta foi excluída ou é inválida. */
async function canUseRootFolder(rootId: string): Promise<boolean> {
  try {
    await listFolderIdsByName(rootId)
    return true
  } catch {
    return false
  }
}

/** Obtém ou cria uma pasta com o nome dado dentro do pai. Retorna o ID. */
export async function getOrCreateFolder(parentId: string, name: string): Promise<string> {
  const existing = await listFolderIdsByName(parentId)
  const id = existing.get(name)
  if (id) return id
  return createFolder(parentId, name)
}

/** Verifica se um caminho existe sem criar pastas. Retorna false se qualquer segmento não existir. */
export async function pathExists(parentId: string, path: string): Promise<boolean> {
  const parts = path.split('/').filter(Boolean)
  let currentId = parentId
  for (const part of parts) {
    try {
      const existing = await listFolderIdsByName(currentId)
      const id = existing.get(part)
      if (!id) return false
      currentId = id
    } catch {
      return false
    }
  }
  return true
}

/** Dado um pai e um caminho (ex: "a/b/c"), obtém ou cria toda a árvore e retorna o ID da pasta final. */
export async function getOrCreatePath(parentId: string, path: string): Promise<string> {
  const parts = path.split('/').filter(Boolean)
  let currentId = parentId
  for (const part of parts) {
    currentId = await getOrCreateFolder(currentId, part)
  }
  return currentId
}

/** Cria a pasta raiz do projeto (nome = ID - Nome - Cliente) dentro da pasta "CineBuddy - Projetos" e retorna o ID. */
export async function createProjectRootFolder(projectFolderName: string): Promise<string> {
  const rootId = await getDriveRootFolderId()
  return createFolder(rootId, projectFolderName)
}

/** Agrupa caminhos por profundidade (1 = um segmento, 2 = dois, etc.) para criar em paralelo por nível. */
function groupPathsByDepth(paths: string[]): string[][] {
  const byDepth = new Map<number, string[]>()
  for (const path of paths) {
    const depth = path.split('/').filter(Boolean).length
    if (!byDepth.has(depth)) byDepth.set(depth, [])
    byDepth.get(depth)!.push(path)
  }
  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b)
  return depths.map((d) => byDepth.get(d)!)
}

/** Cria toda a estrutura fixa dentro da raiz do projeto (níveis em paralelo para ser mais rápido). */
export async function createFixedStructure(projectRootId: string): Promise<void> {
  const byLevel = groupPathsByDepth(FIXED_PROJECT_FOLDER_PATHS)
  for (const pathsOfLevel of byLevel) {
    await Promise.all(pathsOfLevel.map((path) => getOrCreatePath(projectRootId, path)))
  }
}

/** Retorna o ID da pasta _PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/EQUIPE (já deve existir após createFixedStructure). */
export async function getEquipeFolderId(projectRootId: string): Promise<string> {
  return getOrCreatePath(projectRootId, '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/EQUIPE')
}

/** Renomeia uma pasta no Drive. */
async function updateFolderName(folderId: string, newName: string): Promise<void> {
  const drive = await getDrive()
  await drive.files.update({
    fileId: folderId,
    requestBody: { name: newName },
    supportsAllDrives: true,
  })
}

/** Move pasta para a lixeira (pode ser restaurada em até 30 dias). */
async function moveFolderToTrash(folderId: string): Promise<void> {
  const drive = await getDrive()
  await drive.files.update({
    fileId: folderId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  })
}

/** Cria a pasta do membro e subpastas (CONTRATO, NOTA FISCAL). */
async function ensureMemberFolder(equipeFolderId: string, member: TeamMemberForDrive): Promise<string> {
  const folderName = memberFolderName(member)
  const memberFolderId = await getOrCreateFolder(equipeFolderId, folderName)
  for (const sub of EQUIPE_MEMBER_SUBFOLDERS) {
    await getOrCreatePath(memberFolderId, sub)
  }
  return memberFolderId
}

/**
 * Sincroniza pastas de membros com o estado atual: cria, renomeia, exclui órfãs.
 * @param withSubfolders - se true, adiciona CONTRATO e NOTA FISCAL (EQUIPE); se false, apenas a pasta (CASTING).
 */
async function syncMemberFolders(
  parentFolderId: string,
  members: TeamMemberForDrive[],
  withSubfolders: boolean
): Promise<void> {
  const expectedNames = new Set(members.map((m) => memberFolderName(m)))
  const existing = await listFolderIdsByName(parentFolderId)
  const usedExistingIds = new Set<string>()

  for (const member of members) {
    const expectedName = memberFolderName(member)
    const existingId = existing.get(expectedName)
    if (existingId) {
      usedExistingIds.add(existingId)
      if (withSubfolders) {
        for (const sub of EQUIPE_MEMBER_SUBFOLDERS) {
          await getOrCreatePath(existingId, sub)
        }
      }
      continue
    }
    const parsedMember = { name: (member.name || '').trim().toLowerCase(), role: (member.role || '').trim() }
    let foundToRename: { folderId: string; currentName: string } | null = null
    for (const [currentName, folderId] of existing) {
      if (usedExistingIds.has(folderId)) continue
      const parsed = parseMemberFolderName(currentName)
      if ((parsed.name || '').trim().toLowerCase() === parsedMember.name) {
        foundToRename = { folderId, currentName }
        break
      }
    }
    if (foundToRename && foundToRename.currentName !== expectedName) {
      await updateFolderName(foundToRename.folderId, expectedName)
      usedExistingIds.add(foundToRename.folderId)
      if (withSubfolders) {
        for (const sub of EQUIPE_MEMBER_SUBFOLDERS) {
          await getOrCreatePath(foundToRename.folderId, sub)
        }
      }
    } else {
      const memberFolderId = await getOrCreateFolder(parentFolderId, expectedName)
      if (withSubfolders) {
        for (const sub of EQUIPE_MEMBER_SUBFOLDERS) {
          await getOrCreatePath(memberFolderId, sub)
        }
      }
    }
  }

  for (const [folderName, folderId] of existing) {
    if (usedExistingIds.has(folderId)) continue
    if (!expectedNames.has(folderName)) {
      await moveFolderToTrash(folderId)
    }
  }
}

async function syncEquipeFolders(equipeFolderId: string, teamMembers: TeamMemberForDrive[]): Promise<void> {
  await syncMemberFolders(equipeFolderId, teamMembers, true)
}

/** Sincroniza pastas de itens de custo (EQUIPAMENTOS, LOCAÇÕES, etc.): cria novas, move órfãs para lixeira. */
async function syncCostItemFolders(
  parentFolderId: string,
  items: TeamMemberForDrive[]
): Promise<void> {
  const expectedNames = new Set(items.map((m) => costItemFolderName(m)))
  const existing = await listFolderIdsByName(parentFolderId)
  for (const item of items) {
    const name = costItemFolderName(item)
    if (!existing.has(name)) {
      await getOrCreateFolder(parentFolderId, name)
    }
  }
  for (const [folderName, folderId] of existing) {
    if (!expectedNames.has(folderName)) {
      await moveFolderToTrash(folderId)
    }
  }
}

/** Nome da pasta raiz do projeto no Drive: "#JOB_ID - Nome do projeto - Cliente" (ex.: #BZ0018 - 20ª Corrida - Unimed). */
export function projectRootFolderName(jobId: string, projectName: string, clientName: string): string {
  const job = (jobId || '').trim() || 'Sem ID'
  const prefix = job.startsWith('#') ? job : `#${job}`
  const nome = (projectName || '').trim() || 'Sem nome'
  const cliente = (clientName || '').trim() || 'Sem cliente'
  return `${prefix} - ${nome} - ${cliente}`
}

export type SyncProjectResult = { rootId: string; recreated: boolean }

/**
 * Sincroniza a estrutura do projeto no Drive: cria raiz (se não existir), estrutura fixa e pastas da equipe.
 * Se a pasta raiz foi excluída no Drive, recria automaticamente.
 * - projectId: UUID do projeto (para atualizar drive_root_folder_id no banco).
 * - jobId: identificador legível (ex.: BZ0018) usado no nome da pasta (#BZ0018 - Nome - Cliente).
 */
export async function syncProjectToDrive(
  _projectId: string,
  jobId: string,
  projectName: string,
  clientName: string,
  teamMembers: TeamMemberForDrive[],
  castingMembers: TeamMemberForDrive[],
  costItemsByDepartment: Record<string, TeamMemberForDrive[]>,
  existingRootId: string | null
): Promise<SyncProjectResult> {
  const rootName = projectRootFolderName(jobId, projectName, clientName)
  let rootId: string
  let recreated = false

  const doFullSync = async (rId: string) => {
    const equipeId = await getEquipeFolderId(rId)
    await syncEquipeFolders(equipeId, teamMembers)
    const castingFolderId = await getOrCreatePath(rId, '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/CASTING')
    await syncMemberFolders(castingFolderId, castingMembers, true)
    const producaoBase = await getOrCreatePath(rId, '_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO')
    for (const [dept, items] of Object.entries(costItemsByDepartment)) {
      if (items.length === 0) continue
      const deptFolderId = await getOrCreateFolder(producaoBase, dept)
      await syncCostItemFolders(deptFolderId, items)
    }
  }

  if (existingRootId?.trim()) {
    try {
      rootId = existingRootId
      await doFullSync(rootId)
    } catch {
      rootId = await createProjectRootFolder(rootName)
      await createFixedStructure(rootId)
      await doFullSync(rootId)
      recreated = true
    }
  } else {
    rootId = await createProjectRootFolder(rootName)
    await createFixedStructure(rootId)
    await doFullSync(rootId)
  }

  return { rootId, recreated }
}

/** Faz upload de um arquivo para uma pasta. Retorna id e URL de visualização. */
export async function uploadFileToFolder(
  folderId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = await getDrive()
  const stream = Readable.from(buffer)
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: stream,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  const id = res.data.id
  const webViewLink = res.data.webViewLink
  if (!id) throw new Error('Drive API não retornou id do arquivo.')
  return {
    id,
    webViewLink: (webViewLink as string) || `https://drive.google.com/file/d/${id}/view`,
  }
}

/** Lista arquivos (não pastas) em uma pasta. Ordena por nome; PDFs primeiro. */
export async function listFilesInFolder(
  folderId: string
): Promise<{ id: string; name: string; webViewLink: string }[]> {
  const drive = await getDrive()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    pageSize: 100,
    orderBy: 'name',
    supportsAllDrives: true,
  })
  const files = (res.data.files ?? []).filter((f): f is { id: string; name: string; webViewLink?: string } => !!f.id && !!f.name)
  const withLinks = files.map((f) => ({
    id: f.id,
    name: f.name,
    webViewLink: (f.webViewLink as string) || `https://drive.google.com/file/d/${f.id}/view`,
  }))
  // PDFs primeiro
  return withLinks.sort((a, b) => {
    const aPdf = a.name.toLowerCase().endsWith('.pdf')
    const bPdf = b.name.toLowerCase().endsWith('.pdf')
    if (aPdf && !bPdf) return -1
    if (!aPdf && bPdf) return 1
    return a.name.localeCompare(b.name)
  })
}
