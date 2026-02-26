'use client'

import { useState, useCallback, useEffect } from 'react'
import { Settings, Plus, FolderOpen, Copy, Save, LogOut, X } from 'lucide-react'
import { resolve, cinema } from '@/lib/theme'
import type { ProjectData } from '@/lib/types'
import { listAccessibleProjects, getProjectMembers } from '@/lib/services/projects'
import { listProfiles } from '@/lib/services/profiles'
import { PROFILE_LABELS, PROJECT_AUTO_INCLUDE_ROLES } from '@/lib/permissions'

/* ── Estilos reutilizáveis ── */
const modalInputStyle = { backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }
const modalLabelCls = 'block text-[11px] uppercase text-left mb-0.5'
const modalTitleStyle = { color: resolve.yellowDark }
const modalPrimaryBtnStyle = { backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }
const btnBaseCls = 'btn-resolve-hover h-7 px-3 border text-xs font-medium uppercase tracking-wide rounded'
const btnBaseClsMobile = 'btn-resolve-hover h-7 px-2 border text-xs font-medium uppercase rounded'
const btnBaseStyle = { backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }

interface ProjectSummary {
  id: string
  job_id: string
  nome: string
  agencia: string
  cliente: string
  updated_at: string
}

interface HeaderProps {
  projectData: ProjectData
  logoUrl?: string
  loadingOpen?: boolean
  onNewProject: (data: { nome: string; agencia: string; cliente: string; duracao: string; duracaoUnit: 'segundos' | 'minutos'; memberIds?: string[] }) => void | Promise<void>
  onSave: () => void
  onSaveCopy: (data: { nome: string; agencia: string; cliente: string; duracao: string; duracaoUnit: 'segundos' | 'minutos'; memberIds?: string[] }) => Promise<void>
  onOpenProject: (id: string) => void
  saving?: boolean
  onLogout?: () => void
  loggingOut?: boolean
  onOpenConfig?: () => void
  /** Quando true, mostra apenas o botão SAIR. Se restrictedHeaderButtons for passado, usa-o para controle fino. */
  showOnlyLogout?: boolean
  /** Botões do header restritos (novo, abrir, salvarCopia, salvar, config). Oculta cada um que estiver na lista. */
  restrictedHeaderButtons?: string[]
  /** ID do usuário atual (para seleção de membros) */
  currentUserId?: string | null
  /** ID do projeto no banco (para copiar membros ao Salvar cópia) */
  projectDbId?: string | null
}

export default function Header({ projectData, logoUrl, loadingOpen = false, onNewProject, onSave, onSaveCopy, onOpenProject, saving = false, onLogout, loggingOut = false, onOpenConfig, showOnlyLogout = false, restrictedHeaderButtons = [], currentUserId, projectDbId }: HeaderProps) {
  const [modalOpen, setModalOpen] = useState<'novo' | 'abrir' | 'copia' | null>(null)

  /* NOVO */
  const [newNome, setNewNome] = useState('')
  const [newAgencia, setNewAgencia] = useState('')
  const [newCliente, setNewCliente] = useState('')
  const [newDuracao, setNewDuracao] = useState('')
  const [newDuracaoUnit, setNewDuracaoUnit] = useState<'segundos' | 'minutos'>('segundos')

  /* CÓPIA */
  const [copyNome, setCopyNome] = useState('')
  const [copyAgencia, setCopyAgencia] = useState('')
  const [copyCliente, setCopyCliente] = useState('')
  const [copyDuracao, setCopyDuracao] = useState('')
  const [copyDuracaoUnit, setCopyDuracaoUnit] = useState<'segundos' | 'minutos'>('segundos')

  /* ABRIR */
  const [searchTerm, setSearchTerm] = useState('')
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  /* Membros (usuários com acesso ao projeto) */
  const [profiles, setProfiles] = useState<{ id: string; name: string; surname: string; email: string; role: string }[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())

  const closeModal = useCallback(() => setModalOpen(null), [])

  const openNew = async () => {
    setNewNome(''); setNewAgencia(''); setNewCliente(''); setNewDuracao(''); setNewDuracaoUnit('segundos')
    setModalOpen('novo')
    setProfilesLoading(true)
    const list = await listProfiles()
    setProfiles(list as { id: string; name: string; surname: string; email: string; role: string }[])
    const defaults = new Set(list.filter((p) => PROJECT_AUTO_INCLUDE_ROLES.includes(p.role as 'admin' | 'atendimento' | 'crew')).map((p) => p.id))
    if (currentUserId) defaults.add(currentUserId)
    setSelectedMemberIds(defaults)
    setProfilesLoading(false)
  }

  const handleCreateNew = async () => {
    if (!newNome.trim()) return
    await onNewProject({ nome: newNome.trim(), agencia: newAgencia.trim(), cliente: newCliente.trim(), duracao: newDuracao.trim(), duracaoUnit: newDuracaoUnit, memberIds: Array.from(selectedMemberIds) })
    closeModal()
  }

  const openAbrir = () => {
    setSearchTerm('')
    setLoadingProjects(true)
    setModalOpen('abrir')
  }

  const [projectsListUnauthorized, setProjectsListUnauthorized] = useState(false)
  const [projectsListDebug, setProjectsListDebug] = useState<{ userId: string; myProjectIdsCount: number; totalProjectsWithMembers: number } | null>(null)

  useEffect(() => {
    if (modalOpen !== 'abrir') return
    setProjectsListUnauthorized(false)
    setProjectsListDebug(null)
    const delayMs = searchTerm === '' ? 0 : 300
    setLoadingProjects(true)
    const timer = setTimeout(async () => {
      const { list, unauthorized, _debug } = await listAccessibleProjects(searchTerm.trim() || undefined, true)
      setProjectsList(list as ProjectSummary[])
      setProjectsListUnauthorized(!!unauthorized)
      if (_debug) setProjectsListDebug({ userId: _debug.userId, myProjectIdsCount: _debug.myProjectIdsCount, totalProjectsWithMembers: _debug.totalProjectsWithMembers })
      setLoadingProjects(false)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [searchTerm, modalOpen])

  const [savingCopy, setSavingCopy] = useState(false)

  const openCopy = async () => {
    setCopyNome(projectData.nome ? `${projectData.nome} (cópia)` : '')
    setCopyAgencia(projectData.agencia || '')
    setCopyCliente(projectData.cliente || '')
    setCopyDuracao(projectData.duracao || '')
    setCopyDuracaoUnit(projectData.duracaoUnit || 'segundos')
    setModalOpen('copia')
    setProfilesLoading(true)
    const list = await listProfiles()
    setProfiles(list as { id: string; name: string; surname: string; email: string; role: string }[])
    const memberIds = projectDbId ? await getProjectMembers(projectDbId) : []
    const ids = memberIds.length > 0 ? new Set(memberIds) : new Set(list.filter((p) => PROJECT_AUTO_INCLUDE_ROLES.includes(p.role as 'admin' | 'atendimento' | 'crew')).map((p) => p.id))
    if (currentUserId) ids.add(currentUserId)
    setSelectedMemberIds(ids)
    setProfilesLoading(false)
  }

  const handleCreateCopy = async () => {
    if (!copyNome.trim()) return
    setSavingCopy(true)
    await onSaveCopy({
      nome: copyNome.trim(),
      agencia: copyAgencia.trim(),
      cliente: copyCliente.trim(),
      duracao: copyDuracao.trim(),
      duracaoUnit: copyDuracaoUnit,
      memberIds: Array.from(selectedMemberIds),
    })
    setSavingCopy(false)
    closeModal()
  }

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasProject = !!projectData.nome
  const hideAllActions = showOnlyLogout
  const hideButton = (id: string) => restrictedHeaderButtons.includes(id)
  const jobIdDisplay = `JOB #${projectData.jobId || 'BZ0000'}`
  const displayName = loadingOpen ? 'Carregando projeto...' : (hasProject ? projectData.nome.toUpperCase() : 'NOME DO PROJETO')
  const displaySubline = loadingOpen ? '' : (hasProject
    ? `${projectData.agencia || '—'} • ${projectData.cliente || '—'}`
    : 'AGÊNCIA • CLIENTE')

  const Sep = () => <div className="w-px flex-shrink-0 self-center mx-2" style={{ height: 32, backgroundColor: resolve.border }} aria-hidden />

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 py-2 sm:h-[72px] border-b min-h-[72px]"
      style={{
        backgroundColor: resolve.panel,
        borderColor: resolve.border,
        paddingLeft: 'var(--page-gutter)',
        paddingRight: 'var(--page-gutter)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}
    >
      {/* Esquerda: logo | CineBuddy | JOB # | projeto — separadores verticais padronizados */}
      <div className="flex items-center justify-between sm:justify-start min-w-0 flex-1 sm:flex-initial">
        <div className="flex items-center flex-shrink-0" style={{ opacity: hasProject ? 1 : 0.5 }}>
          {/* Logo empresa */}
          <div className="flex items-center justify-center pr-2">
            <div className="w-9 h-9 rounded flex items-center justify-center font-bold text-[10px] overflow-hidden" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                'CB'
              )}
            </div>
          </div>
          <Sep />
          <div className="flex items-center pl-2 pr-2">
            <img src="/cinebuddy-logo.png" alt="CineBuddy" className="w-auto object-contain" style={{ width: 145, height: 68, maxHeight: 68 }} />
          </div>
          <div className="hidden sm:flex items-center">
            <Sep />
            <div className="pl-2 pr-2">
              <span className="font-mono text-sm font-semibold whitespace-nowrap" style={{ color: resolve.text }}>{jobIdDisplay}</span>
            </div>
            <Sep />
            <div className="flex items-center text-center text-xs pl-2 pr-2 py-1.5 min-w-0">
              <div className="w-full min-w-0">
                <strong className="block font-medium truncate" style={{ color: resolve.accent }}>{displayName}</strong>
                <span className="block truncate mt-0.5" style={{ color: resolve.muted }}>{displaySubline}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Botões mobile */}
        <div className="flex flex-wrap gap-1.5 sm:hidden justify-end items-center">
          {!hideAllActions && (
            <>
              {!hideButton('novo') && <button type="button" onClick={openNew} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Novo</button>}
              {!hideButton('abrir') && <button type="button" onClick={openAbrir} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><FolderOpen size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Abrir</button>}
              {!hideButton('salvarCopia') && <button type="button" onClick={openCopy} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><Copy size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Cópia</button>}
              {!hideButton('salvar') && <button type="button" onClick={onSave} disabled={saving} className={`btn-resolve-hover h-7 px-2 text-xs font-medium uppercase rounded flex items-center gap-1`} style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{saving ? '...' : 'Salvar'}</button>}
            </>
          )}
          {onLogout && <button type="button" onClick={onLogout} disabled={loggingOut} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><LogOut size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{loggingOut ? 'Saindo...' : 'Sair'}</button>}
          {!hideAllActions && !hideButton('config') && onOpenConfig && (
            <>
              <Sep />
              <button type="button" onClick={onOpenConfig} aria-label="Configurações" className="flex items-center justify-center w-8 h-8 rounded transition-colors" style={{ color: resolve.muted }} onMouseEnter={(e) => { e.currentTarget.style.color = resolve.yellow }} onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}>
                <Settings size={18} strokeWidth={1.5} aria-hidden style={{ color: 'currentColor' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Direita: botões desktop + Config */}
      <div className="hidden sm:flex gap-1.5 items-center">
        {!hideAllActions && (
          <>
            {!hideButton('novo') && <button type="button" onClick={openNew} className={`${btnBaseCls} flex items-center gap-1.5`} style={btnBaseStyle}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Novo</button>}
            {!hideButton('abrir') && <button type="button" onClick={openAbrir} className={`${btnBaseCls} flex items-center gap-1.5`} style={btnBaseStyle}><FolderOpen size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Abrir</button>}
            {!hideButton('salvarCopia') && <button type="button" onClick={openCopy} className={`${btnBaseCls} flex items-center gap-1.5`} style={btnBaseStyle}><Copy size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Cópia</button>}
            {!hideButton('salvar') && <button type="button" onClick={onSave} disabled={saving} className="btn-resolve-hover h-7 px-3 text-xs font-medium uppercase tracking-wide rounded flex items-center gap-1.5" style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{saving ? 'Salvando...' : 'Salvar'}</button>}
          </>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} disabled={loggingOut} className="btn-resolve-hover h-7 px-3 text-xs font-medium uppercase tracking-wide rounded ml-1 flex items-center gap-1.5" style={{ backgroundColor: 'transparent', color: resolve.muted, borderColor: resolve.border }}><LogOut size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{loggingOut ? 'Saindo...' : 'Sair'}</button>
        )}
        {!hideAllActions && !hideButton('config') && onOpenConfig && (
          <>
            <Sep />
            <button
              type="button"
              onClick={onOpenConfig}
              aria-label="Configurações"
              className="flex items-center justify-center w-8 h-8 rounded transition-colors"
              style={{ color: resolve.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.color = resolve.yellow }}
              onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}
            >
              <Settings size={18} strokeWidth={1.5} aria-hidden style={{ color: 'currentColor' }} />
            </button>
          </>
        )}
      </div>

      {/* ═══════ MODAL: NOVO PROJETO ═══════ */}
      {modalOpen === 'novo' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={modalTitleStyle}><Plus size={18} strokeWidth={2} style={{ color: 'currentColor' }} aria-hidden />NOVO PROJETO</h3>
              <button type="button" onClick={closeModal} className="p-1 rounded transition-colors" style={{ color: resolve.muted }} aria-label="Fechar" onMouseEnter={(e) => { e.currentTarget.style.color = cinema.danger }} onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}><X size={18} strokeWidth={2} style={{ color: 'currentColor' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Nome</label>
                <input type="text" className="w-full px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Nome do projeto" autoFocus />
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Agência</label>
                <input type="text" className="w-full px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={newAgencia} onChange={(e) => setNewAgencia(e.target.value)} />
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Cliente</label>
                <input type="text" className="w-full px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={newCliente} onChange={(e) => setNewCliente(e.target.value)} />
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Duração</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={newDuracao} onChange={(e) => setNewDuracao(e.target.value)} placeholder="0" />
                  <select className="w-16 px-1 py-1.5 text-sm rounded border text-center" style={modalInputStyle} value={newDuracaoUnit} onChange={(e) => setNewDuracaoUnit(e.target.value as 'segundos' | 'minutos')}>
                    <option value="segundos">Sec.</option>
                    <option value="minutos">Min.</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Usuários com acesso</label>
                <div className="max-h-28 overflow-y-auto rounded border p-2 space-y-1" style={{ backgroundColor: resolve.bg, borderColor: resolve.border }}>
                  {profilesLoading ? <span className="text-[11px]" style={{ color: resolve.muted }}>Carregando...</span> : profiles.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input type="checkbox" checked={selectedMemberIds.has(p.id)} onChange={() => toggleMember(p.id)} />
                      <span style={{ color: resolve.text }}>{[p.name, p.surname].filter(Boolean).join(' ') || p.email}</span>
                      <span style={{ color: resolve.muted }}>({PROFILE_LABELS[p.role as keyof typeof PROFILE_LABELS] ?? p.role})</span>
                    </label>
                  ))}
                  {!profilesLoading && profiles.length === 0 && <span className="text-[11px]" style={{ color: resolve.muted }}>Nenhum usuário.</span>}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={handleCreateNew} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded" style={modalPrimaryBtnStyle} title="Criar projeto">Criar projeto</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODAL: ABRIR PROJETO ═══════ */}
      {modalOpen === 'abrir' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={modalTitleStyle}><FolderOpen size={18} strokeWidth={2} style={{ color: 'currentColor' }} aria-hidden />ABRIR PROJETO</h3>
              <button type="button" onClick={closeModal} className="p-1 rounded transition-colors" style={{ color: resolve.muted }} aria-label="Fechar" onMouseEnter={(e) => { e.currentTarget.style.color = cinema.danger }} onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}><X size={18} strokeWidth={2} style={{ color: 'currentColor' }} /></button>
            </div>
            <div className="p-4">
              <input type="text" className="w-full px-2 py-1.5 text-sm rounded border mb-3" style={modalInputStyle} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." autoFocus />
              <div className="min-h-[120px] max-h-[300px] overflow-y-auto" style={{ color: resolve.text }}>
                {loadingProjects ? (
                  <div className="flex items-center justify-center h-[120px] text-xs" style={{ color: resolve.muted }}>Carregando...</div>
                ) : projectsListUnauthorized ? (
                  <div className="flex flex-col items-center justify-center h-[120px] text-xs text-center px-2" style={{ color: resolve.muted }}>
                    <span style={{ color: cinema.danger }}>Sessão expirada ou não autorizado.</span>
                    <span className="mt-2 text-[11px]">Faça logout e entre novamente em <strong>cinebuddy.buzzccs.com.br</strong> para ver seus projetos.</span>
                  </div>
                ) : projectsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[120px] text-xs text-center px-2 py-3" style={{ color: resolve.muted }}>
                    <span>Nenhum projeto encontrado.</span>
                    <span className="mt-2 text-[11px]">Se você deveria ter acesso, peça ao administrador para ir em Configurações → Usuários, abrir seu usuário, marcar os projetos em &quot;Projetos com acesso&quot; e clicar em Salvar.</span>
                    {projectsListDebug && projectsListDebug.myProjectIdsCount === 0 && projectsListDebug.totalProjectsWithMembers > 0 && (
                      <p className="mt-3 text-[10px] font-mono px-2 py-1.5 rounded border break-all" style={{ borderColor: resolve.border, backgroundColor: resolve.bg, color: resolve.text }}>
                        Para o administrador: user_id = <span className="select-all">{projectsListDebug.userId}</span>
                        <br />Projetos atribuídos a você: 0. No Supabase (SQL Editor), use este id no script <code className="text-[9px]">fix_user_project_access.sql</code>.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {projectsList.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 rounded border transition-colors"
                        style={{ borderColor: resolve.border, backgroundColor: resolve.bg }}
                        onClick={() => { onOpenProject(p.id); closeModal() }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = resolve.accent }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = resolve.border }}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-medium" style={{ color: resolve.text }}>{p.nome}</strong>
                          <span className="text-[10px]" style={{ color: resolve.muted }}>#{p.job_id}</span>
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: resolve.muted }}>
                          {p.agencia || '—'} • {p.cliente || '—'}
                          <span className="ml-2">{new Date(p.updated_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-3">
                <button type="button" onClick={closeModal} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={modalPrimaryBtnStyle} title="Fechar">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODAL: SALVAR CÓPIA ═══════ */}
      {modalOpen === 'copia' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={modalTitleStyle}><Copy size={18} strokeWidth={2} style={{ color: 'currentColor' }} aria-hidden />SALVAR CÓPIA</h3>
              <button type="button" onClick={closeModal} className="p-1 rounded transition-colors" style={{ color: resolve.muted }} aria-label="Fechar" onMouseEnter={(e) => { e.currentTarget.style.color = cinema.danger }} onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}><X size={18} strokeWidth={2} style={{ color: 'currentColor' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Nome da cópia</label>
                <input type="text" className="w-full px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={copyNome} onChange={(e) => setCopyNome(e.target.value)} placeholder="Ex: Job v2" autoFocus />
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Agência</label>
                <input type="text" className="w-full px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={copyAgencia} onChange={(e) => setCopyAgencia(e.target.value)} />
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Cliente</label>
                <input type="text" className="w-full px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={copyCliente} onChange={(e) => setCopyCliente(e.target.value)} />
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Duração</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 px-2 py-1.5 text-sm rounded border" style={modalInputStyle} value={copyDuracao} onChange={(e) => setCopyDuracao(e.target.value)} placeholder="0" />
                  <select className="w-16 px-1 py-1.5 text-sm rounded border text-center" style={modalInputStyle} value={copyDuracaoUnit} onChange={(e) => setCopyDuracaoUnit(e.target.value as 'segundos' | 'minutos')}>
                    <option value="segundos">Sec.</option>
                    <option value="minutos">Min.</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={modalLabelCls} style={{ color: resolve.muted }}>Usuários com acesso</label>
                <div className="max-h-28 overflow-y-auto rounded border p-2 space-y-1" style={{ backgroundColor: resolve.bg, borderColor: resolve.border }}>
                  {profilesLoading ? <span className="text-[11px]" style={{ color: resolve.muted }}>Carregando...</span> : profiles.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input type="checkbox" checked={selectedMemberIds.has(p.id)} onChange={() => toggleMember(p.id)} />
                      <span style={{ color: resolve.text }}>{[p.name, p.surname].filter(Boolean).join(' ') || p.email}</span>
                      <span style={{ color: resolve.muted }}>({PROFILE_LABELS[p.role as keyof typeof PROFILE_LABELS] ?? p.role})</span>
                    </label>
                  ))}
                  {!profilesLoading && profiles.length === 0 && <span className="text-[11px]" style={{ color: resolve.muted }}>Nenhum usuário.</span>}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={handleCreateCopy} disabled={savingCopy} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded" style={modalPrimaryBtnStyle}>{savingCopy ? 'Salvando...' : 'Criar cópia'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
