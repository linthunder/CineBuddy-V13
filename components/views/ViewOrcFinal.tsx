'use client'

import { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import PageLayout from '@/components/PageLayout'
import MiniTables from '@/components/MiniTables'
import PhaseDefaultsBar from '@/components/PhaseDefaultsBar'
import BudgetTabs from '@/components/BudgetTabs'
import BudgetDeptBlock from '@/components/BudgetDeptBlock'
import { DEPARTMENTS, VERBA_DEPTS, LABOR_DEPTS, PEOPLE_DEPTS } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency } from '@/lib/utils'
import type { PhaseKey } from '@/lib/constants'
import type { BudgetRow, BudgetRowLabor, BudgetLinesByPhase, MiniTablesData, VerbaRow, VerbaLinesByPhase, PhaseDefaultsByPhase, ProjectData } from '@/lib/types'
import { createEmptyRow, computeRowTotal, createEmptyVerbaRow, computeVerbaRowTotal } from '@/lib/budgetUtils'
import { listCacheTables } from '@/lib/services/cache-tables'

const INITIAL_PHASE_DEFAULTS: PhaseDefaultsByPhase = {
  pre: { dias: 0, semanas: 0, deslocamento: 0, alimentacaoPerPerson: 0 },
  prod: { dias: 0, semanas: 0, deslocamento: 0, alimentacaoPerPerson: 0 },
  pos: { dias: 0, semanas: 0, deslocamento: 0, alimentacaoPerPerson: 0 },
}

interface ViewOrcFinalProps {
  /** Snapshot do orçamento inicial (copiado ao finalizar) */
  initialSnapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    phaseDefaults?: PhaseDefaultsByPhase
    jobValue: number
    taxRate: number
    notes: Record<'pre' | 'prod' | 'pos', string>
    cacheTableId?: string | null
  } | null
  /** Dados do projeto (agência, cliente) para header das tabelas AGÊNCIA/CLIENTE */
  projectData?: ProjectData
  isLocked?: boolean
  onToggleLock?: (snapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    phaseDefaults?: PhaseDefaultsByPhase
    jobValue: number
    taxRate: number
    notes: Record<'pre' | 'prod' | 'pos', string>
    cacheTableId?: string | null
  }) => void
}

export interface ViewOrcFinalHandle {
  getState: () => {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    phaseDefaults: PhaseDefaultsByPhase
    notes: Record<'pre' | 'prod' | 'pos', string>
    cacheTableId: string | null
    jobValue: number
    taxRate: number
  }
  loadState: (state: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    phaseDefaults?: PhaseDefaultsByPhase
    notes: Record<'pre' | 'prod' | 'pos', string>
    cacheTableId?: string | null
  }) => void
}

const ViewOrcFinal = forwardRef<ViewOrcFinalHandle, ViewOrcFinalProps>(function ViewOrcFinal({ initialSnapshot, projectData, isLocked = false, onToggleLock }, ref) {
  const [activePhase, setActivePhase] = useState<PhaseKey>('prod')
  const loadedFromDB = useRef(false)
  const [cacheTables, setCacheTables] = useState<{ id: string; name: string; is_default: boolean }[]>([])

  /* Estado do orçamento final — inicializado a partir do snapshot */
  const [budgetLines, setBudgetLines] = useState<BudgetLinesByPhase>({ pre: {}, prod: {}, pos: {} })
  const [verbaLines, setVerbaLines] = useState<VerbaLinesByPhase>({ pre: {}, prod: {}, pos: {} })
  const [miniTables, setMiniTables] = useState<MiniTablesData>({ contingencia: 0, crt: 0, bvagencia: 0 })
  const [phaseDefaults, setPhaseDefaults] = useState<PhaseDefaultsByPhase>(INITIAL_PHASE_DEFAULTS)
  const [notes, setNotes] = useState<Record<PhaseKey, string>>({ pre: '', prod: '', pos: '' })
  const [cacheTableId, setCacheTableId] = useState<string | null>(null)

  useEffect(() => {
    listCacheTables().then((tables) => {
      setCacheTables(tables)
      if (tables.length > 0 && !cacheTableId) {
        const defaultTable = tables.find((t) => t.is_default) ?? tables[0]
        setCacheTableId(defaultTable.id)
      }
    })
  }, [])

  const initialJobValue = initialSnapshot?.jobValue ?? 0
  const initialTaxRate = initialSnapshot?.taxRate ?? 12.5
  useImperativeHandle(ref, () => ({
    getState: () => ({ budgetLines, verbaLines, miniTables, phaseDefaults, notes, cacheTableId, jobValue: initialJobValue, taxRate: initialTaxRate }),
    loadState: (state) => {
      const hasData = Object.values(state.budgetLines).some((phase) =>
        Object.values(phase).some((rows) => Array.isArray(rows) && rows.length > 0)
      )
      loadedFromDB.current = hasData
      setBudgetLines(state.budgetLines)
      setVerbaLines(state.verbaLines)
      setMiniTables(state.miniTables)
      if (state.phaseDefaults) setPhaseDefaults(state.phaseDefaults)
      setNotes(state.notes)
      if (state.cacheTableId !== undefined) setCacheTableId(state.cacheTableId ?? null)
    },
  }), [budgetLines, verbaLines, miniTables, phaseDefaults, notes, cacheTableId, initialJobValue, initialTaxRate])

  /* Valores fixos do inicial */
  const initialTaxValue = initialJobValue * (initialTaxRate / 100)
  const initialProfitNet = useMemo(() => {
    if (!initialSnapshot) return 0
    let costRows = 0
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const depts = DEPARTMENTS[phase]
      const pl = initialSnapshot.budgetLines[phase]
      const pv = initialSnapshot.verbaLines[phase] ?? {}
      depts.forEach((dept) => {
        ;(pl[dept] ?? []).forEach((r) => { costRows += computeRowTotal(r) })
        ;(pv[dept] ?? []).forEach((v) => { costRows += computeVerbaRowTotal(v) })
      })
    })
    const miniTotal = initialSnapshot.miniTables.contingencia + initialSnapshot.miniTables.crt + initialSnapshot.miniTables.bvagencia
    const totalCostInit = costRows + miniTotal
    return initialJobValue - totalCostInit - initialTaxValue
  }, [initialSnapshot, initialJobValue, initialTaxValue])

  /* Carregar dados do snapshot quando ele chega (skip se carregado do DB) */
  useEffect(() => {
    if (!initialSnapshot) return
    if (loadedFromDB.current) { loadedFromDB.current = false; return }
    const cloneLines: BudgetLinesByPhase = { pre: {}, prod: {}, pos: {} }
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      Object.entries(initialSnapshot.budgetLines[phase]).forEach(([dept, rows]) => {
        cloneLines[phase][dept] = rows.map((r) => ({ ...r, id: r.id + '-f' }))
      })
    })
    const cloneVerbas: VerbaLinesByPhase = { pre: {}, prod: {}, pos: {} }
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      Object.entries(initialSnapshot.verbaLines[phase]).forEach(([dept, rows]) => {
        cloneVerbas[phase][dept] = rows.map((v) => ({ ...v, id: v.id + '-f' }))
      })
    })
    setBudgetLines(cloneLines)
    setVerbaLines(cloneVerbas)
    setMiniTables({ ...initialSnapshot.miniTables })
    setPhaseDefaults(initialSnapshot.phaseDefaults ?? INITIAL_PHASE_DEFAULTS)
    setNotes({ ...initialSnapshot.notes })
    if (initialSnapshot.cacheTableId != null) setCacheTableId(initialSnapshot.cacheTableId)
  }, [initialSnapshot])

  const deptsForPhase = DEPARTMENTS[activePhase]
  const linesForPhase = budgetLines[activePhase]

  /** Mantém a 1ª linha de CATERING sincronizada (alimentação × profissionais × dias). Quando cateringAuto=false (usuário editou manualmente), não sobrescreve. forceUpdate=true (ex: APLICAR) sobrescreve e reativa o auto. */
  const updateFirstCateringRow = useCallback((phase: PhaseKey, lines: BudgetLinesByPhase, alimentacao: number, teamCount: number, dias: number, forceUpdate?: boolean) => {
    if (!(DEPARTMENTS[phase] as readonly string[]).includes('CATERING')) return lines
    const next = { ...lines, [phase]: { ...lines[phase] } }
    let catering = next[phase].CATERING ?? []
    if (catering.length === 0) {
      const firstRow = createEmptyRow('CATERING', { cateringDefaultUnitCost: 0 })
      firstRow.itemName = 'Alimentação'
      catering = [firstRow]
      next[phase].CATERING = catering
    }
    const firstRow = catering[0] as BudgetRow & { cateringAuto?: boolean }
    if (!forceUpdate && firstRow.cateringAuto === false) return next
    const qty = dias > 0 ? dias : 1
    const first = { ...firstRow, unitCost: alimentacao * teamCount, quantity: qty, totalCost: alimentacao * teamCount * qty, cateringAuto: true }
    next[phase].CATERING = [first as BudgetRow, ...catering.slice(1)]
    return next
  }, [])

  const teamCountForPhase = useCallback((phase: PhaseKey): number => {
    let count = 0
    const phaseLines = budgetLines[phase] ?? {}
    LABOR_DEPTS.forEach((d) => {
      (phaseLines[d] ?? []).forEach((r) => { if (r.type === 'labor') count++ })
    })
    ;(phaseLines.CASTING ?? []).forEach((r) => { count += Math.max(0, ('quantity' in r ? r.quantity : 0) || 0) || 1 })
    PEOPLE_DEPTS.forEach((d) => {
      (phaseLines[d] ?? []).forEach((r) => { if (r.type === 'people') count++ })
    })
    return count
  }, [budgetLines])

  useEffect(() => {
    const phasesWithCatering: PhaseKey[] = ['pre', 'prod']
    let needsUpdate = false
    let next = budgetLines
    for (const phase of phasesWithCatering) {
      const alimentacao = phaseDefaults[phase]?.alimentacaoPerPerson ?? 0
      const dias = phaseDefaults[phase]?.dias ?? 0
      let teamCount = 0
      const phaseLines = budgetLines[phase] ?? {}
      LABOR_DEPTS.forEach((d) => {
        (phaseLines[d] ?? []).forEach((r) => { if (r.type === 'labor') teamCount++ })
      })
      ;(phaseLines.CASTING ?? []).forEach((r) => { teamCount += Math.max(0, ('quantity' in r ? r.quantity : 0) || 0) || 1 })
      PEOPLE_DEPTS.forEach((d) => {
        (phaseLines[d] ?? []).forEach((r) => { if (r.type === 'people') teamCount++ })
      })
      const catering = budgetLines[phase]?.CATERING ?? []
      if (catering.length === 0 && alimentacao <= 0) continue
      const expectedUnitCost = alimentacao * teamCount
      const expectedQty = dias > 0 ? dias : 1
      const c0 = catering[0] as { unitCost?: number; quantity?: number; cateringAuto?: boolean } | undefined
      if (c0?.cateringAuto === false) continue
      const currentUnitCost = c0?.unitCost ?? 0
      const currentQty = c0?.quantity ?? 1
      if (Math.abs(currentUnitCost - expectedUnitCost) >= 0.005 || currentQty !== expectedQty) {
        next = updateFirstCateringRow(phase, next, alimentacao, teamCount, dias)
        needsUpdate = true
      }
    }
    if (needsUpdate) setBudgetLines(next)
  }, [phaseDefaults, budgetLines, updateFirstCateringRow])

  /* Custo real = soma de TODAS as fases (linhas + verbas + mini) */
  const totalCostReal = useMemo(() => {
    let sum = 0
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const phaseDepts = DEPARTMENTS[phase]
      const phaseLines = budgetLines[phase]
      const phaseVerbas = verbaLines[phase] ?? {}
      phaseDepts.forEach((dept) => {
        ;(phaseLines[dept] ?? []).forEach((r) => { sum += computeRowTotal(r) })
        ;(phaseVerbas[dept] ?? []).forEach((v) => { sum += computeVerbaRowTotal(v) })
      })
    })
    return sum + miniTables.contingencia + miniTables.crt + miniTables.bvagencia
  }, [budgetLines, verbaLines, miniTables])

  /* Cálculos financeiros do final */
  const profitFinal = initialJobValue - totalCostReal - initialTaxValue
  const profitDiff = profitFinal - initialProfitNet
  const margin = initialJobValue > 0 ? (profitFinal / initialJobValue) * 100 : 0

  /* Handlers CRUD */
  const addRow = useCallback((department: string) => {
    const def = phaseDefaults[activePhase]
    const isCatering = department === 'CATERING'
    const alimentacao = def?.alimentacaoPerPerson ?? 0
    const newRow = createEmptyRow(department, {
      phaseDefaults: def,
      cateringDefaultUnitCost: isCatering ? alimentacao * teamCountForPhase(activePhase) : undefined,
    })
    setBudgetLines((prev) => {
      const next = { ...prev, [activePhase]: { ...prev[activePhase] } }
      const list = next[activePhase][department] ?? []
      next[activePhase][department] = [...list, newRow]
      const isTeamMember = LABOR_DEPTS.includes(department as never) || department === 'CASTING' || PEOPLE_DEPTS.includes(department as never)
      if (isTeamMember && alimentacao > 0) {
        let teamCount = 0
        LABOR_DEPTS.forEach((d) => {
          (next[activePhase][d] ?? []).forEach((r) => { if (r.type === 'labor') teamCount++ })
        })
        ;(next[activePhase].CASTING ?? []).forEach((r) => { teamCount += Math.max(0, ('quantity' in r ? r.quantity : 0) || 0) || 1 })
        PEOPLE_DEPTS.forEach((d) => {
          (next[activePhase][d] ?? []).forEach((r) => { if (r.type === 'people') teamCount++ })
        })
        const dias = phaseDefaults[activePhase]?.dias ?? 0
        return updateFirstCateringRow(activePhase, next, alimentacao, teamCount, dias)
      }
      return next
    })
  }, [activePhase, phaseDefaults, teamCountForPhase, updateFirstCateringRow])

  const updateRow = useCallback((department: string, rowId: string, updates: Partial<BudgetRow>) => {
    const alimentacao = phaseDefaults[activePhase]?.alimentacaoPerPerson ?? 0
    setBudgetLines((prev) => {
      const phaseData = prev[activePhase][department] ?? []
      const row = phaseData.find((r) => r.id === rowId)
      if (!row) return prev
      const merged = { ...row, ...updates } as BudgetRow
      if (merged.type !== 'people') (merged as { totalCost: number }).totalCost = computeRowTotal(merged)
      let next = { ...prev, [activePhase]: { ...prev[activePhase], [department]: phaseData.map((r) => (r.id === rowId ? merged : r)) } }
      if (department === 'CASTING' && 'quantity' in updates && alimentacao > 0) {
        let teamCount = 0
        LABOR_DEPTS.forEach((d) => {
          (next[activePhase][d] ?? []).forEach((r) => { if (r.type === 'labor') teamCount++ })
        })
        ;(next[activePhase].CASTING ?? []).forEach((r) => { teamCount += Math.max(0, ('quantity' in r ? r.quantity : 0) || 0) || 1 })
        PEOPLE_DEPTS.forEach((d) => {
          (next[activePhase][d] ?? []).forEach((r) => { if (r.type === 'people') teamCount++ })
        })
        const dias = phaseDefaults[activePhase]?.dias ?? 0
        next = updateFirstCateringRow(activePhase, next, alimentacao, teamCount, dias)
      }
      return next
    })
  }, [activePhase, phaseDefaults, updateFirstCateringRow])

  const removeRow = useCallback((department: string, rowId: string) => {
    const alimentacao = phaseDefaults[activePhase]?.alimentacaoPerPerson ?? 0
    setBudgetLines((prev) => {
      const phaseData = prev[activePhase][department] ?? []
      const next = { ...prev, [activePhase]: { ...prev[activePhase], [department]: phaseData.filter((r) => r.id !== rowId) } }
      const isTeamMember = LABOR_DEPTS.includes(department as never) || department === 'CASTING' || PEOPLE_DEPTS.includes(department as never)
      if (isTeamMember && alimentacao > 0) {
        let teamCount = 0
        LABOR_DEPTS.forEach((d) => {
          (next[activePhase][d] ?? []).forEach((r) => { if (r.type === 'labor') teamCount++ })
        })
        ;(next[activePhase].CASTING ?? []).forEach((r) => { teamCount += Math.max(0, ('quantity' in r ? r.quantity : 0) || 0) || 1 })
        PEOPLE_DEPTS.forEach((d) => {
          (next[activePhase][d] ?? []).forEach((r) => { if (r.type === 'people') teamCount++ })
        })
        const dias = phaseDefaults[activePhase]?.dias ?? 0
        return updateFirstCateringRow(activePhase, next, alimentacao, teamCount, dias)
      }
      return next
    })
  }, [activePhase, phaseDefaults, updateFirstCateringRow])

  const applyDias = useCallback(() => {
    const val = phaseDefaults[activePhase].dias
    if (val <= 0) return
    setBudgetLines((prev) => {
      const next = { ...prev, [activePhase]: { ...prev[activePhase] } }
      LABOR_DEPTS.forEach((dept) => {
        const rows = next[activePhase][dept] ?? []
        next[activePhase][dept] = rows.map((r) => {
          if (r.type === 'labor' && (r as BudgetRowLabor).unitType === 'dia') {
            const merged = { ...r, quantity: val } as BudgetRowLabor
            merged.totalCost = computeRowTotal(merged)
            return merged
          }
          return r
        })
      })
      return next
    })
  }, [activePhase, phaseDefaults])

  const applySemanas = useCallback(() => {
    const val = phaseDefaults[activePhase].semanas
    if (val <= 0) return
    setBudgetLines((prev) => {
      const next = { ...prev, [activePhase]: { ...prev[activePhase] } }
      LABOR_DEPTS.forEach((dept) => {
        const rows = next[activePhase][dept] ?? []
        next[activePhase][dept] = rows.map((r) => {
          if (r.type === 'labor' && (r as BudgetRowLabor).unitType === 'sem') {
            const merged = { ...r, quantity: val } as BudgetRowLabor
            merged.totalCost = computeRowTotal(merged)
            return merged
          }
          return r
        })
      })
      return next
    })
  }, [activePhase, phaseDefaults])

  const applyDeslocamento = useCallback(() => {
    const val = phaseDefaults[activePhase].deslocamento
    setBudgetLines((prev) => {
      const next = { ...prev, [activePhase]: { ...prev[activePhase] } }
      LABOR_DEPTS.forEach((dept) => {
        const rows = next[activePhase][dept] ?? []
        next[activePhase][dept] = rows.map((r) => {
          if (r.type === 'labor') {
            const merged = { ...r, extraCost: val } as BudgetRowLabor
            merged.totalCost = computeRowTotal(merged)
            return merged
          }
          return r
        })
      })
      return next
    })
  }, [activePhase, phaseDefaults])

  const applyAlimentacao = useCallback(() => {
    const alimentacaoPerPerson = phaseDefaults[activePhase].alimentacaoPerPerson ?? 0
    const dias = phaseDefaults[activePhase]?.dias ?? 0
    const teamCount = teamCountForPhase(activePhase)
    setBudgetLines((prev) => updateFirstCateringRow(activePhase, prev, alimentacaoPerPerson, teamCount, dias, true))
  }, [activePhase, phaseDefaults, teamCountForPhase, updateFirstCateringRow])

  const addVerbaRow = useCallback((department: string) => {
    if (!VERBA_DEPTS.includes(department as (typeof VERBA_DEPTS)[number])) return
    setVerbaLines((prev) => {
      const phaseData = prev[activePhase] ?? {}
      const list = phaseData[department] ?? []
      return { ...prev, [activePhase]: { ...phaseData, [department]: [...list, createEmptyVerbaRow()] } }
    })
  }, [activePhase])

  const updateVerbaRow = useCallback((department: string, rowId: string, updates: Partial<VerbaRow>) => {
    setVerbaLines((prev) => {
      const phaseData = prev[activePhase] ?? {}
      const list = phaseData[department] ?? []
      const row = list.find((r) => r.id === rowId)
      if (!row) return prev
      const merged = { ...row, ...updates }
      merged.totalCost = merged.unitCost * merged.quantity
      return { ...prev, [activePhase]: { ...phaseData, [department]: list.map((r) => (r.id === rowId ? merged : r)) } }
    })
  }, [activePhase])

  const removeVerbaRow = useCallback((department: string, rowId: string) => {
    setVerbaLines((prev) => {
      const phaseData = prev[activePhase] ?? {}
      const list = phaseData[department] ?? []
      return { ...prev, [activePhase]: { ...phaseData, [department]: list.filter((r) => r.id !== rowId) } }
    })
  }, [activePhase])

  const handleToggleLock = useCallback(() => {
    if (onToggleLock) {
      onToggleLock({ budgetLines, verbaLines, miniTables, phaseDefaults, jobValue: initialJobValue, taxRate: initialTaxRate, notes, cacheTableId: cacheTableId ?? null })
    }
  }, [onToggleLock, budgetLines, verbaLines, miniTables, phaseDefaults, initialJobValue, initialTaxRate, notes, cacheTableId])

  if (!initialSnapshot) {
    return (
      <PageLayout title="Orçamento Realizado">
        <div className="text-center py-12" style={{ color: resolve.muted }}>
          <p className="text-sm">Finalize o Orçamento Previsto para acessar o Orçamento Realizado.</p>
        </div>
      </PageLayout>
    )
  }

  const financeStrip = (
    <div
      className="rounded overflow-hidden grid grid-cols-1 lg:grid-cols-5 gap-0 border-b min-w-0"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.purple, borderRadius: 3 }}
    >
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Valor total</label>
        <div className="text-base sm:text-lg font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(initialJobValue)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Custo</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(totalCostReal)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Lucro líquido</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: profitFinal >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(profitFinal)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Diferença</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: profitDiff >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(profitDiff)}</div>
      </div>
      <div className="p-3 flex flex-col items-center justify-center min-w-0">
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Margem</label>
        <div className="text-sm sm:text-base font-semibold" style={{ color: margin >= 20 ? cinema.success : margin >= 10 ? resolve.accent : cinema.danger }}>{margin.toFixed(1)}%</div>
      </div>
    </div>
  )

  const phaseLabel = activePhase === 'pre' ? 'Pré-produção' : activePhase === 'prod' ? 'Produção' : 'Pós-produção'

  return (
    <PageLayout
      title="Orçamento Realizado"
      strip={financeStrip}
      tabs={
        <BudgetTabs
          activePhase={activePhase}
          onPhaseChange={setActivePhase}
          isLocked={isLocked}
          onToggleLock={handleToggleLock}
          cacheTables={cacheTables}
          cacheTableId={cacheTableId}
          onCacheTableChange={isLocked ? undefined : setCacheTableId}
        />
      }
      toolbar={
        <div className="flex flex-col gap-2 min-w-0">
          <MiniTables data={miniTables} onChange={isLocked ? () => {} : setMiniTables} />
          <PhaseDefaultsBar
            data={phaseDefaults[activePhase]}
            onChange={(d) => setPhaseDefaults((prev) => ({ ...prev, [activePhase]: d }))}
            phaseLabel={phaseLabel}
            isLocked={isLocked}
            onApplyDias={applyDias}
            onApplySemanas={applySemanas}
            onApplyDeslocamento={applyDeslocamento}
            onApplyAlimentacao={applyAlimentacao}
          />
        </div>
      }
      contentLayout="grid"
    >
      <div className={`col-span-full flex gap-3 min-w-0 ${isLocked ? 'locked-sheet' : ''}`}>
        <div className="flex-1 min-w-0 grid grid-cols-1 min-[1664px]:grid-cols-2 gap-4" style={{ alignContent: 'start' }}>
        {deptsForPhase.map((dept) => (
          <BudgetDeptBlock
            key={dept}
            department={dept}
            rows={linesForPhase[dept] ?? []}
            verbaRows={(verbaLines[activePhase] ?? {})[dept] ?? []}
            showVerbaButton={!isLocked && VERBA_DEPTS.includes(dept as (typeof VERBA_DEPTS)[number])}
            cacheTableId={cacheTableId}
            headerLabel={dept === 'AGÊNCIA' ? projectData?.agencia : dept === 'CLIENTE' ? projectData?.cliente : undefined}
            onAddRow={() => !isLocked && addRow(dept)}
            onUpdateRow={(rowId, updates) => !isLocked && updateRow(dept, rowId, updates)}
            onRemoveRow={(rowId) => !isLocked && removeRow(dept, rowId)}
            onAddVerbaRow={() => !isLocked && addVerbaRow(dept)}
            onUpdateVerbaRow={(rowId, updates) => !isLocked && updateVerbaRow(dept, rowId, updates)}
            onRemoveVerbaRow={(rowId) => !isLocked && removeVerbaRow(dept, rowId)}
          />
        ))}
        </div>
      </div>
      <div className="col-span-full rounded border p-3 mt-0" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
        <label className="block text-[11px] uppercase tracking-wider font-medium mb-2" style={{ color: resolve.muted }}>Observações</label>
        <textarea
          className="w-full min-h-[80px] px-2 py-1.5 text-sm rounded border resize-y"
          style={{ backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }}
          readOnly={isLocked}
          value={notes[activePhase]}
          onChange={(e) => !isLocked && setNotes((prev) => ({ ...prev, [activePhase]: e.target.value }))}
          placeholder={`Observações da fase ${activePhase === 'pre' ? 'Pré-produção' : activePhase === 'prod' ? 'Produção' : 'Pós-produção'}`}
        />
      </div>
    </PageLayout>
  )
})

export default ViewOrcFinal
