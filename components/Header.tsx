'use client'

import { useState, useCallback, useEffect } from 'react'
import { Settings, Plus, FolderOpen, Copy, Save, LogOut, X } from 'lucide-react'
import { resolve, cinema } from '@/lib/theme'
import type { ProjectData } from '@/lib/types'
import { listProjects, searchProjects } from '@/lib/services/projects'

/* ── Estilos reutilizáveis ── */
const modalInputStyle = { backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }
const modalLabelCls = 'block text-[11px] uppercase text-left mb-0.5'
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
  onNewProject: (data: { nome: string; agencia: string; cliente: string; duracao: string; duracaoUnit: 'segundos' | 'minutos' }) => void | Promise<void>
  onSave: () => void
  onSaveCopy: (data: { nome: string; agencia: string; cliente: string; duracao: string; duracaoUnit: 'segundos' | 'minutos' }) => Promise<void>
  onOpenProject: (id: string) => void
  saving?: boolean
  onLogout?: () => void
  onOpenConfig?: () => void
}

export default function Header({ projectData, logoUrl, onNewProject, onSave, onSaveCopy, onOpenProject, saving = false, onLogout, onOpenConfig }: HeaderProps) {
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

  const closeModal = useCallback(() => setModalOpen(null), [])

  const openNew = () => {
    setNewNome(''); setNewAgencia(''); setNewCliente(''); setNewDuracao(''); setNewDuracaoUnit('segundos')
    setModalOpen('novo')
  }

  const handleCreateNew = async () => {
    if (!newNome.trim()) return
    await onNewProject({ nome: newNome.trim(), agencia: newAgencia.trim(), cliente: newCliente.trim(), duracao: newDuracao.trim(), duracaoUnit: newDuracaoUnit })
    closeModal()
  }

  const openAbrir = async () => {
    setSearchTerm('')
    setModalOpen('abrir')
    setLoadingProjects(true)
    const list = await listProjects()
    setProjectsList(list as ProjectSummary[])
    setLoadingProjects(false)
  }

  useEffect(() => {
    if (modalOpen !== 'abrir') return
    const timer = setTimeout(async () => {
      setLoadingProjects(true)
      const list = searchTerm ? await searchProjects(searchTerm) : await listProjects()
      setProjectsList(list as ProjectSummary[])
      setLoadingProjects(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, modalOpen])

  const [savingCopy, setSavingCopy] = useState(false)

  const openCopy = () => {
    // Pré-preenche com os dados do projeto atual + sufixo " (cópia)"
    setCopyNome(projectData.nome ? `${projectData.nome} (cópia)` : '')
    setCopyAgencia(projectData.agencia || '')
    setCopyCliente(projectData.cliente || '')
    setCopyDuracao(projectData.duracao || '')
    setCopyDuracaoUnit(projectData.duracaoUnit || 'segundos')
    setModalOpen('copia')
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
    })
    setSavingCopy(false)
    closeModal()
  }

  const hasProject = !!projectData.nome
  const jobIdDisplay = `JOB #${projectData.jobId || 'BZ0000'}`
  const displayName = hasProject ? projectData.nome.toUpperCase() : 'NOME DO PROJETO'
  const displaySubline = hasProject
    ? `${projectData.agencia || '—'} • ${projectData.cliente || '—'}`
    : 'AGÊNCIA • CLIENTE'

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 py-2 sm:h-[72px] border-b min-h-[72px]"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.border, paddingLeft: 'var(--page-gutter)', paddingRight: 'var(--page-gutter)' }}
    >
      {/* Esquerda: logo */}
      <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded flex items-center justify-center font-bold text-[10px] flex-shrink-0 overflow-hidden" style={{ backgroundColor: resolve.accent, color: resolve.bg }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              'CB'
            )}
          </div>
          <img src="/cinebuddy-logo.png" alt="CineBuddy" className="w-auto object-contain" style={{ width: 145, height: 68, maxHeight: 68 }} />
        </div>
        {/* Botões mobile */}
        <div className="flex flex-wrap gap-1.5 sm:hidden justify-end items-center">
          <button type="button" onClick={openNew} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Novo</button>
          <button type="button" onClick={openAbrir} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><FolderOpen size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Abrir</button>
          <button type="button" onClick={openCopy} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><Copy size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Salvar cópia</button>
          <button type="button" onClick={onSave} disabled={saving} className={`btn-resolve-hover h-7 px-2 text-xs font-medium uppercase rounded flex items-center gap-1`} style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{saving ? '...' : 'Salvar'}</button>
          {onLogout && <button type="button" onClick={onLogout} className={`${btnBaseClsMobile} flex items-center gap-1`} style={btnBaseStyle}><LogOut size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Sair</button>}
          {onOpenConfig && (
            <div className="flex items-center pl-2 ml-1 border-l" style={{ borderColor: resolve.border }}>
              <button type="button" onClick={onOpenConfig} aria-label="Configurações" className="flex items-center justify-center w-8 h-8 rounded transition-colors" style={{ color: resolve.muted }} onMouseEnter={(e) => { e.currentTarget.style.color = resolve.yellow }} onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}>
                <Settings size={18} strokeWidth={1.5} aria-hidden style={{ color: 'currentColor' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Centro: ID do job + box (nome do projeto / agência • cliente) */}
      <div className="hidden sm:flex items-stretch min-w-0" style={{ opacity: hasProject ? 1 : 0.5 }}>
        <div className="flex items-center border-l pl-3 pr-3 md:pl-4 md:pr-4" style={{ borderColor: resolve.border }}>
          <span className="font-mono text-sm font-semibold whitespace-nowrap" style={{ color: resolve.text }}>{jobIdDisplay}</span>
        </div>
        <div className="flex items-center border-l border-r text-center text-xs px-4 md:px-5 py-1.5 min-w-0" style={{ borderColor: resolve.border }}>
          <div className="w-full min-w-0">
            <strong className="block font-medium truncate" style={{ color: resolve.accent }}>{displayName}</strong>
            <span className="block truncate mt-0.5" style={{ color: resolve.muted }}>{displaySubline}</span>
          </div>
        </div>
      </div>

      {/* Direita: botões desktop + Config */}
      <div className="hidden sm:flex gap-1.5 items-center">
        <button type="button" onClick={openNew} className={`${btnBaseCls} flex items-center gap-1.5`} style={btnBaseStyle}><Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Novo</button>
        <button type="button" onClick={openAbrir} className={`${btnBaseCls} flex items-center gap-1.5`} style={btnBaseStyle}><FolderOpen size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Abrir</button>
        <button type="button" onClick={openCopy} className={`${btnBaseCls} flex items-center gap-1.5`} style={btnBaseStyle}><Copy size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Salvar cópia</button>
        <button type="button" onClick={onSave} disabled={saving} className="btn-resolve-hover h-7 px-3 text-xs font-medium uppercase tracking-wide rounded flex items-center gap-1.5" style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}><Save size={14} strokeWidth={2} style={{ color: 'currentColor' }} />{saving ? 'Salvando...' : 'Salvar'}</button>
        {onLogout && (
          <button type="button" onClick={onLogout} className="btn-resolve-hover h-7 px-3 text-xs font-medium uppercase tracking-wide rounded ml-1 flex items-center gap-1.5" style={{ backgroundColor: 'transparent', color: resolve.muted, borderColor: resolve.border }}><LogOut size={14} strokeWidth={2} style={{ color: 'currentColor' }} />Sair</button>
        )}
        {onOpenConfig && (
          <div className="flex items-center pl-3 ml-2 border-l" style={{ borderColor: resolve.border }}>
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
          </div>
        )}
      </div>

      {/* ═══════ MODAL: NOVO PROJETO ═══════ */}
      {modalOpen === 'novo' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="rounded border p-0 w-full max-w-md shadow-lg overflow-hidden" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: resolve.border }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: resolve.text }}><Plus size={18} strokeWidth={2} style={{ color: 'currentColor' }} aria-hidden />NOVO PROJETO</h3>
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
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={handleCreateNew} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }} title="Criar projeto">Criar projeto</button>
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
              <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: resolve.text }}><FolderOpen size={18} strokeWidth={2} style={{ color: 'currentColor' }} aria-hidden />ABRIR PROJETO</h3>
              <button type="button" onClick={closeModal} className="p-1 rounded transition-colors" style={{ color: resolve.muted }} aria-label="Fechar" onMouseEnter={(e) => { e.currentTarget.style.color = cinema.danger }} onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}><X size={18} strokeWidth={2} style={{ color: 'currentColor' }} /></button>
            </div>
            <div className="p-4">
              <input type="text" className="w-full px-2 py-1.5 text-sm rounded border mb-3" style={modalInputStyle} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." autoFocus />
              <div className="min-h-[120px] max-h-[300px] overflow-y-auto" style={{ color: resolve.text }}>
                {loadingProjects ? (
                  <div className="flex items-center justify-center h-[120px] text-xs" style={{ color: resolve.muted }}>Carregando...</div>
                ) : projectsList.length === 0 ? (
                  <div className="flex items-center justify-center h-[120px] text-xs" style={{ color: resolve.muted }}>Nenhum projeto encontrado.</div>
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
                <button type="button" onClick={closeModal} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }} title="Fechar">Fechar</button>
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
              <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: resolve.text }}><Copy size={18} strokeWidth={2} style={{ color: 'currentColor' }} aria-hidden />SALVAR CÓPIA</h3>
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
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}>Cancelar</button>
                <button type="button" onClick={handleCreateCopy} disabled={savingCopy} className="btn-resolve-hover h-8 px-3 text-xs font-medium uppercase rounded" style={{ backgroundColor: resolve.yellowDark, color: resolve.bg, borderColor: resolve.yellow }}>{savingCopy ? 'Salvando...' : 'Criar cópia'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
