'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PageLayout from '@/components/PageLayout'
import { resolve, cinema } from '@/lib/theme'
import {
  listCollaborators, createCollaborator, updateCollaborator, deleteCollaborator, importCollaborators,
  type Collaborator, type CollaboratorInsert,
} from '@/lib/services/collaborators'
import {
  listRoles, createRole, updateRole, deleteRole, importRoles,
  type RoleRate, type RoleRateInsert,
} from '@/lib/services/roles-rates'
import {
  listCacheTables, createCacheTable, updateCacheTable, deleteCacheTable, setDefaultCacheTable, duplicateCacheTable,
  type CacheTable, type CacheTableInsert,
} from '@/lib/services/cache-tables'
import { formatCurrency } from '@/lib/utils'
import { getCompany, saveCompany, uploadCompanyLogo } from '@/lib/services/company'
import {
  listProjects, updateProject, deleteProject,
  type ProjectRecord,
} from '@/lib/services/projects'
import { listProfiles, updateProfile, type Profile, type ProfileRole } from '@/lib/services/profiles'
import { supabase } from '@/lib/supabase'

type ConfigTab = 'company' | 'users' | 'collaborators' | 'cache_tables' | 'roles' | 'projects' | 'logs'

const TABS: { id: ConfigTab; label: string }[] = [
  { id: 'company', label: 'MINHA PRODUTORA' },
  { id: 'users', label: 'USUÁRIOS' },
  { id: 'collaborators', label: 'COLABORADORES' },
  { id: 'cache_tables', label: 'TABELAS DE CACHÊ' },
  { id: 'roles', label: 'FUNÇÕES E CACHÊS' },
  { id: 'projects', label: 'PROJETOS' },
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
  const clean = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(clean) || 0
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
}

export default function ViewConfig({ onLogoChange, currentProfile, isAdmin }: ViewConfigProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('company')

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
  const [uRole, setURole] = useState<ProfileRole>('producer')
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')

  useEffect(() => {
    if (activeTab === 'users') {
      setProfilesLoading(true)
      listProfiles().then((list) => {
        setProfiles(list)
        setProfilesLoading(false)
      })
    }
  }, [activeTab])

  const openUserModal = (p: null | 'new' | Profile) => {
    if (p && p !== 'new' && !isAdmin && currentProfile && p.id !== currentProfile.id) return
    setUserModal(p)
    setUserError('')
    if (p === 'new') {
      setUName(''); setUSurname(''); setUEmail(''); setUPassword(''); setURole('producer')
    } else if (p) {
      setUName(p.name); setUSurname(p.surname); setUEmail(p.email); setUPassword(''); setURole(p.role)
    }
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
      await createCollaborator(data)
    } else if (collabModal) {
      await updateCollaborator(collabModal.id, data)
    }
    setCollabModal(null)
    loadCollabs()
  }

  const removeCollab = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remover este colaborador?')) return
    await deleteCollaborator(id)
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
      const cols = line.split(',').map(parseCsvValue)
      return {
        nome: cols[0] || '', cpf: cols[1] || '', rg: cols[2] || '', telefone: cols[3] || '',
        email: cols[4] || '', endereco: cols[5] || '', mei: cols[6] || '', cnpj: cols[7] || '',
        pix: cols[8] || '', banco: cols[9] || '', agencia: cols[10] || '', conta: cols[11] || '',
      }
    }).filter((r) => r.nome)
    const count = await importCollaborators(rows)
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
        setCacheTableModal(null)
        loadCacheTables()
        if (typeof window !== 'undefined') window.alert('Tabela criada! Use "Importar CSV" na tabela para adicionar funções.')
      }
    } else if (cacheTableModal) {
      await updateCacheTable(cacheTableModal.id, { name: ctName.trim(), description: ctDescription.trim(), source: ctSource.trim() })
      setCacheTableModal(null)
      loadCacheTables()
    }
  }

  const importCacheTableCsv = async (file: File, tableId: string) => {
    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return
    const rows: RoleRateInsert[] = lines.slice(1).map((line) => {
      const cols = line.split(',').map(parseCsvValue)
      return { funcao: cols[0] || '', cache_dia: parseBrCurrency(cols[1] || '0'), cache_semana: parseBrCurrency(cols[2] || '0') }
    }).filter((r) => r.funcao)
    const count = await importRoles(rows, tableId)
    if (typeof window !== 'undefined') window.alert(`${count} função(ões) importada(s)!`)
    loadCacheTables()
  }

  const removeCacheTable = async (id: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Excluir a tabela "${name}" e todas as suas funções? Esta ação não pode ser desfeita.`)) return
    await deleteCacheTable(id)
    loadCacheTables()
  }

  const handleDuplicateCacheTable = async (t: CacheTable) => {
    const created = await duplicateCacheTable(t.id)
    if (created) {
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
      setRFuncao(role.funcao); setRDia(String(role.cache_dia)); setRSemana(String(role.cache_semana))
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
      await createRole({ ...base, table_id: selectedCacheTableId })
    } else if (roleModal) {
      await updateRole(roleModal.id, base)
    }
    setRoleModal(null)
    loadRoles()
  }

  const removeRole = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remover esta função?')) return
    await deleteRole(id)
    loadRoles()
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
    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return
    const rows: RoleRateInsert[] = lines.slice(1).map((line) => {
      const cols = line.split(',').map(parseCsvValue)
      return { funcao: cols[0] || '', cache_dia: parseBrCurrency(cols[1] || '0'), cache_semana: parseBrCurrency(cols[2] || '0') }
    }).filter((r) => r.funcao)
    const count = await importRoles(rows, selectedCacheTableId)
    if (typeof window !== 'undefined') window.alert(`${count} função(ões) importada(s)!`)
    loadRoles()
  }

  const filteredRoles = rolesSearch
    ? roles.filter((r) => r.funcao.toLowerCase().includes(rolesSearch.toLowerCase()))
    : roles

  /* ═══════════════════════════════════════════════════════
   * PROJETOS
   * ═══════════════════════════════════════════════════════ */
  const [projects, setProjects] = useState<ConfigProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectModal, setProjectModal] = useState<ConfigProjectSummary | null>(null)

  // Form fields para edição de projeto
  const [pNome, setPNome] = useState('')
  const [pAgencia, setPAgencia] = useState('')
  const [pCliente, setPCliente] = useState('')
  const [pDuracao, setPDuracao] = useState('')
  const [pDuracaoUnit, setPDuracaoUnit] = useState<'segundos' | 'minutos'>('segundos')

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    const data = await listProjects()
    setProjects(data as ConfigProjectSummary[])
    setProjectsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'projects') loadProjects()
  }, [activeTab, loadProjects])

  const openProjectModal = (proj: ConfigProjectSummary) => {
    setPNome(proj.nome)
    setPAgencia(proj.agencia)
    setPCliente(proj.cliente)
    setPDuracao(proj.duracao || '')
    setPDuracaoUnit((proj.duracao_unit as 'segundos' | 'minutos') || 'segundos')
    setProjectModal(proj)
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
    setProjectModal(null)
    loadProjects()
    if (typeof window !== 'undefined') window.alert('Projeto atualizado!')
  }

  const removeProject = async (id: string, nome: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Excluir o projeto "${nome}"? Esta ação não pode ser desfeita.`)) return
    await deleteProject(id)
    loadProjects()
  }

  const filteredProjects = projectSearch
    ? projects.filter((p) =>
        p.nome.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.agencia.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.cliente.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects

  /* ═══════════════════════════════════════════════════════ */

  return (
    <PageLayout title="Configurações" contentLayout="single">
      {/* ── Abas ── */}
      <div className="flex flex-wrap gap-1.5 mb-4 rounded border p-2" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded transition-colors"
              style={{ backgroundColor: active ? resolve.accent : 'transparent', color: active ? resolve.bg : resolve.muted }}>
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
            <button type="button" className={btnSmall} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={handleSaveCompany} disabled={companySaving}>{companySaving ? 'Salvando...' : 'Salvar'}</button>
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
                    className={btnSmall}
                    style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }}
                    onClick={() => logoFileRef.current?.click()}
                    disabled={logoUploading}
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
                      className={btnSmall}
                      style={{ backgroundColor: 'transparent', color: cinema.danger, border: `1px solid ${resolve.border}` }}
                      onClick={async () => {
                        await saveCompany({ logo_url: '' })
                        setLogoPreview('')
                        onLogoChange?.('')
                      }}
                    >
                      Remover
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

      {/* ═══ USUÁRIOS ═══ */}
      {activeTab === 'users' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>USUÁRIOS ({profiles.length})</span>
            {isAdmin && (
              <button type="button" className={btnSmall} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openUserModal('new')}>+ Novo usuário</button>
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
                    className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded transition-colors"
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
                  <div><label className={labelCls} style={{ color: resolve.muted }}>Perfil</label><select className={inputCls} style={inputStyle} value={uRole} onChange={(e) => setURole(e.target.value as ProfileRole)}><option value="producer">Produtor</option><option value="admin">Administrador</option></select></div>
                )}
                {userError && <div className="text-[11px]" style={{ color: cinema.danger }}>{userError}</div>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setUserModal(null)} className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }}>Cancelar</button>
                  <button type="button" onClick={saveUser} disabled={userSaving} className={btnSmall} style={{ backgroundColor: resolve.accent, color: resolve.bg }}>{userSaving ? 'Salvando...' : 'Salvar'}</button>
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
              <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={exportCollabsCsv}>Exportar</button>
              <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => collabFileRef.current?.click()}>Importar</button>
              <input ref={collabFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importCollabsCsv(e.target.files[0]); e.target.value = '' }} />
              <button type="button" className={btnSmall} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openCollabModal('new')}>+ Novo</button>
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
                        <button type="button" className="text-[11px] uppercase mr-2" style={{ color: resolve.accent }} onClick={() => openCollabModal(c)}>Editar</button>
                        <button type="button" className="text-[11px] uppercase" style={{ color: cinema.danger }} onClick={() => removeCollab(c.id)}>×</button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setCollabModal(null)}>
          <div className="rounded border p-0 w-full max-w-lg shadow-lg overflow-hidden max-h-[90vh] overflow-y-auto" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>{collabModal === 'new' ? '➕ NOVO COLABORADOR' : '✏️ EDITAR COLABORADOR'}</h3>
              <button type="button" onClick={() => setCollabModal(null)} className="text-lg leading-none px-1" style={{ color: resolve.muted }}>×</button>
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
                <button type="button" onClick={saveCollab} className="h-8 px-3 text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>Salvar</button>
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
            <button type="button" className={btnSmall} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openCacheTableModal('new')}>+ Nova tabela</button>
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
                      <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => handleDuplicateCacheTable(t)}>Duplicar</button>
                      {!t.is_default && <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => setDefaultCacheTable(t.id).then(() => loadCacheTables())}>Tornar padrão</button>}
                      <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => { importTargetTableIdRef.current = t.id; cacheTableFileRef.current?.click(); }}>Importar CSV</button>
                      <input ref={cacheTableFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; const tid = importTargetTableIdRef.current; if (file && tid) { importCacheTableCsv(file, tid); importTargetTableIdRef.current = null; } e.target.value = '' }} />
                      <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.accent, border: `1px solid ${resolve.border}` }} onClick={() => openCacheTableModal(t)}>Editar</button>
                      <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: cinema.danger, border: `1px solid ${resolve.border}` }} onClick={() => removeCacheTable(t.id, t.name)}>Excluir</button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setCacheTableModal(null)}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>{cacheTableModal === 'new' ? '➕ NOVA TABELA' : '✏️ EDITAR TABELA'}</h3>
              <button type="button" onClick={() => setCacheTableModal(null)} className="text-lg leading-none px-1" style={{ color: resolve.muted }}>×</button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className={labelCls} style={{ color: resolve.muted }}>Nome *</label><input type="text" className={inputCls} style={inputStyle} value={ctName} onChange={(e) => setCtName(e.target.value)} placeholder="Ex: SINDICINE 2024" autoFocus /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Descrição</label><input type="text" className={inputCls} style={inputStyle} value={ctDescription} onChange={(e) => setCtDescription(e.target.value)} placeholder="Ex: Tabela audiovisual SINDICINE 23-24" /></div>
              <div><label className={labelCls} style={{ color: resolve.muted }}>Fonte</label><input type="text" className={inputCls} style={inputStyle} value={ctSource} onChange={(e) => setCtSource(e.target.value)} placeholder="Ex: SINDICINE 2024" /></div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setCacheTableModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveCacheTable} className="h-8 px-3 text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * FUNÇÕES E CACHÊS
       * ═══════════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between gap-2" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>FUNÇÕES E CACHÊS ({roles.length})</span>
            <div className="flex gap-1.5 flex-wrap">
              <select className={inputCls} style={{ ...inputStyle, maxWidth: 220 }} value={selectedCacheTableId || ''} onChange={(e) => setSelectedCacheTableId(e.target.value || null)}>
                <option value="">Selecione a tabela</option>
                {cacheTables.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (padrão)' : ''}</option>
                ))}
              </select>
              <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={exportRolesCsv}>Exportar</button>
              <button type="button" className={btnSmall} style={{ backgroundColor: 'transparent', color: resolve.muted, border: `1px solid ${resolve.border}` }} onClick={() => rolesFileRef.current?.click()}>Importar</button>
              <input ref={rolesFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importRolesCsv(e.target.files[0]); e.target.value = '' }} />
              <button type="button" className={btnSmall} style={{ backgroundColor: resolve.accent, color: resolve.bg }} onClick={() => openRoleModal('new')}>+ Nova</button>
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
                  {filteredRoles.map((r) => (
                    <tr key={r.id} style={{ borderColor: resolve.border }}>
                      <td className={tdCls} style={{ borderColor: resolve.border, fontWeight: 500 }}>{r.funcao}</td>
                      <td className={`${tdCls} text-right font-mono`} style={{ borderColor: resolve.border }}>{formatCurrency(Number(r.cache_dia))}</td>
                      <td className={`${tdCls} text-right font-mono`} style={{ borderColor: resolve.border }}>{formatCurrency(Number(r.cache_semana))}</td>
                      <td className={`${tdCls} text-right whitespace-nowrap`} style={{ borderColor: resolve.border }}>
                        <button type="button" className="text-[11px] uppercase mr-2" style={{ color: resolve.accent }} onClick={() => openRoleModal(r)}>Editar</button>
                        <button type="button" className="text-[11px] uppercase" style={{ color: cinema.danger }} onClick={() => removeRole(r.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Função/Cachê ── */}
      {roleModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setRoleModal(null)}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>{roleModal === 'new' ? '➕ NOVA FUNÇÃO' : '✏️ EDITAR FUNÇÃO'}</h3>
              <button type="button" onClick={() => setRoleModal(null)} className="text-lg leading-none px-1" style={{ color: resolve.muted }}>×</button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className={labelCls} style={{ color: resolve.muted }}>Função *</label><input type="text" className={inputCls} style={inputStyle} value={rFuncao} onChange={(e) => setRFuncao(e.target.value)} autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} style={{ color: resolve.muted }}>Cachê (Dia)</label><input type="number" step="0.01" className={inputCls} style={inputStyle} value={rDia} onChange={(e) => setRDia(e.target.value)} placeholder="0.00" /></div>
                <div><label className={labelCls} style={{ color: resolve.muted }}>Cachê (Semana)</label><input type="number" step="0.01" className={inputCls} style={inputStyle} value={rSemana} onChange={(e) => setRSemana(e.target.value)} placeholder="0.00" /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setRoleModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveRole} className="h-8 px-3 text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>Salvar</button>
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
                        <button type="button" className="text-[11px] uppercase mr-2" style={{ color: resolve.accent }} onClick={() => openProjectModal(p)}>Editar</button>
                        <button type="button" className="text-[11px] uppercase" style={{ color: cinema.danger }} onClick={() => removeProject(p.id, p.nome)}>Excluir</button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && setProjectModal(null)}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: resolve.text }}>✏️ EDITAR PROJETO</h3>
              <button type="button" onClick={() => setProjectModal(null)} className="text-lg leading-none px-1" style={{ color: resolve.muted }}>×</button>
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
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setProjectModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={saveProjectEdit} className="h-8 px-3 text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOGS ═══ */}
      {activeTab === 'logs' && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider" style={{ borderColor: resolve.border, color: resolve.muted }}>LOGS</div>
          <div className="p-8 text-center text-sm" style={{ color: resolve.muted }}>Em breve.</div>
        </div>
      )}
    </PageLayout>
  )
}
