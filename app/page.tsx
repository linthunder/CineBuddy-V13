'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import LoginScreen from '@/components/LoginScreen'
import Header from '@/components/Header'
import BottomNav, { type ViewId } from '@/components/BottomNav'
import ViewFilme from '@/components/views/ViewFilme'
import ViewOrcamento, { type ViewOrcamentoHandle } from '@/components/views/ViewOrcamento'
import ViewOrcFinal, { type ViewOrcFinalHandle } from '@/components/views/ViewOrcFinal'
import ViewFechamento, { type ViewFechamentoHandle } from '@/components/views/ViewFechamento'
import ViewDashboard, { type DashboardAllData } from '@/components/views/ViewDashboard'
import ViewTeam from '@/components/views/ViewTeam'
import ViewConfig from '@/components/views/ViewConfig'
import type { ProjectStatus, ProjectData, BudgetLinesByPhase, VerbaLinesByPhase, MiniTablesData } from '@/lib/types'
import { createProject, updateProject, getProject, type ProjectRecord } from '@/lib/services/projects'
import { getCompany } from '@/lib/services/company'

export type BudgetSnapshot = {
  budgetLines: BudgetLinesByPhase
  verbaLines: VerbaLinesByPhase
  miniTables: MiniTablesData
  jobValue: number
  taxRate: number
  notes: Record<'pre' | 'prod' | 'pos', string>
}

async function getNextJobId(): Promise<string> {
  const res = await fetch('/api/next-job-id')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? 'Falha ao obter próximo ID')
  }
  const { jobId } = await res.json()
  return jobId ?? ''
}

const EMPTY_PROJECT: ProjectData = {
  jobId: '',
  nome: '',
  agencia: '',
  cliente: '',
  duracao: '',
  duracaoUnit: 'segundos',
}

export default function Home() {
  const { user, loading, logout, profile, forceFinishLoading } = useAuth()
  const [currentView, setCurrentView] = useState<ViewId>('filme')
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>({
    initial: 'open',
    final: 'open',
    closing: 'open',
  })

  /* Dados do projeto */
  const [projectData, setProjectData] = useState<ProjectData>({ ...EMPTY_PROJECT })
  /** ID do registro no Supabase (null = projeto ainda não salvo) */
  const [projectDbId, setProjectDbId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /* Logo da empresa */
  const [companyLogoUrl, setCompanyLogoUrl] = useState('')

  useEffect(() => {
    getCompany().then((data) => {
      if (data?.logo_url) setCompanyLogoUrl(data.logo_url)
    })
  }, [])

  /* Refs para acessar o estado interno dos views */
  const viewOrcRef = useRef<ViewOrcamentoHandle>(null)
  const viewOrcFinalRef = useRef<ViewOrcFinalHandle>(null)
  const viewFechamentoRef = useRef<ViewFechamentoHandle>(null)

  /* Criar novo projeto (modal NOVO) */
  const handleNewProject = useCallback(async (data: { nome: string; agencia: string; cliente: string; duracao: string; duracaoUnit: 'segundos' | 'minutos' }) => {
    const jobId = await getNextJobId()
    setProjectData({
      jobId,
      nome: data.nome,
      agencia: data.agencia,
      cliente: data.cliente,
      duracao: data.duracao,
      duracaoUnit: data.duracaoUnit,
    })
    setProjectDbId(null)
    setProjectStatus({ initial: 'open', final: 'open', closing: 'open' })
    setInitialSnapshot(null)
    setFinalSnapshot(null)
    // Reset views via refs
    viewOrcRef.current?.loadState({
      budgetLines: { pre: {}, prod: {}, pos: {} },
      verbaLines: { pre: {}, prod: {}, pos: {} },
      miniTables: { contingencia: 0, crt: 0, bvagencia: 0 },
      jobValue: 0,
      taxRate: 12.5,
      notes: { pre: '', prod: '', pos: '' },
    })
    viewOrcFinalRef.current?.loadState({
      budgetLines: { pre: {}, prod: {}, pos: {} },
      verbaLines: { pre: {}, prod: {}, pos: {} },
      miniTables: { contingencia: 0, crt: 0, bvagencia: 0 },
      notes: { pre: '', prod: '', pos: '' },
    })
    viewFechamentoRef.current?.loadState({ closingLines: [], expenses: [] })
    setCurrentView('filme')
  }, [])

  /* Snapshots para cascata: Inicial → Final → Fechamento */
  const [initialSnapshot, setInitialSnapshot] = useState<BudgetSnapshot | null>(null)
  const [finalSnapshot, setFinalSnapshot] = useState<BudgetSnapshot | null>(null)

  /** Referência para o handleSave (usada nas funções de lock para auto-save) */
  const handleSaveRef = useRef<() => Promise<void>>()

  const handleToggleLockInitial = useCallback((snapshot: BudgetSnapshot) => {
    setProjectStatus((prev) => {
      if (prev.initial === 'locked') {
        // Reabrindo: volta a cascata — bloqueia acesso ao Orçamento Final e ao Fechamento
        return { ...prev, initial: 'open', final: 'open', closing: 'open' }
      }
      // Finalizando: libera acesso ao Orçamento Final
      return { ...prev, initial: 'locked', final: 'open' }
    })
    // Sempre atualiza o snapshot (fora do updater para evitar side-effects)
    setInitialSnapshot(snapshot)
    // Auto-save após finalizar
    setTimeout(() => handleSaveRef.current?.(), 100)
  }, [])

  const handleToggleLockFinal = useCallback((snapshot: BudgetSnapshot) => {
    setProjectStatus((prev) => {
      if (prev.final === 'locked') {
        // Reabrindo: só destrava edição; não altera closing (só CONCLUIR FECHAMENTO bloqueia páginas)
        return { ...prev, final: 'open', closing: 'open' }
      }
      // Finalizando: libera acesso ao Fechamento
      return { ...prev, final: 'locked', closing: 'open' }
    })
    setFinalSnapshot(snapshot)
    // Auto-save após finalizar
    setTimeout(() => handleSaveRef.current?.(), 100)
  }, [])

  const handleToggleLockClosing = useCallback(() => {
    setProjectStatus((prev) => {
      if (prev.closing === 'locked') {
        return { ...prev, closing: 'open' }
      }
      return { ...prev, closing: 'locked' }
    })
    setTimeout(() => handleSaveRef.current?.(), 100)
  }, [])

  /* ══════════════════════════════════════════════════════
   * SALVAR PROJETO
   * ══════════════════════════════════════════════════════ */
  const handleSave = useCallback(async () => {
    if (!projectData.nome) {
      if (typeof window !== 'undefined') window.alert('Crie um projeto primeiro (botão NOVO).')
      return
    }

    setSaving(true)
    try {
      // Coletar estado de todos os views
      const orcState = viewOrcRef.current?.getState()
      const orcFinalState = viewOrcFinalRef.current?.getState()
      const fechamentoState = viewFechamentoRef.current?.getState()

      const payload = {
        job_id: projectData.jobId,
        nome: projectData.nome,
        agencia: projectData.agencia,
        cliente: projectData.cliente,
        duracao: projectData.duracao,
        duracao_unit: projectData.duracaoUnit,
        cache_table_id: orcState?.cacheTableId ?? null,
        // Status
        status: projectStatus as unknown as Record<string, string>,
        // Orçamento Inicial
        budget_lines_initial: (orcState?.budgetLines ?? {}) as unknown as Record<string, unknown>,
        verba_lines_initial: (orcState?.verbaLines ?? {}) as unknown as Record<string, unknown>,
        mini_tables: (orcState?.miniTables ?? { contingencia: 0, crt: 0, bvagencia: 0 }) as unknown as Record<string, number>,
        job_value: orcState?.jobValue ?? 0,
        tax_rate: orcState?.taxRate ?? 12.5,
        notes_initial: (orcState?.notes ?? { pre: '', prod: '', pos: '' }) as unknown as Record<string, string>,
        // Orçamento Final
        budget_lines_final: (orcFinalState?.budgetLines ?? {}) as unknown as Record<string, unknown>,
        verba_lines_final: (orcFinalState?.verbaLines ?? {}) as unknown as Record<string, unknown>,
        mini_tables_final: (orcFinalState?.miniTables ?? { contingencia: 0, crt: 0, bvagencia: 0 }) as unknown as Record<string, number>,
        job_value_final: orcState?.jobValue ?? 0,
        tax_rate_final: orcState?.taxRate ?? 12.5,
        notes_final: (orcFinalState?.notes ?? { pre: '', prod: '', pos: '' }) as unknown as Record<string, string>,
        // Fechamento
        closing_lines: (fechamentoState ? [fechamentoState.closingLines, fechamentoState.expenses, fechamentoState.saving ?? null] : []) as unknown[],
      }

      let result: ProjectRecord | null
      if (projectDbId) {
        result = await updateProject(projectDbId, payload)
      } else {
        result = await createProject(payload)
      }

      if (result) {
        setProjectDbId(result.id)
        if (typeof window !== 'undefined') window.alert('Projeto salvo com sucesso!')
      } else {
        if (typeof window !== 'undefined') window.alert('Erro ao salvar. Verifique o console.')
      }
    } finally {
      setSaving(false)
    }
  }, [projectData, projectStatus, projectDbId])

  // Manter ref atualizada para o auto-save nos toggleLock
  handleSaveRef.current = handleSave

  /* ══════════════════════════════════════════════════════
   * SALVAR CÓPIA
   * ══════════════════════════════════════════════════════ */
  const handleSaveCopy = useCallback(async (copyData: { nome: string; agencia: string; cliente: string; duracao: string; duracaoUnit: 'segundos' | 'minutos' }) => {
    // Coletar estado de todos os views (igual ao save normal)
    const orcState = viewOrcRef.current?.getState()
    const orcFinalState = viewOrcFinalRef.current?.getState()
    const fechamentoState = viewFechamentoRef.current?.getState()

    const newJobId = await getNextJobId()

    const payload = {
      job_id: newJobId,
      nome: copyData.nome,
      agencia: copyData.agencia,
      cliente: copyData.cliente,
      duracao: copyData.duracao,
      duracao_unit: copyData.duracaoUnit,
      cache_table_id: orcState?.cacheTableId ?? null,
      status: projectStatus as unknown as Record<string, string>,
      budget_lines_initial: (orcState?.budgetLines ?? {}) as unknown as Record<string, unknown>,
      verba_lines_initial: (orcState?.verbaLines ?? {}) as unknown as Record<string, unknown>,
      mini_tables: (orcState?.miniTables ?? { contingencia: 0, crt: 0, bvagencia: 0 }) as unknown as Record<string, number>,
      job_value: orcState?.jobValue ?? 0,
      tax_rate: orcState?.taxRate ?? 12.5,
      notes_initial: (orcState?.notes ?? { pre: '', prod: '', pos: '' }) as unknown as Record<string, string>,
      budget_lines_final: (orcFinalState?.budgetLines ?? {}) as unknown as Record<string, unknown>,
      verba_lines_final: (orcFinalState?.verbaLines ?? {}) as unknown as Record<string, unknown>,
      mini_tables_final: (orcFinalState?.miniTables ?? { contingencia: 0, crt: 0, bvagencia: 0 }) as unknown as Record<string, number>,
      job_value_final: orcState?.jobValue ?? 0,
      tax_rate_final: orcState?.taxRate ?? 12.5,
      notes_final: (orcFinalState?.notes ?? { pre: '', prod: '', pos: '' }) as unknown as Record<string, string>,
      closing_lines: (fechamentoState ? [fechamentoState.closingLines, fechamentoState.expenses, fechamentoState.saving ?? null] : []) as unknown[],
    }

    // Sempre cria um NOVO projeto (nunca atualiza o existente)
    const result = await createProject(payload)

    if (result) {
      // Atualizar o projeto ativo para a cópia criada
      setProjectDbId(result.id)
      setProjectData({
        jobId: newJobId,
        nome: copyData.nome,
        agencia: copyData.agencia,
        cliente: copyData.cliente,
        duracao: copyData.duracao,
        duracaoUnit: copyData.duracaoUnit,
      })
      if (typeof window !== 'undefined') window.alert('Cópia salva com sucesso! Você agora está trabalhando na cópia.')
    } else {
      if (typeof window !== 'undefined') window.alert('Erro ao criar cópia. Verifique o console.')
    }
  }, [projectStatus])

  /* ══════════════════════════════════════════════════════
   * ABRIR PROJETO
   * ══════════════════════════════════════════════════════ */
  const handleOpenProject = useCallback(async (id: string) => {
    const project = await getProject(id)
    if (!project) {
      if (typeof window !== 'undefined') window.alert('Erro ao carregar projeto.')
      return
    }

    // Restaurar dados do projeto
    setProjectDbId(project.id)
    setProjectData({
      jobId: project.job_id,
      nome: project.nome,
      agencia: project.agencia,
      cliente: project.cliente,
      duracao: project.duracao,
      duracaoUnit: project.duracao_unit as 'segundos' | 'minutos',
    })

    // Restaurar status
    const status = project.status as unknown as ProjectStatus
    setProjectStatus(status)

    // Restaurar snapshots (reconstruir a partir dos dados salvos)
    const orcData = {
      budgetLines: project.budget_lines_initial as unknown as BudgetLinesByPhase,
      verbaLines: project.verba_lines_initial as unknown as VerbaLinesByPhase,
      miniTables: project.mini_tables as unknown as MiniTablesData,
      jobValue: Number(project.job_value) || 0,
      taxRate: Number(project.tax_rate) || 12.5,
      notes: project.notes_initial as unknown as Record<'pre' | 'prod' | 'pos', string>,
      cacheTableId: (project as { cache_table_id?: string | null }).cache_table_id ?? null,
    }

    // Se o orçamento inicial foi finalizado, criar snapshot
    if (status.initial === 'locked') {
      setInitialSnapshot(orcData)
    } else {
      setInitialSnapshot(null)
    }

    const orcFinalData = {
      budgetLines: project.budget_lines_final as unknown as BudgetLinesByPhase,
      verbaLines: project.verba_lines_final as unknown as VerbaLinesByPhase,
      miniTables: project.mini_tables_final as unknown as MiniTablesData,
      notes: project.notes_final as unknown as Record<'pre' | 'prod' | 'pos', string>,
    }

    if (status.final === 'locked') {
      setFinalSnapshot({
        ...orcFinalData,
        jobValue: Number(project.job_value_final) || 0,
        taxRate: Number(project.tax_rate_final) || 12.5,
      })
    } else {
      setFinalSnapshot(null)
    }

    // Restaurar estado dos views via refs (com timeout para garantir que os snapshots foram setados)
    setTimeout(() => {
      viewOrcRef.current?.loadState(orcData)
      viewOrcFinalRef.current?.loadState(orcFinalData)

      // Restaurar fechamento (closing_lines: [closingLines, expenses, saving?])
      const closingData = project.closing_lines as unknown[]
      if (Array.isArray(closingData) && closingData.length >= 2) {
        const rawSaving = closingData[2]
        const saving = rawSaving != null && typeof rawSaving === 'object' && 'items' in rawSaving
          ? (rawSaving as { items: string[]; pct: number; responsibleId: string | null })
          : undefined
        viewFechamentoRef.current?.loadState({
          closingLines: closingData[0] as never[],
          expenses: closingData[1] as never[],
          saving: saving ?? undefined,
        })
      }
    }, 50)

    setCurrentView('filme')
  }, [])

  /* Dados da equipe: lê do orçamento mais avançado disponível */
  const getTeamBudgetData = useCallback(() => {
    // Prioridade: orc-final (se disponível) → orc inicial
    const finalState = viewOrcFinalRef.current?.getState()
    if (finalState && projectStatus.initial === 'locked') {
      return { budgetLines: finalState.budgetLines, verbaLines: finalState.verbaLines }
    }
    const orcState = viewOrcRef.current?.getState()
    if (orcState) {
      return { budgetLines: orcState.budgetLines, verbaLines: orcState.verbaLines }
    }
    return null
  }, [projectStatus])

  /* Dados para o Dashboard */
  const getDashboardData = useCallback((): DashboardAllData => {
    const orcState = viewOrcRef.current?.getState()
    const orcFinalState = viewOrcFinalRef.current?.getState()
    const fechamentoState = viewFechamentoRef.current?.getState()

    const jobValue = orcState?.jobValue ?? 0
    const taxRate = orcState?.taxRate ?? 12.5

    return {
      initial: orcState ? {
        budgetLines: orcState.budgetLines,
        verbaLines: orcState.verbaLines,
        miniTables: orcState.miniTables,
        jobValue,
        taxRate,
      } : null,
      final: orcFinalState ? {
        budgetLines: orcFinalState.budgetLines,
        verbaLines: orcFinalState.verbaLines,
        miniTables: orcFinalState.miniTables,
        jobValue,
        taxRate,
      } : null,
      closing: fechamentoState && fechamentoState.closingLines.length > 0 ? {
        closingLines: fechamentoState.closingLines,
        expenses: fechamentoState.expenses,
        jobValue: initialSnapshot?.jobValue ?? jobValue,
      } : null,
    }
  }, [initialSnapshot])

  const disabledViews = useMemo<ViewId[]>(() => {
    const disabled: ViewId[] = []
    if (!projectData.nome) disabled.push('dashboard')
    // Cascata de liberação: Orçamento Final só após finalizar Inicial; Fechamento só após finalizar Final
    if (projectStatus.initial !== 'locked') disabled.push('orc-final')
    if (projectStatus.final !== 'locked') disabled.push('fechamento')
    // Apenas CONCLUIR FECHAMENTO bloqueia acesso às páginas de orçamento
    if (projectStatus.closing === 'locked') disabled.push('orcamento', 'orc-final')
    return disabled
  }, [projectStatus, projectData.nome])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" style={{ backgroundColor: '#0d0d0f', color: '#8e8e93' }}>
        <span className="text-sm">Carregando...</span>
        <button
          type="button"
          onClick={forceFinishLoading}
          className="text-xs px-3 py-1.5 rounded border"
          style={{ borderColor: '#5c7c99', color: '#5c7c99' }}
        >
          Travou? Clique para continuar
        </button>
      </div>
    )
  }
  if (!user) {
    return <LoginScreen />
  }

  return (
    <>
      <Header
        projectData={projectData}
        logoUrl={companyLogoUrl}
        onNewProject={handleNewProject}
        onSave={handleSave}
        onSaveCopy={handleSaveCopy}
        onOpenProject={handleOpenProject}
        saving={saving}
        onLogout={logout}
      />
      <main
        className="pt-[88px] sm:pt-[88px] pb-20 sm:pb-24 w-full min-h-0 min-w-0"
        style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec', paddingLeft: 'var(--page-gutter-content)', paddingRight: 'var(--page-gutter-content)' }}
      >
        <div style={{ display: currentView === 'filme' ? 'block' : 'none' }}>
          <ViewFilme />
        </div>
        <div style={{ display: currentView === 'orcamento' ? 'block' : 'none' }}>
          <ViewOrcamento
            ref={viewOrcRef}
            isLocked={projectStatus.initial === 'locked'}
            onToggleLock={handleToggleLockInitial}
          />
        </div>
        <div style={{ display: currentView === 'orc-final' ? 'block' : 'none' }}>
          <ViewOrcFinal
            ref={viewOrcFinalRef}
            initialSnapshot={initialSnapshot}
            isLocked={projectStatus.final === 'locked'}
            onToggleLock={handleToggleLockFinal}
          />
        </div>
        <div style={{ display: currentView === 'fechamento' ? 'block' : 'none' }}>
          <ViewFechamento
            ref={viewFechamentoRef}
            finalSnapshot={finalSnapshot}
            initialSnapshot={initialSnapshot}
            initialJobValue={initialSnapshot?.jobValue ?? 0}
            isLocked={projectStatus.closing === 'locked'}
            onToggleLock={handleToggleLockClosing}
          />
        </div>
        <div style={{ display: currentView === 'dashboard' ? 'block' : 'none' }}>
          <ViewDashboard getData={getDashboardData} projectStatus={projectStatus} />
        </div>
        <div style={{ display: currentView === 'team' ? 'block' : 'none' }}>
          <ViewTeam getBudgetData={getTeamBudgetData} />
        </div>
        <div style={{ display: currentView === 'config' ? 'block' : 'none' }}>
          <ViewConfig onLogoChange={setCompanyLogoUrl} currentProfile={profile} isAdmin={profile?.role === 'admin'} />
        </div>
      </main>
      <BottomNav currentView={currentView} onViewChange={setCurrentView} disabledViews={disabledViews} />
    </>
  )
}
