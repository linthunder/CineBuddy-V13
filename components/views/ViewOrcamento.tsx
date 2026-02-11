'use client'

import { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import PageLayout from '@/components/PageLayout'
import FinanceStrip from '@/components/FinanceStrip'
import MiniTables from '@/components/MiniTables'
import PhaseDefaultsBar from '@/components/PhaseDefaultsBar'
import BudgetTabs from '@/components/BudgetTabs'
import BudgetDeptBlock from '@/components/BudgetDeptBlock'
import { DEPARTMENTS, VERBA_DEPTS, LABOR_DEPTS, PEOPLE_DEPTS } from '@/lib/constants'
import { resolve } from '@/lib/theme'
import { listCacheTables } from '@/lib/services/cache-tables'
import type { PhaseKey } from '@/lib/constants'
import type { BudgetRow, BudgetRowLabor, BudgetLinesByPhase, MiniTablesData, VerbaRow, VerbaLinesByPhase, PhaseDefaultsByPhase, ProjectData } from '@/lib/types'
import { createEmptyRow, computeRowTotal, createEmptyVerbaRow, computeVerbaRowTotal } from '@/lib/budgetUtils'

export function getInitialLinesByPhase(): BudgetLinesByPhase {
  const empty: BudgetLinesByPhase = { pre: {}, prod: {}, pos: {} }
  ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
    DEPARTMENTS[phase].forEach((dept) => {
      empty[phase][dept] = []
    })
  })
  // CATERING vem com 1 linha pré-incluída (alimentação da equipe), apenas em pre e prod
  ;(['pre', 'prod'] as const).forEach((phase) => {
    const firstRow = createEmptyRow('CATERING', { cateringDefaultUnitCost: 0 })
    firstRow.itemName = 'Alimentação equipe'
    empty[phase].CATERING = [firstRow]
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

const INITIAL_PHASE_DEFAULTS: PhaseDefaultsByPhase = {
  pre: { dias: 0, semanas: 0, deslocamento: 0, alimentacaoPerPerson: 0 },
  prod: { dias: 0, semanas: 0, deslocamento: 0, alimentacaoPerPerson: 0 },
  pos: { dias: 0, semanas: 0, deslocamento: 0, alimentacaoPerPerson: 0 },
}

interface ViewOrcamentoProps {
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
    notes: Record<PhaseKey, string>
    cacheTableId?: string | null
  }) => void
}

export interface ViewOrcamentoHandle {
  getState: () => {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    phaseDefaults: PhaseDefaultsByPhase
    jobValue: number
    taxRate: number
    notes: Record<PhaseKey, string>
    cacheTableId: string | null
  }
  loadState: (state: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    phaseDefaults?: PhaseDefaultsByPhase
    jobValue: number
    taxRate: number
    notes: Record<PhaseKey, string>
    cacheTableId?: string | null
  }) => void
}

const ViewOrcamento = forwardRef<ViewOrcamentoHandle, ViewOrcamentoProps>(function ViewOrcamento({ projectData, isLocked = false, onToggleLock }, ref) {
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
  const [phaseDefaults, setPhaseDefaults] = useState<PhaseDefaultsByPhase>(INITIAL_PHASE_DEFAULTS)
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

  /** Mantém a 1ª linha de CATERING sincronizada (alimentação × profissionais × dias) quando valor, equipe ou dias mudam */
  const updateFirstCateringRow = useCallback((phase: PhaseKey, lines: BudgetLinesByPhase, alimentacao: number, teamCount: number, dias: number) => {
    if (!(DEPARTMENTS[phase] as readonly string[]).includes('CATERING')) return lines
    const next = { ...lines, [phase]: { ...lines[phase] } }
    let catering = next[phase].CATERING ?? []
    if (catering.length === 0) {
      const firstRow = createEmptyRow('CATERING', { cateringDefaultUnitCost: 0 })
      firstRow.itemName = 'Alimentação equipe'
      catering = [firstRow]
      next[phase].CATERING = catering
    }
    const qty = dias > 0 ? dias : 1
    const firstRow = catering[0]
    const first = { ...firstRow, unitCost: alimentacao * teamCount, quantity: qty, totalCost: alimentacao * teamCount * qty }
    next[phase].CATERING = [first as BudgetRow, ...catering.slice(1)]
    return next
  }, [])

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
      const c0 = catering[0] as { unitCost?: number; quantity?: number } | undefined
      const currentUnitCost = c0?.unitCost ?? 0
      const currentQty = c0?.quantity ?? 1
      if (Math.abs(currentUnitCost - expectedUnitCost) >= 0.005 || currentQty !== expectedQty) {
        next = updateFirstCateringRow(phase, next, alimentacao, teamCount, dias)
        needsUpdate = true
      }
    }
    if (needsUpdate) setBudgetLines(next)
  }, [phaseDefaults, budgetLines, updateFirstCateringRow])

  useImperativeHandle(ref, () => ({
    getState: () => ({ budgetLines, verbaLines, miniTables, phaseDefaults, jobValue, taxRate, notes, cacheTableId }),
    loadState: (state) => {
      setBudgetLines(state.budgetLines)
      setVerbaLines(state.verbaLines)
      setMiniTables(state.miniTables)
      if (state.phaseDefaults) setPhaseDefaults(state.phaseDefaults)
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

  /** Conta profissionais (labor + CASTING/elenco + AGÊNCIA/CLIENTE) na fase para cálculo de alimentação em CATERING. Em CASTING, usa a Qtd da linha (ex: figurantes 3 = 3 pessoas). */
  const teamCountForPhase = useCallback((phase: PhaseKey): number => {
    let count = 0
    const phaseLines = budgetLines[phase] ?? {}
    LABOR_DEPTS.forEach((dept) => {
      (phaseLines[dept] ?? []).forEach((r) => { if (r.type === 'labor') count++ })
    })
    ;(phaseLines.CASTING ?? []).forEach((r) => { count += Math.max(0, ('quantity' in r ? r.quantity : 0) || 0) || 1 })
    PEOPLE_DEPTS.forEach((dept) => {
      (phaseLines[dept] ?? []).forEach((r) => { if (r.type === 'people') count++ })
    })
    return count
  }, [budgetLines])

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
      // Ao adicionar profissional, elenco ou pessoa (AGÊNCIA/CLIENTE): atualiza 1ª linha de CATERING
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
      // Ao remover profissional, elenco ou pessoa (AGÊNCIA/CLIENTE): atualiza 1ª linha de CATERING
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
      onToggleLock({ budgetLines, verbaLines, miniTables, phaseDefaults, jobValue, taxRate, notes, cacheTableId })
    }
  }, [onToggleLock, budgetLines, verbaLines, miniTables, phaseDefaults, jobValue, taxRate, notes, cacheTableId])

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
    setBudgetLines((prev) => updateFirstCateringRow(activePhase, prev, alimentacaoPerPerson, teamCount, dias))
  }, [activePhase, phaseDefaults, teamCountForPhase, updateFirstCateringRow])

  const phaseLabel = activePhase === 'pre' ? 'Pré-produção' : activePhase === 'prod' ? 'Produção' : 'Pós-produção'

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
          cacheTables={cacheTables}
          cacheTableId={cacheTableId}
          onCacheTableChange={setCacheTableId}
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
        <div className="flex-1 min-w-0 grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ alignContent: 'start' }}>
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

export default ViewOrcamento
