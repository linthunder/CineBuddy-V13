'use client'

import { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import PageLayout from '@/components/PageLayout'
import MiniTables from '@/components/MiniTables'
import BudgetTabs from '@/components/BudgetTabs'
import BudgetDeptBlock from '@/components/BudgetDeptBlock'
import { DEPARTMENTS, VERBA_DEPTS } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency } from '@/lib/utils'
import type { PhaseKey } from '@/lib/constants'
import type { BudgetRow, BudgetLinesByPhase, MiniTablesData, VerbaRow, VerbaLinesByPhase } from '@/lib/types'
import { createEmptyRow, computeRowTotal, createEmptyVerbaRow, computeVerbaRowTotal } from '@/lib/budgetUtils'

interface ViewOrcFinalProps {
  /** Snapshot do orçamento inicial (copiado ao finalizar) */
  initialSnapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<'pre' | 'prod' | 'pos', string>
  } | null
  isLocked?: boolean
  onToggleLock?: (snapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<'pre' | 'prod' | 'pos', string>
  }) => void
}

export interface ViewOrcFinalHandle {
  getState: () => {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    notes: Record<'pre' | 'prod' | 'pos', string>
  }
  loadState: (state: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    notes: Record<'pre' | 'prod' | 'pos', string>
  }) => void
}

const ViewOrcFinal = forwardRef<ViewOrcFinalHandle, ViewOrcFinalProps>(function ViewOrcFinal({ initialSnapshot, isLocked = false, onToggleLock }, ref) {
  const [activePhase, setActivePhase] = useState<PhaseKey>('prod')
  const loadedFromDB = useRef(false)

  /* Estado do orçamento final — inicializado a partir do snapshot */
  const [budgetLines, setBudgetLines] = useState<BudgetLinesByPhase>({ pre: {}, prod: {}, pos: {} })
  const [verbaLines, setVerbaLines] = useState<VerbaLinesByPhase>({ pre: {}, prod: {}, pos: {} })
  const [miniTables, setMiniTables] = useState<MiniTablesData>({ contingencia: 0, crt: 0, bvagencia: 0 })
  const [notes, setNotes] = useState<Record<PhaseKey, string>>({ pre: '', prod: '', pos: '' })

  useImperativeHandle(ref, () => ({
    getState: () => ({ budgetLines, verbaLines, miniTables, notes }),
    loadState: (state) => {
      // Só ativa o flag se houver dados reais (evita bloquear a cascata ao resetar)
      const hasData = Object.values(state.budgetLines).some((phase) =>
        Object.values(phase).some((rows) => Array.isArray(rows) && rows.length > 0)
      )
      loadedFromDB.current = hasData
      setBudgetLines(state.budgetLines)
      setVerbaLines(state.verbaLines)
      setMiniTables(state.miniTables)
      setNotes(state.notes)
    },
  }))

  /* Valores fixos do inicial */
  const initialJobValue = initialSnapshot?.jobValue ?? 0
  const initialTaxRate = initialSnapshot?.taxRate ?? 12.5
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
    // Deep clone para edição independente
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
    setNotes({ ...initialSnapshot.notes })
  }, [initialSnapshot])

  const deptsForPhase = DEPARTMENTS[activePhase]
  const linesForPhase = budgetLines[activePhase]

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
    setBudgetLines((prev) => {
      const next = { ...prev, [activePhase]: { ...prev[activePhase] } }
      const list = next[activePhase][department] ?? []
      next[activePhase][department] = [...list, createEmptyRow(department)]
      return next
    })
  }, [activePhase])

  const updateRow = useCallback((department: string, rowId: string, updates: Partial<BudgetRow>) => {
    setBudgetLines((prev) => {
      const phaseData = prev[activePhase][department] ?? []
      const row = phaseData.find((r) => r.id === rowId)
      if (!row) return prev
      const merged = { ...row, ...updates } as BudgetRow
      merged.totalCost = computeRowTotal(merged)
      return { ...prev, [activePhase]: { ...prev[activePhase], [department]: phaseData.map((r) => (r.id === rowId ? merged : r)) } }
    })
  }, [activePhase])

  const removeRow = useCallback((department: string, rowId: string) => {
    setBudgetLines((prev) => {
      const phaseData = prev[activePhase][department] ?? []
      return { ...prev, [activePhase]: { ...prev[activePhase], [department]: phaseData.filter((r) => r.id !== rowId) } }
    })
  }, [activePhase])

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
      onToggleLock({ budgetLines, verbaLines, miniTables, jobValue: initialJobValue, taxRate: initialTaxRate, notes })
    }
  }, [onToggleLock, budgetLines, verbaLines, miniTables, initialJobValue, initialTaxRate, notes])

  if (!initialSnapshot) {
    return (
      <PageLayout title="Orç. Final">
        <div className="text-center py-12" style={{ color: resolve.muted }}>
          <p className="text-sm">Finalize o Orçamento inicial para acessar o Orçamento Final.</p>
        </div>
      </PageLayout>
    )
  }

  const financeStrip = (
    <div
      className="rounded overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-b"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.purple, borderRadius: 3 }}
    >
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Valor Job</label>
        <div className="text-base sm:text-lg font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(initialJobValue)}</div>
      </div>
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Custo Real</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(totalCostReal)}</div>
      </div>
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Lucro Real</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: profitFinal >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(profitFinal)}</div>
      </div>
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Diferença</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: profitDiff >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(profitDiff)}</div>
      </div>
      <div className="p-3 flex flex-col items-center justify-center">
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Margem</label>
        <div className="text-sm sm:text-base font-semibold" style={{ color: margin >= 20 ? cinema.success : margin >= 10 ? resolve.accent : cinema.danger }}>{margin.toFixed(1)}%</div>
      </div>
    </div>
  )

  return (
    <PageLayout
      title="Orç. Final"
      strip={financeStrip}
      tabs={
        <BudgetTabs
          activePhase={activePhase}
          onPhaseChange={setActivePhase}
          isLocked={isLocked}
          onToggleLock={handleToggleLock}
        />
      }
      toolbar={<MiniTables data={miniTables} onChange={isLocked ? () => {} : setMiniTables} />}
      contentLayout="grid"
    >
      <div className={isLocked ? 'col-span-full locked-sheet' : 'col-span-full'} style={{ display: 'contents' }}>
        {deptsForPhase.map((dept) => (
          <BudgetDeptBlock
            key={dept}
            department={dept}
            rows={linesForPhase[dept] ?? []}
            verbaRows={(verbaLines[activePhase] ?? {})[dept] ?? []}
            showVerbaButton={!isLocked && VERBA_DEPTS.includes(dept as (typeof VERBA_DEPTS)[number])}
            onAddRow={() => !isLocked && addRow(dept)}
            onUpdateRow={(rowId, updates) => !isLocked && updateRow(dept, rowId, updates)}
            onRemoveRow={(rowId) => !isLocked && removeRow(dept, rowId)}
            onAddVerbaRow={() => !isLocked && addVerbaRow(dept)}
            onUpdateVerbaRow={(rowId, updates) => !isLocked && updateVerbaRow(dept, rowId, updates)}
            onRemoveVerbaRow={(rowId) => !isLocked && removeVerbaRow(dept, rowId)}
          />
        ))}
      </div>
      <div className="col-span-full rounded border p-3" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
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
