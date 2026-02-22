'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import PageLayout from '@/components/PageLayout'
import { resolve, cinema } from '@/lib/theme'
import {
  listCollaborators, createCollaborator, updateCollaborator, deleteCollaborator, importCollaborators,
  type Collaborator, type CollaboratorInsert,
} from '@/lib/services/collaborators'
import {
  listRoles, createRole, updateRole, deleteRole, importRoles, updateRolesOrder, isRoleSeparator,
  type RoleRate, type RoleRateInsert,
} from '@/lib/services/roles-rates'
import {
  listCacheTables, createCacheTable, updateCacheTable, deleteCacheTable, setDefaultCacheTable, duplicateCacheTable,
  type CacheTable, type CacheTableInsert,
} from '@/lib/services/cache-tables'
import { formatCurrency } from '@/lib/utils'
import { ROLES_DEPARTAMENTOS_ORDER } from '@/lib/constants'
import { APP_ICONS, GALLERY_ICONS } from '@/lib/icons-gallery'
import { getCompany, saveCompany, uploadCompanyLogo } from '@/lib/services/company'
import {
  listProjects, updateProject, deleteProject, setProjectMembers, getProjectMembers, getUserProjectIds, setUserProjects,
  type ProjectRecord,
} from '@/lib/services/projects'
import { addLog, listLogs, type ActivityLog } from '@/lib/services/activity-logs'
import { listProfiles, updateProfile, type Profile } from '@/lib/services/profiles'
import { PROFILE_LABELS, getRestrictedConfigTabs, type ProfileRole } from '@/lib/permissions'
import {
  setProfileRestrictions,
  NAV_PAGE_KEYS,
  NAV_PAGE_LABELS,
  HEADER_BUTTON_KEYS,
  HEADER_BUTTON_LABELS,
  CONFIG_TAB_KEYS,
  CONFIG_TAB_LABELS,
  FILME_BUTTON_KEYS,
  FILME_BUTTON_LABELS,
  type ProfileRestriction,
} from '@/lib/services/profile-restrictions'
import { supabase } from '@/lib/supabase'
import { X, Copy, Pencil, Save, Plus, RefreshCw, HardDrive } from 'lucide-react'

type ConfigTab = 'company' | 'drive' | 'users' | 'collaborators' | 'cache_tables' | 'roles' | 'projects' | 'icons' | 'logs'

const TABS: { id: ConfigTab; label: string }[] = [
  { id: 'company', label: 'MINHA PRODUTORA' },
  { id: 'drive', label: 'DRIVE' },
  { id: 'users', label: 'USUÁRIOS' },
  { id: 'collaborators', label: 'COLABORADORES' },
  { id: 'cache_tables', label: 'TABELAS DE CACHÊ' },
  { id: 'roles', label: 'FUNÇÕES E CACHÊS' },
  { id: 'projects', label: 'PROJETOS' },
  { id: 'icons', label: 'ÍCONES' },
  { id: 'logs', label: 'LOGS' },
]

const inputCls = 'w-full px-2 py-1.5 text-[11px] rounded border'
const inputStyle = { backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }
const labelCls = 'block text-[11px] uppercase mb-1'
const thCls = 'text-left text-[11px] uppercase pb-2 pr-3 whitespace-nowrap'
const tdCls = 'py-1.5 pr-3 text-[11px] border-b align-middle'
const btnSmall = 'h-7 px-3 text-[11px] font-medium uppercase rounded'

interface ConfigProjectSummary {
  id: string; job_id: string; nome: string; agencia: string; cliente: string; duracao: string; duracao_unit: string; updated_at: string
}

/* ── Helpers CSV ── */
function parseCsvValue(val: string): string {
  return val.replace(/^"(.*)"$/, '$1').trim()
}

function parseBrCurrency(val: string): number {
  if (!val || typeof val !== 'string') return 0
  // Remove espaços/BOM, R$ no início, normaliza vírgula decimal (Unicode → ASCII), formato BR: 1.234,56
  let clean = val.replace(/[\s\u00A0\uFEFF]/g, '').replace(/^R\$\s*/i, '')
  clean = clean.replace(/\u201A/g, ',') // vírgula Unicode em alguns CSVs
  const lastComma = clean.lastIndexOf(',')
  if (lastComma >= 0) {
    // Formato BR: ponto = milhar, vírgula = decimal → remove pontos à esquerda da vírgula, troca vírgula por ponto
    const before = clean.slice(0, lastComma).replace(/\./g, '')
    const after = clean.slice(lastComma + 1)
    clean = before + '.' + after
  }
  return parseFloat(clean) || 0
}

/** Qualquer aspa (reta, curva, fullwidth, etc.) para reconhecer início/fim de campo e não cortar na vírgula. */
const CSV_QUOTE_REGEX = /["\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB\u2039\u203A\uFF02\u275D\u275E]/

/** Separa colunas de uma linha CSV respeitando campos entre aspas. Valores como "R$1.153,14" não são cortados na vírgula. */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  const s = line.replace(/\r$/, '')
  let i = 0
  while (i < s.length) {
    if (CSV_QUOTE_REGEX.test(s[i])) {
      i++
      let field = ''
      while (i < s.length) {
        if (CSV_QUOTE_REGEX.test(s[i])) {
          i++
          if (i < s.length && CSV_QUOTE_REGEX.test(s[i])) {
            field += '"'
            i++
          } else break
        } else {
          field += s[i]
          i++
        }
      }
      result.push(field.trim())
      if (i < s.length && s[i] === ',') i++
    } else {
      let field = ''
      while (i < s.length && s[i] !== ',') {
        field += s[i]
        i++
      }
      result.push(field.trim())
      if (i < s.length) i++
    }
  }
  return result
}

/** Converte uma linha CSV para { funcao, cache_dia, cache_semana }. Formato: vírgula como separador; valores em Real BR (R$ 1.234,56). */
function parseCachesLine(line: string): { funcao: string; cache_dia: number; cache_semana: number } {
  const cols = parseCsvLine(line)
  return {
    funcao: (cols[0] ?? '').trim(),
    cache_dia: parseBrCurrency(cols[1] ?? '0'),
    cache_semana: parseBrCurrency(cols[2] ?? '0'),
  }
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface ViewConfigProps {
  onLogoChange?: (url: string) => void
  currentProfile?: Profile | null
  isAdmin?: boolean
  restrictions?: import('@/lib/services/profile-restrictions').ProfileRestriction[]
  onRefreshRestrictions?: () => Promise<void>
  onRecriarPastaDrive?: (projectId: string) => void | Promise<void>
  driveCallbackMessage?: { type: 'success' | 'error'; msg: string } | null
  onDismissDriveMessage?: () => void
}

export default function ViewConfig({
  onLogoChange,
  currentProfile,
  isAdmin,
  restrictions = [],
  onRefreshRestrictions,
  onRecriarPastaDrive,
  driveCallbackMessage,
  onDismissDriveMessage,
}: ViewConfigProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('company')
  const [iconsSearch, setIconsSearch] = useState('')
  const restrictedConfigTabs = getRestrictedConfigTabs(currentProfile?.role, restrictions)
  const visibleTabs = TABS.filter((t) => !restrictedConfigTabs.includes(t.id))

  /* ── Dados da produtora ── */
  const [companyName, setCompanyName] = useState('')
  const [companyFantasy, setCompanyFantasy] = useState('')
  const [companyCnpj, setCompanyCnpj] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companySite, setCompanySite] = useState('')
  const [companyAddr, setCompanyAddr] = useState('')
  const [companySaving, setCompanySaving] = useState(false)
  const [companyLoaded, setCompanyLoaded] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoFileRef = useRef<HTMLInputElement>(null)

  /* ── Usuários (login) ── */
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [userModal, setUserModal] = useState<null | 'new' | Profile>(null)
  const [uName, setUName] = useState('')
  const [uSurname, setUSurname] = useState('')
  const [uEmail, setUEmail] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uRole, setURole] = useState<ProfileRole>('produtor_executivo')
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')
  const [userProjectIds, setUserProjectIds] = useState<Set<string>>(new Set())
  const [userProjectsLoading, setUserProjectsLoading] = useState(false)
  const [userModalProjectsList, setUserModalProjectsList] = useState<ConfigProjectSummary[]>([])

  /* ── Restrições de perfis ── */
  const [restrictionsEdit, setRestrictionsEdit] = useState<ProfileRestriction[]>([])
  const [restrictionsSaving, setRestrictionsSaving] = useState(false)
  const PROFILE_ROLES: ProfileRole[] = ['admin', 'atendimento', 'produtor_executivo', 'crew', 'assistente_direcao', 'convidado']

  useEffect(() => {
    if (activeTab === 'users' && Array.isArray(restrictions)) {
      setRestrictionsEdit(restrictions)
    }
  }, [activeTab, restrictions])

  const isRestrictionChecked = (role: string, type: ProfileRestriction['restriction_type'], key: string) =>
    restrictionsEdit.some((r) => r.role === role && r.restriction_type === type && r.restriction_key === key)

  const toggleRestriction = (role: string, type: ProfileRestriction['restriction_type'], key: string) => {
    const checked = isRestrictionChecked(role, type, key)
    setRestrictionsEdit((prev) =>
      checked ? prev.filter((r) => !(r.role === role && r.restriction_type === type && r.restriction_key === key)) : [...prev, { role, restriction_type: type, restriction_key: key }]
    )
  }

  const saveRestrictions = async () => {
    setRestrictionsSaving(true)
    const res = await setProfileRestrictions(restrictionsEdit)
    setRestrictionsSaving(false)
    if (res.ok) {
      await onRefreshRestrictions?.()
      if (typeof window !== 'undefined') window.alert('Restrições salvas!')
    } else if (typeof window !== 'undefined') window.alert(res.error || 'Erro ao salvar.')
  }

  /* ── Google Drive (OAuth) ── */
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; email?: string; rootFolderId?: string | null } | null>(null)
  const [driveRootFolderIdInput, setDriveRootFolderIdInput] = useState('')
  const [driveSavingFolder, setDriveSavingFolder] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveConnecting, setDriveConnecting] = useState(false)
  const [driveDisconnecting, setDriveDisconnecting] = useState(false)

  useEffect(() => {
    if (restrictedConfigTabs.includes(activeTab)) {
      const firstVisible = visibleTabs[0]?.id ?? 'company'
      setActiveTab(firstVisible)
    }
  }, [restrictedConfigTabs, activeTab, visibleTabs])

  useEffect(() => {
    if (activeTab === 'users') {
      setProfilesLoading(true)
      listProfiles().then((list) => {
        setProfiles(list)
        setProfilesLoading(false)
      })
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'drive') {
      setDriveLoading(false)
      return
    }
    if (!isAdmin) {
      setDriveLoading(false)
      setDriveStatus({ connected: false })
      return
    }
    setDriveLoading(true)
    const timeout = setTimeout(() => setDriveLoading(false), 8000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token
      return fetch('/api/drive/connection', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    }).then((r) => r.json().catch(() => ({}))).then((data) => {
      const status = { connected: !!data?.connected, email: data?.email, rootFolderId: data?.rootFolderId }
      setDriveStatus(status)
      setDriveRootFolderIdInput(data?.rootFolderId ?? '')
    }).catch(() => {
      setDriveStatus({ connected: false })
    }).finally(() => {
      clearTimeout(timeout)
      setDriveLoading(false)
    })
  }, [activeTab, isAdmin])

  const openUserModal = async (p: null | 'new' | Profile) => {
    if (p && p !== 'new' && !isAdmin && currentProfile && p.id !== currentProfile.id) return
    setUserModal(p)
    setUserError('')
    if (p === 'new') {
      setUName(''); setUSurname(''); setUEmail(''); setUPassword(''); setURole('produtor_executivo')
      setUserProjectIds(new Set())
    } else if (p) {
      setUName(p.name); setUSurname(p.surname); setUEmail(p.email); setUPassword(''); setURole((String(p.role) === 'producer' ? 'produtor_executivo' : p.role) as ProfileRole)
      setUserProjectsLoading(true)
      const [projList, ids] = await Promise.all([listProjects(), getUserProjectIds(p.id)])
      setUserModalProjectsList(projList as ConfigProjectSummary[])
      setUserProjectIds(new Set(ids))
      setUserProjectsLoading(false)
    }
  }

  const toggleUserProject = (projectId: string) => {
    if (!userModal || userModal === 'new') return
    setUserProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const MAX_ADMINS = 3

  const saveUser = async () => {
    if (!currentProfile) return
    setUserError('')
    setUserSaving(true)
    try {
      if (userModal === 'new') {
        if (!uEmail.trim() || !uPassword.trim()) {
          setUserError('E-mail e senha são obrigatórios.')
          return
        }
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const res = await fetch('/api/auth/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
          body: JSON.stringify({ name: uName.trim(), surname: uSurname.trim(), email: uEmail.trim(), password: uPassword, role: uRole }),
        })
        const data = await res.json()
        if (!res.ok) {
          setUserError(data.error || 'Falha ao criar usuário.')
          return
        }
        await addLog({ action: 'create', entityType: 'profile', entityName: `${uName.trim()} ${uSurname.trim()}`.trim() || uEmail.trim() })
        const list = await listProfiles()
        setProfiles(list)
        setUserModal(null)
      } else if (userModal && userModal.id) {
        if (isAdmin && uRole === 'admin' && userModal.role !== 'admin') {
          const adminCount = profiles.filter((p) => p.role === 'admin').length
          if (adminCount >= MAX_ADMINS) {
            setUserError('Máximo de 3 administradores permitidos.')
            return
          }
        }
        const res = await updateProfile(userModal.id, { name: uName.trim(), surname: uSurname.trim(), email: uEmail.trim(), ...(isAdmin && { role: uRole }) })
        if (!res.ok) {
          setUserError(res.error || 'Falha ao salvar.')
          return
        }
        if (userModal.id === currentProfile.id && uPassword.trim()) {
          const { error } = await supabase.auth.updateUser({ password: uPassword })
          if (error) {
            setUserError(error.message)
            return
          }
        }
        const projRes = await setUserProjects(userModal.id, Array.from(userProjectIds))
        if (!projRes.ok) {
          setUserError(projRes.error || 'Falha ao salvar projetos.')
          return
        }
        await addLog({ action: 'update', entityType: 'profile', entityId: userModal.id, entityName: `${uName.trim()} ${uSurname.trim()}`.trim() || userModal.email })
        const list = await listProfiles()
        setProfiles(list)
        setUserModal(null)
      }
    } finally {
      setUserSaving(false)
    }
  }

  // Carregar dados da produtora ao selecionar a aba
  useEffect(() => {
    if (activeTab === 'company' && !companyLoaded) {
      getCompany().then((data) => {
        if (data) {
          setCompanyName(data.razao_social)
          setCompanyFantasy(data.nome_fantasia)
          setCompanyCnpj(data.cnpj)
          setCompanyPhone(data.telefone)
          setCompanyEmail(data.email)
          setCompanySite(data.site)
          setCompanyAddr(data.endereco)
          if (data.logo_url) setLogoPreview(data.logo_url)
        }
        setCompanyLoaded(true)
      })
    }
  }, [activeTab, companyLoaded])

  const handleLogoUpload = async (file: File) => {
    // Validar: aceitar apenas imagens
    if (!file.type.startsWith('image/')) {
      if (typeof window !== 'undefined') window.alert('Selecione um arquivo de imagem (PNG, JPG, etc.)')
      return
    }
    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      if (typeof window !== 'undefined') window.alert('A imagem deve ter no máximo 2MB.')
      return
    }

    setLogoUploading(true)
    const url = await uploadCompanyLogo(file)
    setLogoUploading(false)

    if (url) {
      await addLog({ action: 'upload', entityType: 'logo', entityName: 'Logo da empresa' })
      setLogoPreview(url)
      onLogoChange?.(url)
      if (typeof window !== 'undefined') window.alert('Logo atualizada com sucesso!')
    } else {
      if (typeof window !== 'undefined') window.alert('Erro ao fazer upload. Verifique o console.')
    }
  }

  const handleSaveCompany = async () => {
    setCompanySaving(true)
    const result = await saveCompany({
      razao_social: companyName,
      nome_fantasia: companyFantasy,
      cnpj: companyCnpj,
      telefone: companyPhone,
      email: companyEmail,
      site: companySite,
      endereco: companyAddr,
    })
    setCompanySaving(false)
    if (result) {
      await addLog({ action: 'update', entityType: 'company', entityName: companyFantasy || companyName || 'Produtora' })
      if (typeof window !== 'undefined') window.alert('Dados da produtora salvos com sucesso!')
    } else {
      if (typeof window !== 'undefined') window.alert('Erro ao salvar. Verifique o console.')
    }
  }

  /* ═══════════════════════════════════════════════════════
   * COLABORADORES
   * ═══════════════════════════════════════════════════════ */
  const [collabs, setCollabs] = useState<Collaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(false)
  const [collabModal, setCollabModal] = useState<Collaborator | 'new' | null>(null)
  const [collabSearch, setCollabSearch] = useState('')
  const collabFileRef = useRef<HTMLInputElement>(null)

  // Form fields para modal
  const [fNome, setFNome] = useState('')
  const [fCpf, setFCpf] = useState('')
  const [fRg, setFRg] = useState('')
  const [fTel, setFTel] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [fMei, setFMei] = useState('')
  const [fCnpj, setFCnpj] = useState('')
  const [fPix, setFPix] = useState('')
  const [fBanco, setFBanco] = useState('')
  const [fAgencia, setFAgencia] = useState('')
  const [fConta, setFConta] = useState('')

  const loadCollabs = useCallback(async () => {
    setCollabLoading(true)
    const data = await listCollaborators()
    setCollabs(data)
    setCollabLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'collaborators') loadCollabs()
  }, [activeTab, loadCollabs])

  const openCollabModal = (collab: Collaborator | 'new') => {
    if (collab === 'new') {
      setFNome(''); setFCpf(''); setFRg(''); setFTel(''); setFEmail(''); setFEnd(''); setFMei(''); setFCnpj(''); setFPix(''); setFBanco(''); setFAgencia(''); setFConta('')
    } else {
      setFNome(collab.nome); setFCpf(collab.cpf); setFRg(collab.rg); setFTel(collab.telefone); setFEmail(collab.email); setFEnd(collab.endereco); setFMei(collab.mei); setFCnpj(collab.cnpj); setFPix(collab.pix); setFBanco(collab.banco); setFAgencia(collab.agencia); setFConta(collab.conta)
    }
    setCollabModal(collab)
  }

  const saveCollab = async () => {
    if (!fNome.trim()) return
    const data: CollaboratorInsert = { nome: fNome.trim(), cpf: fCpf, rg: fRg, telefone: fTel, email: fEmail, endereco: fEnd, mei: fMei, cnpj: fCnpj, pix: fPix, banco: fBanco, agencia: fAgencia, conta: fConta }
    if (collabModal === 'new') {
      const created = await createCollaborator(data)
      if (created) await addLog({ action: 'create', entityType: 'collaborator', entityId: created.id, entityName: created.nome })
    } else if (collabModal) {
      await updateCollaborator(collabModal.id, data)
      await addLog({ action: 'update', entityType: 'collaborator', entityId: collabModal.id, entityName: data.nome })
    }
    setCollabModal(null)
    loadCollabs()
  }

  const removeCollab = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remover este colaborador?')) return
    const c = collabs.find((x) => x.id === id)
    await deleteCollaborator(id)
    if (c) await addLog({ action: 'delete', entityType: 'collaborator', entityId: id, entityName: c.nome })
    loadCollabs()
  }

  const exportCollabsCsv = () => {
    const header = 'Nome,CPF,RG,Telefone,E-mail,Endereço,MEI,CNPJ,PIX,Banco,Agência,Conta'
    const rows = collabs.map((c) =>
      [c.nome, c.cpf, c.rg, c.telefone, c.email, `"${c.endereco}"`, c.mei, c.cnpj, c.pix, c.banco, c.agencia, c.conta].join(',')
    )
    downloadCsv('colaboradores.csv', [header, ...rows].join('\n'))
  }

  const importCollabsCsv = async (file: File) => {
    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return
    const rows: CollaboratorInsert[] = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line)
      return {
        nome: cols[0] || '', cpf: cols[1] || '', rg: cols[2] || '', telefone: cols[3] || '',
        email: cols[4] || '', endereco: cols[5] || '', mei: cols[6] || '', cnpj: cols[7] || '',
        pix: cols[8] || '', banco: cols[9] || '', agencia: cols[10] || '', conta: cols[11] || '',
      }
    }).filter((r) => r.nome)
    const count = await importCollaborators(rows)
    if (count > 0) await addLog({ action: 'import', entityType: 'collaborator', entityName: `Importação`, details: { count } })
    if (typeof window !== 'undefined') window.alert(`${count} colaborador(es) importado(s)!`)
    loadCollabs()
  }

  const filteredCollabs = collabSearch
    ? collabs.filter((c) => c.nome.toLowerCase().includes(collabSearch.toLowerCase()))
    : collabs

  /* ═══════════════════════════════════════════════════════
   * TABELAS DE CACHÊ
   * ═══════════════════════════════════════════════════════ */
  const [cacheTables, setCacheTables] = useState<CacheTable[]>([])
  const [cacheTablesLoading, setCacheTablesLoading] = useState(false)
  const [cacheTableModal, setCacheTableModal] = useState<CacheTable | 'new' | null>(null)
  const importTargetTableIdRef = useRef<string | null>(null)
  const [ctName, setCtName] = useState('')
  const [ctDescription, setCtDescription] = useState('')
  const [ctSource, setCtSource] = useState('')
  const cacheTableFileRef = useRef<HTMLInputElement>(null)

  const loadCacheTables = useCallback(async () => {
    setCacheTablesLoading(true)
    const data = await listCacheTables()
    setCacheTables(data)
    setCacheTablesLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'cache_tables') loadCacheTables()
  }, [activeTab, loadCacheTables])

  const openCacheTableModal = (t: CacheTable | 'new') => {
    if (t === 'new') {
      setCtName(''); setCtDescription(''); setCtSource('')
    } else {
      setCtName(t.name); setCtDescription(t.description || ''); setCtSource(t.source || '')
    }
    setCacheTableModal(t)
  }

  const saveCacheTable = async () => {
    if (!ctName.trim()) return
    if (cacheTableModal === 'new') {
      const created = await createCacheTable({ name: ctName.trim(), description: ctDescription.trim(), source: ctSource.trim(), is_default: cacheTables.length === 0 })
      if (created) {
        await addLog({ action: 'create', entityType: 'cache_table', entityId: created.id, entityName: created.name })
        setCacheTableModal(null)
        loadCacheTables()
        if (typeof window !== 'undefined') window.alert('Tabela criada! Use "Importar CSV" na tabela para adicionar funções.')
      }
    } else if (cacheTableModal) {
      await updateCacheTable(cacheTableModal.id, { name: ctName.trim(), description: ctDescription.trim(), source: ctSource.trim() })
      await addLog({ action: 'update', entityType: 'cache_table', entityId: cacheTableModal.id, entityName: ctName.trim() })
      setCacheTableModal(null)
      loadCacheTables()
    }
  }

  const importCacheTableCsv = async (file: File, tableId: string) => {
    let text = await file.text()
    text = text.replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    const rows: RoleRateInsert[] = lines.slice(1).map((line) => parseCachesLine(line)).filter((r) => r.funcao)
    const count = await importRoles(rows, tableId)
    if (count > 0) {
      const tbl = cacheTables.find((t) => t.id === tableId)
      await addLog({ action: 'import', entityType: 'role', entityName: tbl?.name ?? 'Tabela de cachê', details: { count, tableId } })
    }
    if (typeof window !== 'undefined') window.alert(`${count} função(ões) importada(s)!`)
    loadCacheTables()
  }

  const removeCacheTable = async (id: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Excluir a tabela "${name}" e todas as suas funções? Esta ação não pode ser desfeita.`)) return
    await deleteCacheTable(id)
    await addLog({ action: 'delete', entityType: 'cache_table', entityId: id, entityName: name })
    loadCacheTables()
  }

  const handleDuplicateCacheTable = async (t: CacheTable) => {
    const created = await duplicateCacheTable(t.id)
    if (created) {
      await addLog({ action: 'create', entityType: 'cache_table', entityId: created.id, entityName: created.name, details: { duplicatedFrom: t.name } })
      loadCacheTables()
      if (typeof window !== 'undefined') window.alert(`Tabela "${t.name}" duplicada como "${created.name}".`)
    }
  }

  /* ═══════════════════════════════════════════════════════
   * FUNÇÕES E CACHÊS (por tabela selecionada)
   * ═══════════════════════════════════════════════════════ */
  const [roles, setRoles] = useState<RoleRate[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [selectedCacheTableId, setSelectedCacheTableId] = useState<string | null>(null)
  const [roleModal, setRoleModal] = useState<RoleRate | 'new' | null>(null)
  const [rolesSearch, setRolesSearch] = useState('')
  const rolesFileRef = useRef<HTMLInputElement>(null)

  const [rFuncao, setRFuncao] = useState('')
  const [rDia, setRDia] = useState('')
  const [rSemana, setRSemana] = useState('')
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [draggedRoleId, setDraggedRoleId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    setRolesLoading(true)
    const data = await listRoles(selectedCacheTableId)
    setRoles(data)
    setRolesLoading(false)
  }, [selectedCacheTableId])

  useEffect(() => {
    if (activeTab === 'roles' || activeTab === 'cache_tables') loadCacheTables()
  }, [activeTab, loadCacheTables])

  useEffect(() => {
    if (activeTab === 'roles' && cacheTables.length > 0 && !selectedCacheTableId) {
      const defaultTable = cacheTables.find((t) => t.is_default) ?? cacheTables[0]
      setSelectedCacheTableId(defaultTable.id)
    }
  }, [activeTab, cacheTables, selectedCacheTableId])

  useEffect(() => {
    if (activeTab === 'roles' && selectedCacheTableId) loadRoles()
  }, [activeTab, selectedCacheTableId, loadRoles])

  const openRoleModal = (role: RoleRate | 'new') => {
    if (role === 'new') {
      setRFuncao(''); setRDia(''); setRSemana('')
    } else {
      setRFuncao(role.funcao)
      setRDia(String(role.cache_dia))
      setRSemana(String(role.cache_semana))
    }
    setRoleModal(role)
  }

  const saveRole = async () => {
    if (!rFuncao.trim()) return
    const base = { funcao: rFuncao.trim(), cache_dia: parseFloat(rDia) || 0, cache_semana: parseFloat(rSemana) || 0 }
    if (roleModal === 'new') {
      if (!selectedCacheTableId) {
        if (typeof window !== 'undefined') window.alert('Selecione uma tabela de cachê primeiro.')
        return
      }
      const created = await createRole({ ...base, table_id: selectedCacheTableId })
      if (created) await addLog({ action: 'create', entityType: 'role', entityId: created.id, entityName: created.funcao })
    } else if (roleModal) {
      await updateRole(roleModal.id, base)
      await addLog({ action: 'update', entityType: 'role', entityId: roleModal.id, entityName: base.funcao })
    }
    setRoleModal(null)
    loadRoles()
  }

  const removeRole = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remover esta função?')) return
    const r = roles.find((x) => x.id === id)
    await deleteRole(id)
    if (r) await addLog({ action: 'delete', entityType: 'role', entityId: id, entityName: r.funcao })
    loadRoles()
  }

  const duplicateRole = async (r: RoleRate) => {
    const tableId = selectedCacheTableId ?? r.table_id
    if (!tableId) {
      if (typeof window !== 'undefined') window.alert('Selecione uma tabela de cachê.')
      return
    }
    const created = await createRole({
      funcao: r.funcao,
      cache_dia: Number(r.cache_dia),
      cache_semana: Number(r.cache_semana),
      table_id: tableId,
    })
    if (created) loadRoles()
  }

  const insertSeparator = async (dept: string) => {
    if (!selectedCacheTableId) {
      if (typeof window !== 'undefined') window.alert('Selecione uma tabela de cachê primeiro.')
      return
    }
    const created = await createRole({
      funcao: `--- ${dept} ---`,
      cache_dia: 0,
      cache_semana: 0,
      table_id: selectedCacheTableId,
    })
    if (created) {
      const currentIds = roles.map((r) => r.id)
      await updateRolesOrder([created.id, ...currentIds])
      loadRoles()
    }
  }

  const orderedRoleIds = roles.map((r) => r.id)

  const handleRoleDragStart = (e: React.DragEvent, roleId: string) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', roleId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedRoleId(roleId)
  }

  const handleRoleDragEnd = () => {
    setDraggedRoleId(null)
    setDropTargetId(null)
  }

  const handleRoleDragOver = (e: React.DragEvent, targetRoleId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedRoleId && draggedRoleId !== targetRoleId) setDropTargetId(targetRoleId)
  }

  const handleRoleDragLeave = () => {
    setDropTargetId(null)
  }

  const handleRoleDrop = async (e: React.DragEvent, targetRoleId: string) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === targetRoleId) {
      setDraggedRoleId(null)
      setDropTargetId(null)
      return
    }
    const newOrder = orderedRoleIds.filter((id) => id !== draggedId)
    const insertIdx = newOrder.indexOf(targetRoleId)
    if (insertIdx === -1) {
      setDraggedRoleId(null)
      setDropTargetId(null)
      return
    }
    newOrder.splice(insertIdx, 0, draggedId)

    const previousRoles = roles
    const reordered: RoleRate[] = newOrder.map((id) => previousRoles.find((r) => r.id === id)).filter((r): r is RoleRate => r != null)
    setRoles(reordered)
    setDraggedRoleId(null)
    setDropTargetId(null)

    try {
      await updateRolesOrder(newOrder)
    } catch {
      setRoles(previousRoles)
      if (typeof window !== 'undefined') window.alert('Não foi possível salvar a ordem. Tente novamente.')
    }
  }

  const exportRolesCsv = () => {
    const header = 'Função,Cachê (Dia),Cachê (Semana)'
    const rows = roles.map((r) => `${r.funcao},"R$${Number(r.cache_dia).toFixed(2).replace('.', ',')}","R$${Number(r.cache_semana).toFixed(2).replace('.', ',')}"`)
    downloadCsv('funcoes_caches.csv', [header, ...rows].join('\n'))
  }

  const importRolesCsv = async (file: File) => {
    if (!selectedCacheTableId) {
      if (typeof window !== 'undefined') window.alert('Selecione uma tabela de cachê primeiro.')
      return
    }
    let text = await file.text()
    text = text.replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    const rows: RoleRateInsert[] = lines.slice(1).map((line) => parseCachesLine(line)).filter((r) => r.funcao)
    const count = await importRoles(rows, selectedCacheTableId)
    if (count > 0) await addLog({ action: 'import', entityType: 'role', entityName: 'Importação de funções', details: { count, tableId: selectedCacheTableId } })
    if (typeof window !== 'undefined') window.alert(`${count} função(ões) importada(s)!`)
    loadRoles()
  }

  const filteredRoles = rolesSearch
    ? roles.filter((r) => r.funcao.toLowerCase().includes(rolesSearch.toLowerCase()))
    : roles

  /** Agrupa por linhas separadoras: funcao "--- DEPARTAMENTO ---" inicia nova seção. Ordem preservada (created_at). */
  type Section = { name: string; separatorId: string | null; rows: RoleRate[] }
  const sections: Section[] = []
  let current: Section = { name: 'Outros', separatorId: null, rows: [] }
  for (const r of filteredRoles) {
    if (isRoleSeparator(r)) {
      sections.push(current)
      const name = r.funcao.replace(/^---\s*|\s*---$/g, '').trim() || 'Departamento'
      current = { name, separatorId: r.id, rows: [] }
    } else {
      current.rows.push(r)
    }
  }
  sections.push(current)
  const sectionsToRender = sections.filter((s) => s.rows.length > 0 || s.separatorId != null)

  /* ═══════════════════════════════════════════════════════
   * PROJETOS
   * ═══════════════════════════════════════════════════════ */
  const [projects, setProjects] = useState<ConfigProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectModal, setProjectModal] = useState<ConfigProjectSummary | null>(null)
  const [recriarPastaProjectId, setRecriarPastaProjectId] = useState<string | null>(null)

  // Form fields para edição de projeto
  const [pNome, setPNome] = useState('')
  const [pAgencia, setPAgencia] = useState('')
  const [pCliente, setPCliente] = useState('')
  const [pDuracao, setPDuracao] = useState('')
  const [pDuracaoUnit, setPDuracaoUnit] = useState<'segundos' | 'minutos'>('segundos')
  const [pMemberIds, setPMemberIds] = useState<Set<string>>(new Set())
  const [pMembersLoading, setPMembersLoading] = useState(false)
  const [projectModalProfiles, setProjectModalProfiles] = useState<Profile[]>([])
  const projectModalLoadingForRef = useRef<string | null>(null)

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    const data = await listProjects()
    setProjects(data as ConfigProjectSummary[])
    setProjectsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'projects') loadProjects()
  }, [activeTab, loadProjects])

  const openProjectModal = async (proj: ConfigProjectSummary) => {
    projectModalLoadingForRef.current = proj.id
    setPNome(proj.nome)
    setPAgencia(proj.agencia)
    setPCliente(proj.cliente)
    setPDuracao(proj.duracao || '')
    setPDuracaoUnit((proj.duracao_unit as 'segundos' | 'minutos') || 'segundos')
    setProjectModal(proj)
    setPMemberIds(new Set())
    setPMembersLoading(true)
    try {
      const [profList, ids] = await Promise.all([listProfiles(), getProjectMembers(proj.id)])
      if (projectModalLoadingForRef.current !== proj.id) return
      setProjectModalProfiles(profList)
      setPMemberIds(new Set(ids))
    } finally {
      if (projectModalLoadingForRef.current === proj.id) {
        projectModalLoadingForRef.current = null
      }
      setPMembersLoading(false)
    }
  }

  const toggleProjectMember = (id: string) => {
    setPMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveProjectEdit = async () => {
    if (!projectModal || !pNome.trim()) return
    await updateProject(projectModal.id, {
      nome: pNome.trim(),
      agencia: pAgencia.trim(),
      cliente: pCliente.trim(),
      duracao: pDuracao.trim(),
      duracao_unit: pDuracaoUnit,
    })
    const memRes = await setProjectMembers(projectModal.id, Array.from(pMemberIds))
    if (!memRes.ok) {
      if (typeof window !== 'undefined') window.alert(memRes.error || 'Erro ao salvar membros.')
      return
    }
    await addLog({ action: 'update', entityType: 'project', entityId: projectModal.id, entityName: pNome.trim(), details: { job_id: projectModal.job_id } })
    setProjectModal(null)
    loadProjects()
    fetch('/api/drive/sync-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectModal.id }),
    }).catch(() => {})
    if (typeof window !== 'undefined') window.alert('Projeto atualizado!')
  }

  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const removeProject = (id: string, nome: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Excluir o projeto "${nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingProjectId(id)
    void (async () => {
      try {
        await deleteProject(id)
        await addLog({ action: 'delete', entityType: 'project', entityId: id, entityName: nome })
        loadProjects()
      } finally {
        setDeletingProjectId(null)
      }
    })()
  }

  const filteredProjects = projectSearch
    ? projects.filter((p) =>
        p.nome.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.agencia.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.cliente.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects

  /* ═══════════════════════════════════════════════════════
   * LOGS
   * ═══════════════════════════════════════════════════════ */
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFilter, setLogsFilter] = useState<string>('')

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const data = await listLogs({ limit: 200 })
    setLogs(data)
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'logs') loadLogs()
  }, [activeTab, loadLogs])

  const filteredLogs = logsFilter
    ? logs.filter(
        (l) =>
          (l.entity_type?.toLowerCase() ?? '').includes(logsFilter.toLowerCase()) ||
          (l.action?.toLowerCase() ?? '').includes(logsFilter.toLowerCase()) ||
          (l.entity_name?.toLowerCase() ?? '').includes(logsFilter.toLowerCase()) ||
          (l.user_name?.toLowerCase() ?? '').includes(logsFilter.toLowerCase())
      )
    : logs

  const formatActionLabel = (action: string) => {
    const map: Record<string, string> = { create: 'Criou', update: 'Atualizou', delete: 'Excluiu', open: 'Abrir', save: 'Salvou', copy: 'Copiou', upload: 'Enviou', import: 'Importou' }
    return map[action] ?? action
  }
  const formatEntityLabel = (entityType: string) => {
    const map: Record<string, string> = { project: 'Projeto', company: 'Produtora', collaborator: 'Colaborador', role: 'Função', cache_table: 'Tabela de cachê', profile: 'Usuário', logo: 'Logo' }
    return map[entityType] ?? entityType
  }

  const formatLogDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  /* ═══════════════════════════════════════════════════════ */

  return (
    <PageLayout title="Configurações" contentLayout="single">
      {/* ── Abas ── */}
      <div className="flex flex-wrap gap-1.5 mb-4 rounded border p-2" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="btn-resolve-hover px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded transition-colors"
              style={{
                backgroundColor: active ? resolve.yellowDark : 'transparent',
                border: `1px solid ${active ? resolve.yellow : 'transparent'}`,
                color: active ? resolve.bg : resolve.muted,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = resolve.yellow
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = resolve.muted
                }
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ═══ MINHA PRODUTORA ═══ */}
      {activeTab === 'company' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>DADOS DA PRODUTORA</span>
            <button type="button" className={`${btnSmall} btn-resolve-hover flex items-center justify-center gap-1.5`} style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }} onClick={handleSaveCompany} disabled={companySaving} title={companySaving ? 'Salvando...' : 'Salvar'} aria-label={companySaving ? 'Salvando...' : 'Salvar'}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{companySaving ? '...' : ''}</button>
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            {/* Logo upload */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded flex items-center justify-center flex-shrink-0 overflow-hidden border"
                style={{ backgroundColor: resolve.bg, borderColor: resolve.border }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-lg" style={{ color: resolve.muted }}>CB</span>
                )}
              </div>
              <div className="flex-1">
                <label className={labelCls} style={{ color: resolve.muted }}>Logo da Empresa</label>
                <p className="text-[11px] mb-2" style={{ color: resolve.muted }}>Imagem quadrada (PNG ou JPG, máx 2MB). Será exibida no Header.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`${btnSmall} btn-resolve-hover transition-colors`}
                    style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }}
                    onClick={() => logoFileRef.current?.click()}
                    disabled={logoUploading}
                    onMouseEnter={(e) => { if (!logoUploading) { e.currentTarget.style.borderColor = resolve.yellow; e.currentTarget.style.color = resolve.yellow } }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = resolve.border; e.currentTarget.style.color = resolve.muted }}
                  >
                    {logoUploading ? 'Enviando...' : 'Escolher imagem'}
                  </button>
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); e.target.value = '' }}
                  />
                  {logoPreview && (
                    <button
                      type="button"
                      className={`${btnSmall} transition-colors`}
                      style={{ backgroundColor: 'transparent', color: cinema.danger, border: `1px solid ${resolve.border}` }}
                      onClick={async () => {
                        await saveCompany({ logo_url: '' })
                        await addLog({ action: 'delete', entityType: 'logo', entityName: 'Logo da empresa' })
                        setLogoPreview('')
                        onLogoChange?.('')
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = cinema.danger; e.currentTarget.style.backgroundColor = 'rgba(201, 74, 74, 0.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = resolve.border; e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <X size={14} strokeWidth={2} style={{ color: 'currentColor' }} className="inline-block mr-1" />Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="border-b" style={{ borderColor: resolve.border }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls} style={{ color: resolve.muted }}>Razão Social</label><input type="text" className={inputCls} style={inputStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Nome Fantasia</label><input type="text" className={inputCls} style={inputStyle} value={companyFantasy} onChange={(e) => setCompanyFantasy(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><label className={labelCls} style={{ color: resolve.muted }}>CNPJ</label><input type="text" className={inputCls} style={inputStyle} value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Telefone</label><input type="text" className={inputCls} style={inputStyle} value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>E-mail</label><input type="text" className={inputCls} style={inputStyle} value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Site</label><input type="text" className={inputCls} style={inputStyle} value={companySite} onChange={(e) => setCompanySite(e.target.value)} /></div>
            </div>
            <div><label className={labelCls} style={{ color: resolve.muted }}>Endereço Completo</label><input type="text" className={inputCls} style={inputStyle} value={companyAddr} onChange={(e) => setCompanyAddr(e.target.value)} /></div>
          </div>
        </div>
      )}

      {/* ═══ GOOGLE DRIVE ═══ */}
      {activeTab === 'drive' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <HardDrive size={14} strokeWidth={2} style={{ color: 'currentColor' }} />
            <span>GOOGLE DRIVE</span>
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            {driveCallbackMessage && (
              <div
                className="p-3 rounded text-[11px] flex items-center justify-between gap-2"
                style={{
                  backgroundColor: driveCallbackMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(201, 74, 74, 0.15)',
                  border: `1px solid ${driveCallbackMessage.type === 'success' ? 'rgb(34, 197, 94)' : cinema.danger}`,
                }}
              >
                <span>{driveCallbackMessage.msg}</span>
                {onDismissDriveMessage && (
                  <button type="button" onClick={onDismissDriveMessage} className="text-[10px] uppercase font-medium opacity-70 hover:opacity-100">
                    Fechar
                  </button>
                )}
              </div>
            )}
            <p className="text-[11px]" style={{ color: resolve.muted }}>
              Conecte sua conta Google para criar pastas e enviar arquivos (notas fiscais, contratos) no Drive. Defina a pasta onde os projetos serão salvos (crie uma pasta no Drive, abra-a e copie o ID da URL).
            </p>
            {!isAdmin ? (
              <p className="text-[11px]" style={{ color: resolve.muted }}>Apenas administradores podem conectar o Drive.</p>
            ) : driveLoading ? (
              <p className="text-[11px]" style={{ color: resolve.muted }}>Verificando…</p>
            ) : driveStatus?.connected ? (
              <div className="space-y-3">
                <p className="text-[11px] font-medium" style={{ color: resolve.text }}>
                  Conectado como: {driveStatus.email || 'Conta Google'}
                </p>
                <div>
                  <label className={labelCls} style={{ color: resolve.muted }}>ID da pasta raiz (onde os projetos serão salvos)</label>
                  <p className="text-[10px] mb-1" style={{ color: resolve.muted }}>Abra a pasta no Drive, copie o ID da URL: drive.google.com/.../folders/<strong>ESTE_ID</strong></p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={inputCls}
                      style={inputStyle}
                      placeholder="Ex.: 1ABC123xyz..."
                      value={driveRootFolderIdInput}
                      onChange={(e) => setDriveRootFolderIdInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className={`${btnSmall} btn-resolve-hover flex-shrink-0`}
                      style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}
                      disabled={driveSavingFolder || !driveRootFolderIdInput.trim()}
                      onClick={async () => {
                        const id = driveRootFolderIdInput.trim()
                        if (!id) return
                        setDriveSavingFolder(true)
                        try {
                          const { data: { session } } = await supabase.auth.getSession()
                          const res = await fetch('/api/drive/connection', {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                            },
                            body: JSON.stringify({ rootFolderId: id }),
                          })
                          const d = await res.json()
                          if (res.ok) {
                            setDriveStatus((s) => s ? { ...s, rootFolderId: id } : null)
                            window.alert('Pasta salva.')
                          } else {
                            window.alert(d.error || 'Erro ao salvar pasta.')
                          }
                        } finally {
                          setDriveSavingFolder(false)
                        }
                      }}
                    >
                      {driveSavingFolder ? '…' : 'Salvar pasta'}
                    </button>
                  </div>
                  {driveStatus?.rootFolderId && (
                    <p className="text-[10px] mt-1" style={{ color: resolve.muted }}>Pasta atual: {driveStatus.rootFolderId}</p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${btnSmall} transition-colors`}
                  style={{ backgroundColor: 'transparent', color: cinema.danger, border: `1px solid ${resolve.border}` }}
                  disabled={driveDisconnecting}
                  onClick={async () => {
                    setDriveDisconnecting(true)
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const res = await fetch('/api/drive/connection', {
                        method: 'DELETE',
                        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                      })
                      if (res.ok) setDriveStatus({ connected: false })
                      else {
                        const d = await res.json()
                        window.alert(d.error || 'Erro ao desconectar.')
                      }
                    } finally {
                      setDriveDisconnecting(false)
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = cinema.danger; e.currentTarget.style.backgroundColor = 'rgba(201, 74, 74, 0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = resolve.border; e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {driveDisconnecting ? 'Desconectando…' : 'Desconectar'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${btnSmall} btn-resolve-hover flex items-center gap-2`}
                style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}
                disabled={driveConnecting}
                onClick={async () => {
                  setDriveConnecting(true)
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    const res = await fetch('/api/auth/google-drive/connect', {
                      method: 'POST',
                      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                    })
                    const data = await res.json()
                    if (res.ok && data.url) {
                      window.location.href = data.url
                    } else {
                      window.alert(data.error || 'Erro ao obter URL.')
                    }
                  } finally {
                    setDriveConnecting(false)
                  }
                }}
              >
                <HardDrive size={14} strokeWidth={2} style={{ color: 'currentColor' }} />
                {driveConnecting ? 'Abrindo…' : 'Conectar Google Drive'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ USUÁRIOS ═══ */}
      {activeTab === 'users' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>USUÁRIOS ({profiles.length})</span>
            {isAdmin && (
              <button type="button" className={`${btnSmall} btn-resolve-hover flex items-center gap-1.5`} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openUserModal('new')}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Novo usuário</button>
            )}
          </div>
          <div className="p-3">
            <div className="flex flex-wrap gap-1.5 mb-4 rounded border p-2" style={{ borderColor: resolve.border }}>
              {profilesLoading ? (
                <span className="text-[11px]" style={{ color: resolve.muted }}>Carregando...</span>
              ) : profiles.length === 0 ? (
                <span className="text-[11px]" style={{ color: resolve.muted }}>Nenhum usuário.</span>
              ) : (
                profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openUserModal(p)}
                    className="btn-resolve-hover px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded transition-colors"
                    style={{
                      backgroundColor: userModal && userModal !== 'new' && userModal.id === p.id ? resolve.accent : 'transparent',
                      color: userModal && userModal !== 'new' && userModal.id === p.id ? resolve.bg : resolve.muted,
                    }}
                  >
                    {p.name || p.surname ? [p.name, p.surname].filter(Boolean).join(' ') : p.email}
                  </button>
                ))
              )}
            </div>
            {(userModal === 'new' || (userModal && userModal.id)) && (
              <div className="rounded border p-4 space-y-3" style={{ borderColor: resolve.border }}>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls} style={{ color: resolve.muted }}>Nome</label><input type="text" className={inputCls} style={inputStyle} value={uName} onChange={(e) => setUName(e.target.value)} /></div>
                  <div><label className={labelCls} style={{ color: resolve.muted }}>Sobrenome</label><input type="text" className={inputCls} style={inputStyle} value={uSurname} onChange={(e) => setUSurname(e.target.value)} /></div>
                </div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>E-mail</label><input type="email" className={inputCls} style={inputStyle} value={uEmail} onChange={(e) => setUEmail(e.target.value)} disabled={userModal !== 'new'} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>Senha {userModal !== 'new' ? '(deixe em branco para não alterar)' : ''}</label><input type="password" className={inputCls} style={inputStyle} value={uPassword} onChange={(e) => setUPassword(e.target.value)} placeholder={userModal !== 'new' ? '••••••••' : ''} minLength={6} /></div>
                {isAdmin && (
                  <div><label className={labelCls} style={{ color: resolve.muted }}>Perfil</label><select className={inputCls} style={inputStyle} value={uRole} onChange={(e) => setURole(e.target.value as ProfileRole)}>{(['admin', 'atendimento', 'produtor_executivo', 'crew', 'assistente_direcao', 'convidado'] as const).map((r) => <option key={r} value={r}>{PROFILE_LABELS[r]}</option>)}</select></div>
                )}
                {userModal && userModal !== 'new' && (
                  <div>
                    <label className={labelCls} style={{ color: resolve.muted }}>Projetos com acesso</label>
                    <div className="max-h-28 overflow-y-auto rounded border p-2 space-y-1" style={{ backgroundColor: resolve.bg, borderColor: resolve.border }}>
                      {userProjectsLoading ? <span className="text-[11px]" style={{ color: resolve.muted }}>Carregando...</span> : userModalProjectsList.map((proj) => (
                        <label key={proj.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                          <input type="checkbox" checked={userProjectIds.has(proj.id)} onChange={() => toggleUserProject(proj.id)} />
                          <span style={{ color: resolve.text }}>{proj.nome}</span>
                          <span style={{ color: resolve.muted }}>#{proj.job_id}</span>
                        </label>
                      ))}
                      {!userProjectsLoading && userModalProjectsList.length === 0 && <span className="text-[11px]" style={{ color: resolve.muted }}>Nenhum projeto.</span>}
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: resolve.muted }}>Restrições do perfil: {PROFILE_LABELS[uRole]}</p>
                  </div>
                )}
                {userError && <div className="text-[11px]" style={{ color: cinema.danger }}>{userError}</div>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setUserModal(null)} className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }}>Cancelar</button>
                  <button type="button" onClick={saveUser} disabled={userSaving} className={`${btnSmall} flex items-center gap-1.5`} style={{ backgroundColor: resolve.accent, color: resolve.bg }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{userSaving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="mt-4 rounded-lg overflow-hidden" style={{ borderColor: resolve.border, borderWidth: 1, borderStyle: 'solid', backgroundColor: resolve.panel }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: resolve.border }}>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.text }}>Restrições de perfis</h3>
                  <p className="text-[10px] mt-1" style={{ color: resolve.muted }}>Marque os itens que cada perfil não pode acessar. PROJETO é controlado em Projetos com acesso.</p>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-[10px] border-collapse" style={{ color: resolve.text, minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th className="text-left text-[10px] uppercase pb-2 pr-4 pt-1 align-bottom" style={{ color: resolve.muted, borderBottom: `2px solid ${resolve.border}`, minWidth: 120 }}>Perfil</th>
                        <th colSpan={NAV_PAGE_KEYS.length} className="text-center text-[10px] uppercase pb-2 px-2 pt-1 align-bottom" style={{ color: resolve.muted, backgroundColor: 'rgba(107, 91, 149, 0.15)', borderBottom: `2px solid ${resolve.border}`, borderLeft: `2px solid ${resolve.border}` }}>Páginas (nav)</th>
                        <th colSpan={HEADER_BUTTON_KEYS.length} className="text-center text-[10px] uppercase pb-2 px-2 pt-1 align-bottom" style={{ color: resolve.muted, backgroundColor: 'rgba(107, 99, 130, 0.2)', borderBottom: `2px solid ${resolve.border}`, borderLeft: `2px solid ${resolve.border}` }}>Header</th>
                        <th colSpan={CONFIG_TAB_KEYS.length} className="text-center text-[10px] uppercase pb-2 px-2 pt-1 align-bottom" style={{ color: resolve.muted, backgroundColor: 'rgba(92, 124, 153, 0.12)', borderBottom: `2px solid ${resolve.border}`, borderLeft: `2px solid ${resolve.border}` }}>Abas Config</th>
                        <th colSpan={FILME_BUTTON_KEYS.length} className="text-center text-[10px] uppercase pb-2 px-2 pt-1 align-bottom" style={{ color: resolve.muted, backgroundColor: 'rgba(245, 197, 24, 0.08)', borderBottom: `2px solid ${resolve.border}`, borderLeft: `2px solid ${resolve.border}` }}>Botões Filme</th>
                      </tr>
                      <tr>
                        <th className="pb-2 pr-4" style={{ borderBottom: `1px solid ${resolve.border}` }} />
                        {NAV_PAGE_KEYS.map((k) => <th key={`nav-${k}`} className="text-center pb-2 px-2 font-normal" style={{ color: resolve.muted, backgroundColor: 'rgba(107, 91, 149, 0.08)', borderBottom: `1px solid ${resolve.border}`, borderLeft: k === NAV_PAGE_KEYS[0] ? `2px solid ${resolve.border}` : undefined }}>{NAV_PAGE_LABELS[k]}</th>)}
                        {HEADER_BUTTON_KEYS.map((k, i) => <th key={`header-${k}`} className="text-center pb-2 px-2 font-normal" style={{ color: resolve.muted, backgroundColor: 'rgba(107, 99, 130, 0.1)', borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined }}>{HEADER_BUTTON_LABELS[k]}</th>)}
                        {CONFIG_TAB_KEYS.map((k, i) => <th key={`cfg-${k}`} className="text-center pb-2 px-2 font-normal" style={{ color: resolve.muted, backgroundColor: 'rgba(92, 124, 153, 0.06)', borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined }}>{CONFIG_TAB_LABELS[k]}</th>)}
                        {FILME_BUTTON_KEYS.map((k, i) => <th key={`filme-${k}`} className="text-center pb-2 px-2 font-normal" style={{ color: resolve.muted, backgroundColor: 'rgba(245, 197, 24, 0.05)', borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined }}>{FILME_BUTTON_LABELS[k]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {PROFILE_ROLES.map((role, ri) => (
                        <tr key={role} style={{ backgroundColor: ri % 2 === 1 ? 'rgba(0,0,0,0.15)' : undefined }}>
                          <td className="py-2 pr-4 font-medium" style={{ color: resolve.text, borderBottom: `1px solid ${resolve.border}` }}>{PROFILE_LABELS[role]}</td>
                          {NAV_PAGE_KEYS.map((k, i) => (
                            <td key={`${role}-nav-${k}`} className="py-2 px-2 text-center" style={{ borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined, backgroundColor: 'rgba(107, 91, 149, 0.04)' }}>
                              {role === 'admin' ? <span style={{ color: resolve.muted }}>—</span> : (
                                <input type="checkbox" checked={isRestrictionChecked(role, 'nav_page', k)} onChange={() => toggleRestriction(role, 'nav_page', k)} className="cursor-pointer" />
                              )}
                            </td>
                          ))}
                          {HEADER_BUTTON_KEYS.map((k, i) => (
                            <td key={`${role}-header-${k}`} className="py-2 px-2 text-center" style={{ borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined, backgroundColor: 'rgba(107, 99, 130, 0.06)' }}>
                              {role === 'admin' ? <span style={{ color: resolve.muted }}>—</span> : (
                                <input type="checkbox" checked={isRestrictionChecked(role, 'header_button', k)} onChange={() => toggleRestriction(role, 'header_button', k)} className="cursor-pointer" />
                              )}
                            </td>
                          ))}
                          {CONFIG_TAB_KEYS.map((k, i) => (
                            <td key={`${role}-cfg-${k}`} className="py-2 px-2 text-center" style={{ borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined, backgroundColor: 'rgba(92, 124, 153, 0.03)' }}>
                              {role === 'admin' ? <span style={{ color: resolve.muted }}>—</span> : (
                                <input type="checkbox" checked={isRestrictionChecked(role, 'config_tab', k)} onChange={() => toggleRestriction(role, 'config_tab', k)} className="cursor-pointer" />
                              )}
                            </td>
                          ))}
                          {FILME_BUTTON_KEYS.map((k, i) => (
                            <td key={`${role}-filme-${k}`} className="py-2 px-2 text-center" style={{ borderBottom: `1px solid ${resolve.border}`, borderLeft: i === 0 ? `2px solid ${resolve.border}` : undefined, backgroundColor: 'rgba(245, 197, 24, 0.03)' }}>
                              {role === 'admin' ? <span style={{ color: resolve.muted }}>—</span> : (
                                <input type="checkbox" checked={isRestrictionChecked(role, 'filme_button', k)} onChange={() => toggleRestriction(role, 'filme_button', k)} className="cursor-pointer" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: resolve.border }}>
                  <button type="button" onClick={saveRestrictions} disabled={restrictionsSaving} className={`${btnSmall} flex items-center gap-1.5`} style={{ backgroundColor: resolve.accent, color: resolve.bg }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{restrictionsSaving ? 'Salvando...' : 'Salvar restrições'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * COLABORADORES
       * ═══════════════════════════════════════════════════════ */}
      {activeTab === 'collaborators' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>COLABORADORES ({collabs.length})</span>
            <div className="flex gap-1.5">
              <button type="button" className={`${btnSmall} btn-resolve-hover`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={exportCollabsCsv}>Exportar</button>
              <button type="button" className={`${btnSmall} btn-resolve-hover`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => collabFileRef.current?.click()}>Importar</button>
              <input ref={collabFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importCollabsCsv(e.target.files[0]); e.target.value = '' }} />
              <button type="button" className={`${btnSmall} btn-resolve-hover flex items-center gap-1.5`} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openCollabModal('new')}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Novo</button>
            </div>
          </div>
          <div className="p-3">
            <input type="text" className={`${inputCls} mb-3`} style={inputStyle} value={collabSearch} onChange={(e) => setCollabSearch(e.target.value)} placeholder="Buscar por nome..." />
          </div>
          <div className="px-3 pb-3 overflow-x-auto min-w-0">
            {collabLoading ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Carregando...</div>
            ) : filteredCollabs.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Nenhum colaborador encontrado.</div>
            ) : (
              <table className="w-full text-[11px] border-collapse" style={{ color: resolve.text }}>
                <thead>
                  <tr>
                    <th className={thCls} style={{ color: resolve.muted }}>Nome</th>
                    <th className={thCls} style={{ color: resolve.muted }}>CPF</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Tel</th>
                    <th className={thCls} style={{ color: resolve.muted }}>E-mail</th>
                    <th className={thCls} style={{ color: resolve.muted }}>PIX</th>
                    <th className={`${thCls} text-right`} style={{ color: resolve.muted }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollabs.map((c) => (
                    <tr key={c.id} style={{ borderColor: resolve.border }}>
                      <td className={tdCls} style={{ borderColor: resolve.border, fontWeight: 500 }}>{c.nome}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border }}>{c.cpf || '—'}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border }}>{c.telefone || '—'}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border }}>{c.email || '—'}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border }}>{c.pix || '—'}</td>
                      <td className={`${tdCls} text-right whitespace-nowrap`} style={{ borderColor: resolve.border }}>
                        <button type="button" className="btn-resolve-hover inline-flex items-center justify-center p-1.5 rounded transition-colors border border-transparent" style={{ color: resolve.accent }} onClick={() => openCollabModal(c)} aria-label="Editar"><Pencil size={16} strokeWidth={2} /></button>
                        <button type="button" className="btn-danger-hover inline-flex items-center justify-center p-1.5 rounded transition-colors border border-transparent" style={{ color: cinema.danger }} onClick={() => removeCollab(c.id)} aria-label="Excluir"><X size={16} strokeWidth={2} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Colaborador ── */}
      {collabModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setCollabModal(null)} role="dialog" aria-modal="true" aria-labelledby="modal-title-collab">
          <div className="rounded border p-0 w-full max-w-lg shadow-lg overflow-hidden max-h-[90vh] overflow-y-auto" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 id="modal-title-collab" className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>{collabModal === 'new' ? '➕ NOVO COLABORADOR' : '✏️ EDITAR COLABORADOR'}</h3>
              <button type="button" onClick={() => setCollabModal(null)} className="btn-resolve-hover p-1 rounded border border-transparent transition-colors" style={{ color: resolve.muted }} aria-label="Fechar"><X size={18} strokeWidth={2} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className={labelCls} style={{ color: resolve.muted }}>Nome *</label><input type="text" className={inputCls} style={inputStyle} value={fNome} onChange={(e) => setFNome(e.target.value)} autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>CPF</label><input type="text" className={inputCls} style={inputStyle} value={fCpf} onChange={(e) => setFCpf(e.target.value)} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>RG</label><input type="text" className={inputCls} style={inputStyle} value={fRg} onChange={(e) => setFRg(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>Telefone</label><input type="text" className={inputCls} style={inputStyle} value={fTel} onChange={(e) => setFTel(e.target.value)} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>E-mail</label><input type="text" className={inputCls} style={inputStyle} value={fEmail} onChange={(e) => setFEmail(e.target.value)} /></div>
              </div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Endereço</label><input type="text" className={inputCls} style={inputStyle} value={fEnd} onChange={(e) => setFEnd(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>MEI</label><input type="text" className={inputCls} style={inputStyle} value={fMei} onChange={(e) => setFMei(e.target.value)} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>CNPJ</label><input type="text" className={inputCls} style={inputStyle} value={fCnpj} onChange={(e) => setFCnpj(e.target.value)} /></div>
              </div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>PIX</label><input type="text" className={inputCls} style={inputStyle} value={fPix} onChange={(e) => setFPix(e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>Banco</label><input type="text" className={inputCls} style={inputStyle} value={fBanco} onChange={(e) => setFBanco(e.target.value)} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>Agência</label><input type="text" className={inputCls} style={inputStyle} value={fAgencia} onChange={(e) => setFAgencia(e.target.value)} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>Conta</label><input type="text" className={inputCls} style={inputStyle} value={fConta} onChange={(e) => setFConta(e.target.value)} /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setCollabModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveCollab} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded flex items-center gap-1.5" style={{ backgroundColor: resolve.accent, color: resolve.bg }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TABELAS DE CACHÊ
       * ═══════════════════════════════════════════════════════ */}
      {activeTab === 'cache_tables' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>TABELAS DE CACHÊ ({cacheTables.length})</span>
            <button type="button" className={`${btnSmall} btn-resolve-hover inline-flex items-center justify-center gap-1.5`} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openCacheTableModal('new')}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor', flexShrink: 0 }} />Nova tabela</button>
          </div>
          <p className="px-3 py-1.5 text-[10px]" style={{ color: resolve.muted, borderBottom: `1px solid ${resolve.border}` }}>As tabelas criadas, duplicadas e editadas são salvas automaticamente no banco de dados.</p>
          <div className="p-3">
            {cacheTablesLoading ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Carregando...</div>
            ) : cacheTables.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Nenhuma tabela. Clique em &quot;+ Nova tabela&quot; e importe um CSV de funções e cachês.</div>
            ) : (
              <div className="space-y-2">
                {cacheTables.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded border" style={{ borderColor: resolve.border }}>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium" style={{ color: resolve.text }}>{t.name}</span>
                      {t.is_default && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>PADRÃO</span>}
                      {t.description && <p className="text-[11px] truncate mt-0.5" style={{ color: resolve.muted }}>{t.description}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0 flex-wrap">
                      <button type="button" className={`${btnSmall} btn-resolve-hover flex items-center gap-1.5`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => handleDuplicateCacheTable(t)} aria-label="Duplicar"><Copy size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Duplicar</button>
                      {!t.is_default && <button type="button" className={`${btnSmall} btn-resolve-hover`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => setDefaultCacheTable(t.id).then(() => loadCacheTables())}>Tornar padrão</button>}
                      <button type="button" className={`${btnSmall} btn-resolve-hover`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => { importTargetTableIdRef.current = t.id; cacheTableFileRef.current?.click(); }}>Importar CSV</button>
                      <input ref={cacheTableFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; const tid = importTargetTableIdRef.current; if (file && tid) { importCacheTableCsv(file, tid); importTargetTableIdRef.current = null; } e.target.value = '' }} />
                      <button type="button" className={`${btnSmall} btn-resolve-hover flex items-center gap-1.5`} style={{ backgroundColor: 'transparent', color: resolve.accent, border: `1px solid ${resolve.border}` }} onClick={() => openCacheTableModal(t)} aria-label="Editar"><Pencil size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Editar</button>
                      <button type="button" className={`${btnSmall} btn-danger-hover flex items-center gap-1.5`} style={{ backgroundColor: 'transparent', color: cinema.danger, border: `1px solid ${resolve.border}` }} onClick={() => removeCacheTable(t.id, t.name)} aria-label="Excluir"><X size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Nova/Editar Tabela de Cachê ── */}
      {cacheTableModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setCacheTableModal(null)} role="dialog" aria-modal="true" aria-labelledby="modal-title-cache-table">
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 id="modal-title-cache-table" className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>{cacheTableModal === 'new' ? '➕ NOVA TABELA' : '✏️ EDITAR TABELA'}</h3>
              <button type="button" onClick={() => setCacheTableModal(null)} className="btn-resolve-hover p-1 rounded border border-transparent transition-colors" style={{ color: resolve.muted }} aria-label="Fechar"><X size={18} strokeWidth={2} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className={labelCls} style={{ color: resolve.muted }}>Nome *</label><input type="text" className={inputCls} style={inputStyle} value={ctName} onChange={(e) => setCtName(e.target.value)} placeholder="Ex: SINDICINE 2024" autoFocus /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Descrição</label><input type="text" className={inputCls} style={inputStyle} value={ctDescription} onChange={(e) => setCtDescription(e.target.value)} placeholder="Ex: Tabela audiovisual SINDICINE 23-24" /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Fonte</label><input type="text" className={inputCls} style={inputStyle} value={ctSource} onChange={(e) => setCtSource(e.target.value)} placeholder="Ex: SINDICINE 2024" /></div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setCacheTableModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveCacheTable} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded flex items-center gap-1.5" style={{ backgroundColor: resolve.accent, color: resolve.bg }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * FUNÇÕES E CACHÊS
       * ═══════════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <div className="rounded border overflow-hidden min-w-0" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider grid grid-cols-[1fr_auto] items-center gap-2 min-w-0 w-full" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span className="min-w-0 truncate pr-2">FUNÇÕES E CACHÊS ({roles.length})</span>
            <div className="flex gap-1.5 flex-nowrap items-center justify-end min-w-0">
              <select className={`${inputCls} shrink-0 w-auto max-w-[220px]`} style={inputStyle} value={selectedCacheTableId || ''} onChange={(e) => setSelectedCacheTableId(e.target.value || null)}>
                <option value="">Selecione a tabela</option>
                {cacheTables.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (padrão)' : ''}</option>
                ))}
              </select>
              <button type="button" className={`${btnSmall} btn-resolve-hover shrink-0 whitespace-nowrap`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={exportRolesCsv}>Exportar</button>
              <button type="button" className={`${btnSmall} btn-resolve-hover shrink-0 whitespace-nowrap`} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => rolesFileRef.current?.click()}>Importar</button>
              <input ref={rolesFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importRolesCsv(e.target.files[0]); e.target.value = '' }} />
              <select className={`${inputCls} shrink-0 w-auto max-w-[180px]`} style={inputStyle} defaultValue="" onChange={(e) => { const v = e.target.value; if (v) { insertSeparator(v); e.target.value = ''; } }}>
                <option value="">Inserir separador...</option>
                {ROLES_DEPARTAMENTOS_ORDER.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button type="button" className={`${btnSmall} btn-resolve-hover shrink-0 whitespace-nowrap flex items-center gap-1.5`} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openRoleModal('new')}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Nova</button>
            </div>
          </div>
          <div className="p-3">
            <input type="text" className={`${inputCls} mb-3`} style={inputStyle} value={rolesSearch} onChange={(e) => setRolesSearch(e.target.value)} placeholder="Buscar por função..." />
          </div>
          <div className="px-3 pb-3 overflow-x-auto min-w-0">
            {rolesLoading ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Carregando...</div>
            ) : filteredRoles.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Nenhuma função encontrada.</div>
            ) : (
              <table className="w-full text-[11px] border-collapse" style={{ color: resolve.text }}>
                <thead>
                  <tr>
                    <th className={thCls} style={{ color: resolve.muted }}>Função</th>
                    <th className={`${thCls} text-right`} style={{ color: resolve.muted }}>Cachê (Dia)</th>
                    <th className={`${thCls} text-right`} style={{ color: resolve.muted }}>Cachê (Semana)</th>
                    <th className={`${thCls} text-right`} style={{ color: resolve.muted }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionsToRender.map((section, idx) => (
                    <React.Fragment key={section.separatorId ?? `outros-${idx}`}>
                      <tr
                        {...(section.separatorId != null
                          ? {
                              draggable: true,
                              onDragStart: (e: React.DragEvent) => handleRoleDragStart(e, section.separatorId!),
                              onDragEnd: handleRoleDragEnd,
                              onDragOver: (e: React.DragEvent) => handleRoleDragOver(e, section.separatorId!),
                              onDragLeave: handleRoleDragLeave,
                              onDrop: (e: React.DragEvent) => handleRoleDrop(e, section.separatorId!),
                              onMouseEnter: () => setHoveredRowId(section.separatorId),
                              onMouseLeave: () => { setHoveredRowId(null); setDropTargetId(null) },
                              className: draggedRoleId === section.separatorId ? 'cursor-grabbing opacity-50' : 'cursor-grab',
                              style: {
                                borderColor: resolve.border,
                                backgroundColor: dropTargetId === section.separatorId ? 'rgba(255,255,255,0.1)' : hoveredRowId === section.separatorId ? 'rgba(255,255,255,0.06)' : resolve.panel,
                                transition: 'background-color 0.15s ease',
                              },
                            }
                          : {
                              style: { borderColor: resolve.border },
                            }
                        )}
                      >
                        <td colSpan={4} className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ borderColor: resolve.border, color: resolve.muted, backgroundColor: 'transparent' }}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{section.name}</span>
                            {section.separatorId != null && (
                              <button type="button" className="btn-danger-hover inline-flex items-center gap-1 text-[10px] uppercase transition-colors border border-transparent rounded px-1 py-0.5" style={{ color: cinema.danger }} onClick={() => removeRole(section.separatorId!)} aria-label="Remover separador"><X size={14} strokeWidth={2} />Remover separador</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {section.rows.map((r) => {
                        const isHovered = hoveredRowId === r.id
                        const isDragging = draggedRoleId === r.id
                        const isDropTarget = dropTargetId === r.id
                        return (
                          <tr
                            key={r.id}
                            draggable
                            onDragStart={(e) => handleRoleDragStart(e, r.id)}
                            onDragEnd={handleRoleDragEnd}
                            onDragOver={(e) => handleRoleDragOver(e, r.id)}
                            onDragLeave={handleRoleDragLeave}
                            onDrop={(e) => handleRoleDrop(e, r.id)}
                            onMouseEnter={() => setHoveredRowId(r.id)}
                            onMouseLeave={() => { setHoveredRowId(null); setDropTargetId(null) }}
                            className={isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab'}
                            style={{
                              borderColor: resolve.border,
                              backgroundColor: isDropTarget ? 'rgba(255,255,255,0.1)' : isHovered ? 'rgba(255,255,255,0.06)' : undefined,
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <td className={tdCls} style={{ borderColor: resolve.border, fontWeight: 500 }}>{r.funcao}</td>
                            <td className={`${tdCls} text-right font-mono`} style={{ borderColor: resolve.border }}>{formatCurrency(Number(r.cache_dia))}</td>
                            <td className={`${tdCls} text-right font-mono`} style={{ borderColor: resolve.border }}>{formatCurrency(Number(r.cache_semana))}</td>
                            <td className={`${tdCls} text-right whitespace-nowrap`} style={{ borderColor: resolve.border }}>
                              <button type="button" className="btn-resolve-hover inline-flex items-center justify-center p-1.5 rounded mr-1 transition-colors border border-transparent" style={{ color: resolve.accent }} onClick={() => openRoleModal(r)} aria-label="Editar"><Pencil size={16} strokeWidth={2} /></button>
                              <button type="button" className="btn-resolve-hover inline-flex items-center justify-center p-1.5 rounded mr-1 transition-colors border border-transparent" style={{ color: resolve.accent }} onClick={() => duplicateRole(r)} aria-label="Duplicar"><Copy size={16} strokeWidth={2} /></button>
                              <button type="button" className="btn-danger-hover inline-flex items-center justify-center p-1.5 rounded transition-colors border border-transparent" style={{ color: cinema.danger }} onClick={() => removeRole(r.id)} aria-label="Excluir"><X size={16} strokeWidth={2} /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Função/Cachê ── */}
      {roleModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setRoleModal(null)} role="dialog" aria-modal="true" aria-labelledby="modal-title-role">
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 id="modal-title-role" className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>{roleModal === 'new' ? '➕ NOVA FUNÇÃO' : '✏️ EDITAR FUNÇÃO'}</h3>
              <button type="button" onClick={() => setRoleModal(null)} className="btn-resolve-hover p-1 rounded border border-transparent transition-colors" style={{ color: resolve.muted }} aria-label="Fechar"><X size={18} strokeWidth={2} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className={labelCls} style={{ color: resolve.muted }}>Função *</label><input type="text" className={inputCls} style={inputStyle} value={rFuncao} onChange={(e) => setRFuncao(e.target.value)} autoFocus placeholder={roleModal !== 'new' && roleModal && isRoleSeparator(roleModal) ? 'Ex: --- DIREÇÃO ---' : undefined} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>Cachê (Dia)</label><input type="number" step="0.01" className={inputCls} style={inputStyle} value={rDia} onChange={(e) => setRDia(e.target.value)} placeholder="0.00" /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>Cachê (Semana)</label><input type="number" step="0.01" className={inputCls} style={inputStyle} value={rSemana} onChange={(e) => setRSemana(e.target.value)} placeholder="0.00" /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setRoleModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveRole} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded flex items-center gap-1.5" style={{ backgroundColor: resolve.accent, color: resolve.bg }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * PROJETOS
       * ═══════════════════════════════════════════════════════ */}
      {activeTab === 'projects' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>PROJETOS ({projects.length})</span>
          </div>
          <div className="p-3">
            <input type="text" className={`${inputCls} mb-3`} style={inputStyle} value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="Buscar por nome, agência ou cliente..." />
          </div>
          <div className="px-3 pb-3 overflow-x-auto min-w-0">
            {projectsLoading ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Carregando...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: resolve.muted }}>Nenhum projeto encontrado.</div>
            ) : (
              <table className="w-full text-[11px] border-collapse" style={{ color: resolve.text }}>
                <thead>
                  <tr>
                    <th className={thCls} style={{ color: resolve.muted }}>JOB</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Nome</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Agência</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Cliente</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Atualizado</th>
                    <th className={`${thCls} text-right`} style={{ color: resolve.muted }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
                    <tr key={p.id} style={{ borderColor: resolve.border }}>
                      <td className={tdCls} style={{ borderColor: resolve.border, color: resolve.muted, fontFamily: 'monospace' }}>#{p.job_id}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border, fontWeight: 500 }}>{p.nome}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border }}>{p.agencia || '—'}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border }}>{p.cliente || '—'}</td>
                      <td className={tdCls} style={{ borderColor: resolve.border, color: resolve.muted }}>{new Date(p.updated_at).toLocaleDateString('pt-BR')}</td>
                      <td className={`${tdCls} text-right whitespace-nowrap`} style={{ borderColor: resolve.border }}>
                        <button type="button" className="btn-resolve-hover inline-flex items-center justify-center p-1.5 rounded mr-1 transition-colors border border-transparent" style={{ color: resolve.accent }} onClick={() => openProjectModal(p)} aria-label="Editar" title="Editar"><Pencil size={16} strokeWidth={2} /></button>
                        {onRecriarPastaDrive && (
                          <button type="button" disabled={recriarPastaProjectId === p.id} className="btn-resolve-hover inline-flex items-center justify-center p-1.5 rounded mr-1 transition-colors border border-transparent" style={{ color: resolve.accent }} onClick={async () => { setRecriarPastaProjectId(p.id); try { await onRecriarPastaDrive(p.id); } finally { setRecriarPastaProjectId(null); } }} aria-label={recriarPastaProjectId === p.id ? 'Recriando...' : 'Recriar pasta no Drive'} title="Recriar pasta no Drive (use se a pasta foi excluída)">{recriarPastaProjectId === p.id ? '…' : <RefreshCw size={16} strokeWidth={2} />}</button>
                        )}
                        <button type="button" className="btn-danger-hover inline-flex items-center justify-center p-1.5 rounded transition-colors border border-transparent" style={{ color: cinema.danger }} onClick={() => removeProject(p.id, p.nome)} disabled={deletingProjectId === p.id} aria-label={deletingProjectId === p.id ? 'Excluindo...' : 'Excluir'} title={deletingProjectId === p.id ? 'Excluindo...' : 'Excluir'}><X size={16} strokeWidth={2} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Editar Projeto ── */}
      {projectModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setProjectModal(null)} role="dialog" aria-modal="true" aria-labelledby="modal-title-edit-project">
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 id="modal-title-edit-project" className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>✏️ EDITAR PROJETO</h3>
              <button type="button" onClick={() => setProjectModal(null)} className="btn-resolve-hover p-1 rounded border border-transparent transition-colors" style={{ color: resolve.muted }} aria-label="Fechar"><X size={18} strokeWidth={2} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-[11px] font-mono px-1 mb-1" style={{ color: resolve.muted }}>JOB #{projectModal.job_id}</div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Nome *</label><input type="text" className={inputCls} style={inputStyle} value={pNome} onChange={(e) => setPNome(e.target.value)} autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>Agência</label><input type="text" className={inputCls} style={inputStyle} value={pAgencia} onChange={(e) => setPAgencia(e.target.value)} /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>Cliente</label><input type="text" className={inputCls} style={inputStyle} value={pCliente} onChange={(e) => setPCliente(e.target.value)} /></div>
              </div>
              <div>
                <label className={labelCls} style={{ color: resolve.muted }}>Duração</label>
                <div className="flex gap-2">
                  <input type="text" className={`flex-1 ${inputCls}`} style={inputStyle} value={pDuracao} onChange={(e) => setPDuracao(e.target.value)} placeholder="0" />
                  <select className="w-16 px-1 py-1.5 text-sm rounded border text-center" style={inputStyle} value={pDuracaoUnit} onChange={(e) => setPDuracaoUnit(e.target.value as 'segundos' | 'minutos')}>
                    <option value="segundos">Sec.</option>
                    <option value="minutos">Min.</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: resolve.muted }}>Usuários com acesso</label>
                <div className="max-h-28 overflow-y-auto rounded border p-2 space-y-1" style={{ backgroundColor: resolve.bg, borderColor: resolve.border }}>
                  {pMembersLoading ? <span className="text-[11px]" style={{ color: resolve.muted }}>Carregando...</span> : projectModalProfiles.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input type="checkbox" checked={pMemberIds.has(p.id)} onChange={() => toggleProjectMember(p.id)} />
                      <span style={{ color: resolve.text }}>{[p.name, p.surname].filter(Boolean).join(' ') || p.email}</span>
                      <span style={{ color: resolve.muted }}>({PROFILE_LABELS[p.role as keyof typeof PROFILE_LABELS] ?? p.role})</span>
                    </label>
                  ))}
                  {!pMembersLoading && projectModalProfiles.length === 0 && <span className="text-[11px]" style={{ color: resolve.muted }}>Nenhum usuário.</span>}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setProjectModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveProjectEdit} className="h-8 px-3 text-xs font-medium uppercase rounded flex items-center gap-1.5" style={{ backgroundColor: resolve.accent, color: resolve.bg }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ÍCONES (referência temporária – pode ser removida quando o sistema estiver completo) ═══ */}
      {activeTab === 'icons' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider" style={{ borderColor: resolve.border, color: resolve.muted }}>
            ÍCONES DO SISTEMA (Lucide)
          </div>
          <div className="p-4 space-y-6">
            <p className="text-[11px]" style={{ color: resolve.muted }}>
              Aba de referência para alinhar quais ícones usamos. Cores e tamanhos seguem o tema (resolve). Lista completa: <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: resolve.accent }}>lucide.dev/icons</a>
            </p>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: resolve.text }}>Usados no sistema</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {APP_ICONS.map(({ name, Icon, usage }) => (
                  <div
                    key={name}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded border"
                    style={{ borderColor: resolve.border, backgroundColor: resolve.bg }}
                  >
                    <Icon size={28} strokeWidth={1.5} color={resolve.muted} style={{ color: resolve.muted }} />
                    <span className="text-[10px] font-mono text-center" style={{ color: resolve.text }}>{name}</span>
                    <span className="text-[10px] text-center" style={{ color: resolve.muted }}>{usage}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: resolve.text }}>Galeria de referência</h3>
              <input
                type="text"
                className={`${inputCls} mb-3 max-w-xs`}
                style={inputStyle}
                value={iconsSearch}
                onChange={(e) => setIconsSearch(e.target.value)}
                placeholder="Filtrar por nome (ex: Calendar, User)..."
              />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {GALLERY_ICONS.filter((item) => !String(iconsSearch ?? '').trim() || (item.name || '').toLowerCase().includes((iconsSearch ?? '').toLowerCase())).map(({ name, Icon }, i) => (
                  <div
                    key={`gallery-icon-${i}`}
                    className="flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded border"
                    style={{ borderColor: resolve.border, backgroundColor: resolve.bg }}
                    title={name}
                  >
                    <Icon size={22} strokeWidth={1.5} color={resolve.muted} style={{ color: resolve.muted }} />
                    <span className="text-[9px] font-mono truncate w-full text-center" style={{ color: resolve.text }}>{name}</span>
                  </div>
                ))}
              </div>
              {GALLERY_ICONS.filter((item) => !String(iconsSearch ?? '').trim() || (item.name || '').toLowerCase().includes((iconsSearch ?? '').toLowerCase())).length === 0 && (
                <p className="text-[11px]" style={{ color: resolve.muted }}>Nenhum ícone encontrado. Tente outro termo.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOGS ═══ */}
      {activeTab === 'logs' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span className="text-[11px] font-medium uppercase tracking-wider">LOG DE ATIVIDADES</span>
            <input
              type="text"
              className={inputCls}
              style={{ ...inputStyle, maxWidth: 200 }}
              placeholder="Filtrar..."
              value={logsFilter}
              onChange={(e) => setLogsFilter(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            {logsLoading ? (
              <div className="p-8 text-center text-[11px]" style={{ color: resolve.muted }}>Carregando...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-[11px]" style={{ color: resolve.muted }}>Nenhum registro encontrado.</div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10" style={{ backgroundColor: resolve.panel }}>
                  <tr style={{ borderBottom: `1px solid ${resolve.border}` }}>
                    <th className={thCls} style={{ color: resolve.muted }}>Data/Hora</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Usuário</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Ação</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Entidade</th>
                    <th className={thCls} style={{ color: resolve.muted }}>Item</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: `1px solid ${resolve.border}` }}>
                      <td className={tdCls} style={{ color: resolve.muted }}>{formatLogDate(log.created_at)}</td>
                      <td className={tdCls} style={{ color: resolve.text }}>{log.user_name || '—'}</td>
                      <td className={tdCls} style={{ color: resolve.text }}>{formatActionLabel(log.action)}</td>
                      <td className={tdCls} style={{ color: resolve.text }}>{formatEntityLabel(log.entity_type)}</td>
                      <td className={tdCls} style={{ color: resolve.text }}>{log.entity_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
