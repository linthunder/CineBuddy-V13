'use client'

import { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import PageLayout from '@/components/PageLayout'
import FinanceStrip from '@/components/FinanceStrip'
import MiniTables from '@/components/MiniTables'
import BudgetTabs from '@/components/BudgetTabs'
import BudgetDeptBlock from '@/components/BudgetDeptBlock'
import { DEPARTMENTS, VERBA_DEPTS } from '@/lib/constants'
import { resolve } from '@/lib/theme'
import { listCacheTables } from '@/lib/services/cache-tables'
import type { PhaseKey } from '@/lib/constants'
import type { BudgetRow, BudgetLinesByPhase, MiniTablesData, VerbaRow, VerbaLinesByPhase } from '@/lib/types'
import { createEmptyRow, computeRowTotal, createEmptyVerbaRow, computeVerbaRowTotal } from '@/lib/budgetUtils'

function getInitialLinesByPhase(): BudgetLinesByPhase {
  const empty: BudgetLinesByPhase = { pre: {}, prod: {}, pos: {} }
  ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
    DEPARTMENTS[phase].forEach((dept) => {
      empty[phase][dept] = []
    })
  })
  return empty
}

function getInitialVerbaLines(): VerbaLinesByPhase {
  const empty: VerbaLinesByPhase = { pre: {}, prod: {}, pos: {} }
  ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
    VERBA_DEPTS.forEach((dept) => {
      empty[phase][dept] = []
    })
  })
  return empty
}

interface ViewOrcamentoProps {
  isLocked?: boolean
  onToggleLock?: (snapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<PhaseKey, string>
  }) => void
}

export interface ViewOrcamentoHandle {
  getState: () => {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<PhaseKey, string>
    cacheTableId: string | null
  }
  loadState: (state: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<PhaseKey, string>
    cacheTableId?: string | null
  }) => void
}

const ViewOrcamento = forwardRef<ViewOrcamentoHandle, ViewOrcamentoProps>(function ViewOrcamento({ isLocked = false, onToggleLock }, ref) {
  const [activePhase, setActivePhase] = useState<PhaseKey>('prod')
  const [cacheTableId, setCacheTableId] = useState<string | null>(null)
  const [cacheTables, setCacheTables] = useState<{ id: string; name: string; is_default: boolean }[]>([])
  const [budgetLines, setBudgetLines] = useState<BudgetLinesByPhase>(getInitialLinesByPhase)
  const [verbaLines, setVerbaLines] = useState<VerbaLinesByPhase>(getInitialVerbaLines)
  const [miniTables, setMiniTables] = useState<MiniTablesData>({
    contingencia: 0,
    crt: 0,
    bvagencia: 0,
  })
  const [jobValue, setJobValue] = useState(0)
  const [taxRate, setTaxRate] = useState(12.5)
  const [notes, setNotes] = useState<Record<PhaseKey, string>>({ pre: '', prod: '', pos: '' })

  useEffect(() => {
    listCacheTables().then((tables) => {
      setCacheTables(tables)
      if (tables.length > 0) {
        setCacheTableId((prev) => {
          if (prev && tables.some((t) => t.id === prev)) return prev
          const defaultTable = tables.find((t) => t.is_default) ?? tables[0]
          return defaultTable.id
        })
      }
    })
  }, [])

  useImperativeHandle(ref, () => ({
    getState: () => ({ budgetLines, verbaLines, miniTables, jobValue, taxRate, notes, cacheTableId }),
    loadState: (state) => {
      setBudgetLines(state.budgetLines)
      setVerbaLines(state.verbaLines)
      setMiniTables(state.miniTables)
      setJobValue(state.jobValue)
      setTaxRate(state.taxRate)
      setNotes(state.notes)
      if (state.cacheTableId !== undefined) setCacheTableId(state.cacheTableId ?? null)
    },
  }))

  const deptsForPhase = DEPARTMENTS[activePhase]
  const linesForPhase = budgetLines[activePhase]

  /* Custo total = soma de TODAS as fases (Pré + Prod + Pós), como na referência V13.50 */
  const totalCostFromRows = useMemo(() => {
    let sum = 0
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const phaseDepts = DEPARTMENTS[phase]
      const phaseLines = budgetLines[phase]
      const phaseVerbas = verbaLines[phase] ?? {}
      phaseDepts.forEach((dept) => {
        const rows = phaseLines[dept] ?? []
        rows.forEach((r) => { sum += computeRowTotal(r) })
        const verba = phaseVerbas[dept] ?? []
        verba.forEach((v) => { sum += computeVerbaRowTotal(v) })
      })
    })
    return sum
  }, [budgetLines, verbaLines])

  const miniTablesTotal = miniTables.contingencia + miniTables.crt + miniTables.bvagencia
  const totalCost = totalCostFromRows + miniTablesTotal

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
      const next = { ...prev, [activePhase]: { ...prev[activePhase], [department]: phaseData.map((r) => (r.id === rowId ? merged : r)) } }
      return next
    })
  }, [activePhase])

  const removeRow = useCallback((department: string, rowId: string) => {
    setBudgetLines((prev) => {
      const phaseData = prev[activePhase][department] ?? []
      const next = { ...prev, [activePhase]: { ...prev[activePhase], [department]: phaseData.filter((r) => r.id !== rowId) } }
      return next
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

  const handleApplyMarkup = useCallback((percent: number) => {
    if (totalCost <= 0) {
      if (typeof window !== 'undefined') window.alert('Adicione itens ao orçamento primeiro!')
      return
    }
    const taxRateDecimal = taxRate / 100
    const marginRate = percent / 100
    const newVal = totalCost / (1 - marginRate - taxRateDecimal)
    setJobValue(newVal)
  }, [totalCost, taxRate])

  const handleToggleLock = useCallback(() => {
    if (onToggleLock) {
      onToggleLock({ budgetLines, verbaLines, miniTables, jobValue, taxRate, notes })
    }
  }, [onToggleLock, budgetLines, verbaLines, miniTables, jobValue, taxRate, notes])

  return (
    <PageLayout
      title="Orçamento"
      strip={
        <FinanceStrip
          jobValue={jobValue}
          totalCost={totalCost}
          taxRate={taxRate}
          onJobValueChange={isLocked ? undefined : setJobValue}
          onTaxRateChange={isLocked ? undefined : setTaxRate}
          onApplyMarkup={isLocked ? undefined : handleApplyMarkup}
        />
      }
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
      <div className={`col-span-full flex gap-3 min-w-0 ${isLocked ? 'locked-sheet' : ''}`}>
        {/* Menu vertical: seleção da tabela de cachê */}
        {cacheTables.length > 0 && (
          <aside className="flex-shrink-0 w-40 py-2 rounded border" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, height: 'fit-content' }}>
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: resolve.muted }}>Tabela de cachê</div>
            <nav className="flex flex-col gap-0.5">
              {cacheTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="text-left px-2 py-1.5 text-[11px] rounded transition-colors"
                  style={{
                    backgroundColor: cacheTableId === t.id ? resolve.accent : 'transparent',
                    color: cacheTableId === t.id ? resolve.bg : resolve.text,
                  }}
                  onClick={() => !isLocked && setCacheTableId(t.id)}
                >
                  {t.name}
                  {t.is_default && <span className="ml-1 text-[9px]" style={{ opacity: 0.8 }}>(padrão)</span>}
                </button>
              ))}
            </nav>
          </aside>
        )}
        <div className="flex-1 min-w-0 grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ alignContent: 'start' }}>
          {deptsForPhase.map((dept) => (
            <BudgetDeptBlock
              key={dept}
              department={dept}
              rows={linesForPhase[dept] ?? []}
              verbaRows={(verbaLines[activePhase] ?? {})[dept] ?? []}
              showVerbaButton={!isLocked && VERBA_DEPTS.includes(dept as (typeof VERBA_DEPTS)[number])}
              cacheTableId={cacheTableId}
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

export default ViewOrcamento
