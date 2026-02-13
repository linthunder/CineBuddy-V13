'use client'

import { useMemo, useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, Fragment } from 'react'
import PageLayout from '@/components/PageLayout'
import { DEPARTMENTS, LABOR_DEPTS } from '@/lib/constants'
import type { PhaseKey } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { BudgetLinesByPhase, VerbaLinesByPhase, MiniTablesData, BudgetRow, BudgetRowLabor, PhaseDefaultsByPhase } from '@/lib/types'
import { computeRowTotal, computeVerbaRowTotal, sumDeptTotal } from '@/lib/budgetUtils'
import { listCollaborators, type Collaborator } from '@/lib/services/collaborators'
import { X, Plus, Lock, LockOpen } from 'lucide-react'

/* ── Tipos internos ── */
/** Uma diária de gravação: horas da diária, adicional % e horas extras nesse dia */
export interface DiariaEntry {
  dailyHours: number
  additionalPct: number
  overtimeHours: number
}

interface ClosingLine {
  id: string
  department: string
  phase: string
  name: string
  role: string
  type: string
  isLabor: boolean
  isVerba: boolean
  finalValue: number
  finalUnitCost: number
  finalExtraCost: number
  finalQuantity: number
  /** Diárias de gravação (uma entrada por dia); substitui os campos únicos para labor */
  diarias: DiariaEntry[]
  /** @deprecated use diarias; mantido para migração no loadState */
  dailyHours?: number
  additionalPct?: number
  overtimeHours?: number
  invoiceNumber: string
  payStatus: 'pendente' | 'pago'
}

interface ExpenseLine {
  id: string
  name: string
  description: string
  value: number
  invoiceNumber: string
  payStatus: 'pendente' | 'pago'
}

/* ── Helpers ── */
const PHASE_LABELS: Record<string, string> = {
  pre: 'Pré-produção',
  prod: 'Produção',
  pos: 'Pós-produção',
}

const PHASE_TABS: { key: PhaseKey; label: string }[] = [
  { key: 'pre', label: 'Pré-produção' },
  { key: 'prod', label: 'Produção' },
  { key: 'pos', label: 'Pós-produção' },
]

/** Normaliza linha para sempre ter diarias (para compatibilidade com dados antigos). */
function normalizeDiarias(line: ClosingLine): DiariaEntry[] {
  if (line.diarias && line.diarias.length > 0) return line.diarias
  return [{
    dailyHours: line.dailyHours ?? 8,
    additionalPct: line.additionalPct ?? 0,
    overtimeHours: line.overtimeHours ?? 0,
  }]
}

/** Valor da diária de referência (para exibição e cálculo de HE: semana = semanal/5) */
function getCachePerDay(line: ClosingLine): number {
  if (line.type === 'sem') return line.finalUnitCost / 5
  if (line.type === 'dia') return line.finalUnitCost
  const diarias = normalizeDiarias(line)
  const n = Math.max(1, diarias.length)
  return line.finalValue / n
}

function calcOvertime(line: ClosingLine): number {
  if (!line.isLabor) return 0
  const diarias = normalizeDiarias(line)
  const unitPerDay = line.type === 'sem' ? line.finalUnitCost / 5 : line.finalUnitCost
  let total = 0
  for (const d of diarias) {
    if (d.dailyHours <= 0) continue
    const hourlyRate = unitPerDay / d.dailyHours
    const rateWithAdditional = hourlyRate * (1 + d.additionalPct / 100)
    total += rateWithAdditional * d.overtimeHours
  }
  return total
}

function findCollaboratorByName(collaborators: Collaborator[], name: string): Collaborator | undefined {
  const normalized = (name || '').trim().toLowerCase()
  return collaborators.find((c) => c.nome?.trim().toLowerCase() === normalized)
}

function calcTotalNF(line: ClosingLine): number {
  return line.finalValue + calcOvertime(line)
}

const inputStyle: React.CSSProperties = {
  backgroundColor: resolve.bg,
  border: `1px solid ${resolve.border}`,
  color: resolve.text,
  borderRadius: 2,
}
const inputClassName = 'w-full py-1 px-2 text-[11px] focus:outline-none'
/** Selects da linha de diária: compactos e bem distribuídos */
const inputDiariaClassName = 'w-full max-w-[6.5rem] py-0.5 px-1.5 text-[10px] focus:outline-none'
/** Linha vertical que ocupa toda a altura do container (uso em células com flex items-stretch) */
const sepVertical = (key?: string) => (
  <span key={key} className="flex-shrink-0 w-px min-h-full self-stretch" style={{ backgroundColor: resolve.border }} aria-hidden />
)
const iconBtnCls = 'team-info-btn w-7 h-7 flex items-center justify-center rounded border transition-colors text-xs font-medium'

function CopyableLine({ label, value }: { label: string; value: string }) {
  const text = value || '—'
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof window !== 'undefined') window.alert('Copiado!')
    }).catch(() => {})
  }
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] uppercase block" style={{ color: resolve.muted }}>{label}</span>
        <span className="text-sm break-words" style={{ color: resolve.text }}>{text}</span>
      </div>
      <button type="button" onClick={copy} title="Copiar" className="team-info-btn flex-shrink-0 h-7 px-2 rounded border text-[10px] font-medium uppercase" style={{ borderColor: resolve.border, color: resolve.text }}>Copiar</button>
    </div>
  )
}

const DAILY_HOURS_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const ADDITIONAL_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const OVERTIME_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Itens que podem entrar no cálculo do Saving (verbas + departamentos de custo) */
const SAVING_ITEMS: { key: string; label: string }[] = [
  { key: 'verba-PRODUÇÃO', label: 'Verba de Produção' },
  { key: 'verba-ARTE E CENOGRAFIA', label: 'Verba de Arte e Cenografia' },
  { key: 'verba-FOTOGRAFIA E TÉCNICA', label: 'Verba de Fotografia e Técnica' },
  { key: 'verba-FIGURINO E MAQUIAGEM', label: 'Verba de Figurino e Maquiagem' },
  { key: 'dept-EQUIPAMENTOS', label: 'Equipamentos' },
  { key: 'dept-LOCAÇÕES', label: 'Locações' },
  { key: 'dept-TRANSPORTE', label: 'Transporte' },
  { key: 'dept-CATERING', label: 'Catering' },
  { key: 'dept-DESPESAS GERAIS', label: 'Despesas Gerais' },
]

const SAVING_PCT_OPTIONS = [5, 10, 15, 20, 25] as const

export interface SavingConfig {
  items: string[]
  pct: number
  responsibleId: string | null
}

function sumSnapshotTotal(
  budgetLines: BudgetLinesByPhase,
  verbaLines: VerbaLinesByPhase,
  itemKey: string
): number {
  const [kind, dept] = itemKey.startsWith('verba-') ? ['verba', itemKey.slice(6)] : ['dept', itemKey.slice(5)]
  let total = 0
  ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
    if (kind === 'verba') {
      const rows = verbaLines[phase]?.[dept] ?? []
      total += rows.reduce((s, r) => s + computeVerbaRowTotal(r), 0)
    } else {
      const rows = budgetLines[phase]?.[dept] ?? []
      total += sumDeptTotal(rows)
    }
  })
  return total
}

/* ── Props ── */
interface ViewFechamentoProps {
  finalSnapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<'pre' | 'prod' | 'pos', string>
  } | null
  initialSnapshot?: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
  } | null
  initialJobValue: number
  isLocked?: boolean
  /** Callback do botão CONCLUIR FECHAMENTO / REABRIR FECHAMENTO */
  onToggleLock?: () => void
  /** Padrões por fase (dias da fase) para HE de profissional por semana */
  getPhaseDefaults?: () => PhaseDefaultsByPhase | undefined
}

export interface ViewFechamentoHandle {
  getState: () => { closingLines: ClosingLine[]; expenses: ExpenseLine[]; saving: SavingConfig | undefined }
  loadState: (state: { closingLines: ClosingLine[]; expenses: ExpenseLine[]; saving?: SavingConfig | null }) => void
}

/* ── Componente ── */
const defaultSaving: SavingConfig = { items: [], pct: 10, responsibleId: null }

const defaultDiaria = (): DiariaEntry => ({ dailyHours: 8, additionalPct: 0, overtimeHours: 0 })

const JORNADA_LABEL: Record<string, string> = { dia: 'Diária', sem: 'Semana', flat: 'Fechado' }

const ViewFechamento = forwardRef<ViewFechamentoHandle, ViewFechamentoProps>(function ViewFechamento({ finalSnapshot, initialSnapshot, initialJobValue, isLocked = false, onToggleLock, getPhaseDefaults }, ref) {
  const [closingLines, setClosingLines] = useState<ClosingLine[]>([])
  const [expenses, setExpenses] = useState<ExpenseLine[]>([])
  const [saving, setSaving] = useState<SavingConfig>(defaultSaving)
  const [savingModalOpen, setSavingModalOpen] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [modalContact, setModalContact] = useState<Collaborator | 'no-data' | null>(null)
  const [modalBank, setModalBank] = useState<Collaborator | 'no-data' | null>(null)
  const [activePhase, setActivePhase] = useState<PhaseKey>('prod')
  /** Para tipo 'sem': linha expandida para cálculo de HE (mostra diárias) */
  const [showOvertimeForLineId, setShowOvertimeForLineId] = useState<Record<string, boolean>>({})
  const loadedFromDB = useRef(false)

  useEffect(() => {
    listCollaborators().then(setCollaborators).catch(() => setCollaborators([]))
  }, [])

  useImperativeHandle(ref, () => ({
    getState: () => ({ closingLines, expenses, saving: saving.items.length > 0 || saving.responsibleId ? saving : undefined }),
    loadState: (state) => {
      loadedFromDB.current = state.closingLines.length > 0 || state.expenses.length > 0
      const normalized = state.closingLines.map((l: ClosingLine) => {
        const diarias = l.diarias?.length
          ? l.diarias
          : [{ dailyHours: l.dailyHours ?? 8, additionalPct: l.additionalPct ?? 0, overtimeHours: l.overtimeHours ?? 0 }]
        return { ...l, diarias }
      })
      setClosingLines(normalized)
      setExpenses(state.expenses)
      setSaving(state.saving != null ? { ...defaultSaving, ...state.saving } : defaultSaving)
    },
  }))

  useEffect(() => {
    if (!finalSnapshot) return
    if (loadedFromDB.current) { loadedFromDB.current = false; return }
    const lines: ClosingLine[] = []
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const depts = DEPARTMENTS[phase]
      depts.forEach((dept) => {
        const rows: BudgetRow[] = finalSnapshot.budgetLines[phase]?.[dept] ?? []
        const isLabor = LABOR_DEPTS.includes(dept as never)
        rows.forEach((row) => {
          if (row.type === 'people') return
          const total = computeRowTotal(row)
          if (total <= 0 && !row.itemName && !row.roleFunction) return
          const laborRow = row as BudgetRowLabor
          const numDias = Math.max(1, row.quantity || 1)
          const diarias: DiariaEntry[] = Array.from({ length: numDias }, () => defaultDiaria())
          lines.push({
            id: row.id,
            department: dept,
            phase,
            name: row.itemName || row.roleFunction || '',
            role: isLabor ? row.roleFunction : row.roleFunction || '',
            type: row.unitType,
            isLabor,
            isVerba: false,
            finalValue: total,
            finalUnitCost: row.unitCost,
            finalExtraCost: isLabor ? (laborRow.extraCost ?? 0) : 0,
            finalQuantity: row.quantity,
            diarias,
            invoiceNumber: '',
            payStatus: 'pendente',
          })
        })
        // Verbas deste dept
        const verbaRows = finalSnapshot.verbaLines[phase]?.[dept] ?? []
        verbaRows.forEach((v) => {
          const total = computeVerbaRowTotal(v)
          if (total <= 0 && !v.itemName) return
          lines.push({
            id: v.id,
            department: dept,
            phase,
            name: v.itemName || 'Verba',
            role: '',
            type: 'verba',
            isLabor: false,
            isVerba: true,
            finalValue: total,
            finalUnitCost: v.unitCost,
            finalExtraCost: 0,
            finalQuantity: v.quantity,
            diarias: [],
            invoiceNumber: '',
            payStatus: 'pendente',
          })
        })
      })
    })
    setClosingLines(lines)
    setExpenses([])
  }, [finalSnapshot])

  const updateLine = useCallback((id: string, updates: Partial<ClosingLine>) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }, [isLocked])

  const updateDiaria = useCallback((lineId: string, diariaIndex: number, updates: Partial<DiariaEntry>) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId || !l.diarias?.length) return l
      const next = [...l.diarias]
      if (diariaIndex < 0 || diariaIndex >= next.length) return l
      next[diariaIndex] = { ...next[diariaIndex], ...updates }
      return { ...l, diarias: next }
    }))
  }, [isLocked])

  const addDiaria = useCallback((lineId: string) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId) return l
      const diarias = normalizeDiarias(l)
      return { ...l, diarias: [...diarias, defaultDiaria()] }
    }))
  }, [isLocked])

  const removeDiaria = useCallback((lineId: string, diariaIndex: number) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId) return l
      const diarias = normalizeDiarias(l)
      if (diarias.length <= 1) return l
      const next = diarias.filter((_, i) => i !== diariaIndex)
      return { ...l, diarias: next }
    }))
  }, [isLocked])

  /** Expande o bloco de HE para profissional por semana; cria diárias conforme dias da fase */
  const expandOvertimeForSemLine = useCallback((lineId: string) => {
    setShowOvertimeForLineId((prev) => ({ ...prev, [lineId]: true }))
    const phaseDefs = getPhaseDefaults?.()
    const dias = phaseDefs?.[activePhase]?.dias ?? 1
    const n = Math.max(1, dias)
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId || l.type !== 'sem') return l
      const current = normalizeDiarias(l)
      if (current.length >= n) return l
      const next = [...current]
      while (next.length < n) next.push(defaultDiaria())
      return { ...l, diarias: next }
    }))
  }, [activePhase, getPhaseDefaults])

  /* Agrupar por fase e depois por departamento (pré → produção → pós) */
  const linesByPhaseAndDept = useMemo(() => {
    const byPhase: Record<string, Record<string, ClosingLine[]>> = { pre: {}, prod: {}, pos: {} }
    const deptOrder: Record<string, string[]> = { pre: [], prod: [], pos: [] }
    closingLines.forEach((l) => {
      const phase = l.phase in byPhase ? l.phase : 'prod'
      if (!byPhase[phase][l.department]) {
        byPhase[phase][l.department] = []
        deptOrder[phase].push(l.department)
      }
      byPhase[phase][l.department].push(l)
    })
    const result: { phase: string; phaseLabel: string; depts: { dept: string; lines: ClosingLine[] }[] }[] = []
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const depts = deptOrder[phase].map((dept) => ({ dept, lines: byPhase[phase][dept] }))
      if (depts.length > 0) {
        result.push({ phase, phaseLabel: PHASE_LABELS[phase] ?? phase, depts })
      }
    })
    return result
  }, [closingLines])

  /* Totais */
  const totalCustoFinal = useMemo(() => closingLines.reduce((s, l) => s + calcTotalNF(l), 0), [closingLines])
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.value, 0), [expenses])
  const totalPago = useMemo(() => {
    const fromLines = closingLines.filter((l) => l.payStatus === 'pago').reduce((s, l) => s + calcTotalNF(l), 0)
    const fromExp = expenses.filter((e) => e.payStatus === 'pago').reduce((s, e) => s + e.value, 0)
    return fromLines + fromExp
  }, [closingLines, expenses])
  const totalPendente = useMemo(() => {
    const fromLines = closingLines.filter((l) => l.payStatus === 'pendente').reduce((s, l) => s + calcTotalNF(l), 0)
    const fromExp = expenses.filter((e) => e.payStatus === 'pendente').reduce((s, e) => s + e.value, 0)
    return fromLines + fromExp
  }, [closingLines, expenses])
  const lucroFinal = initialJobValue - totalCustoFinal - totalExpenses

  /* Saving: economia inicial vs final nos itens selecionados; valor a pagar = economia × % */
  const { totalEconomy, valueToPay } = useMemo(() => {
    if (!finalSnapshot || saving.items.length === 0) return { totalEconomy: 0, valueToPay: 0 }
    const init = initialSnapshot
    let economy = 0
    saving.items.forEach((key) => {
      const initialTotal = init ? sumSnapshotTotal(init.budgetLines, init.verbaLines, key) : 0
      const finalTotal = sumSnapshotTotal(finalSnapshot.budgetLines, finalSnapshot.verbaLines, key)
      const diff = initialTotal - finalTotal
      if (diff > 0) economy += diff
    })
    const pct = Math.min(25, Math.max(5, saving.pct)) / 100
    return { totalEconomy: economy, valueToPay: economy * pct }
  }, [finalSnapshot, initialSnapshot, saving.items, saving.pct])

  const laborLinesForSaving = useMemo(() => closingLines.filter((l) => l.isLabor && (l.name || l.role)), [closingLines])

  /* Prestação de contas */
  const addExpense = useCallback(() => {
    if (isLocked) return
    setExpenses((prev) => [...prev, { id: `exp-${Date.now()}`, name: '', description: '', value: 0, invoiceNumber: '', payStatus: 'pendente' }])
  }, [isLocked])
  const updateExpense = useCallback((id: string, updates: Partial<ExpenseLine>) => {
    if (isLocked) return
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }, [isLocked])
  const removeExpense = useCallback((id: string) => {
    if (isLocked) return
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }, [isLocked])

  if (!finalSnapshot) {
    return (
      <PageLayout title="Fechamento">
        <div className="text-center py-12" style={{ color: resolve.muted }}>
          <p className="text-sm">Finalize o Orçamento Final para acessar o Fechamento.</p>
        </div>
      </PageLayout>
    )
  }

  /* Finance strip */
  const financeStrip = (
    <div
      className="rounded overflow-hidden grid grid-cols-1 lg:grid-cols-5 gap-0 border-b min-w-0"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.purple, borderRadius: 3 }}
    >
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Valor Job</label>
        <div className="text-base sm:text-lg font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(initialJobValue)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Custo Final</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(totalCustoFinal + totalExpenses)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Total Pago</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: cinema.success }}>{formatCurrency(totalPago)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Pendente</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: cinema.danger }}>{formatCurrency(totalPendente)}</div>
      </div>
      <div className="p-3 flex flex-col items-center justify-center min-w-0">
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Lucro Final</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: lucroFinal >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(lucroFinal)}</div>
      </div>
    </div>
  )

  const closingTabs = (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 items-center w-full min-w-0">
      {/* Saving: alinhado à esquerda */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 items-center min-w-0">
        <button
          type="button"
          onClick={() => setSavingModalOpen(true)}
          disabled={isLocked}
          className="h-8 px-2 sm:px-3 md:px-4 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1"
          style={{
            backgroundColor: resolve.panel,
            borderColor: resolve.border,
            color: resolve.text,
          }}
        >
          Saving
        </button>
        <span className="text-[11px] min-w-0 truncate max-w-[120px] sm:max-w-none" style={{ color: resolve.muted }} title={`Total economia: ${formatCurrency(totalEconomy)}`}>
          <span className="hidden sm:inline">Total economia: </span><strong className="font-mono" style={{ color: resolve.text }}>{formatCurrency(totalEconomy)}</strong>
        </span>
        <select
          className="h-8 px-2 rounded text-[10px] sm:text-xs font-medium border focus:outline-none min-w-0"
          style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
          value={saving.pct}
          onChange={(e) => setSaving((prev) => ({ ...prev, pct: Number(e.target.value) }))}
          disabled={isLocked}
        >
          {SAVING_PCT_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}%</option>
          ))}
        </select>
        <span className="text-[11px]" style={{ color: resolve.muted }}>
          A pagar: <strong className="font-mono" style={{ color: cinema.success }}>{formatCurrency(valueToPay)}</strong>
        </span>
        <select
          className="h-8 px-2 rounded text-[10px] sm:text-xs font-medium border focus:outline-none min-w-[90px] md:min-w-[140px]"
          style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
          value={saving.responsibleId ?? ''}
          onChange={(e) => setSaving((prev) => ({ ...prev, responsibleId: e.target.value || null }))}
          disabled={isLocked}
        >
          <option value="">Responsável</option>
          {laborLinesForSaving.map((l) => (
            <option key={l.id} value={l.id}>{l.name || l.role || '—'} ({l.department})</option>
          ))}
        </select>
      </div>
      {onToggleLock && (
        <button
          type="button"
          onClick={onToggleLock}
          className="ml-auto h-8 px-2 sm:px-3 md:px-4 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1"
          style={{
            backgroundColor: isLocked ? '#e67e22' : cinema.success,
            borderColor: isLocked ? '#e67e22' : cinema.success,
            color: '#ffffff',
          }}
        >
          {isLocked ? <LockOpen size={16} strokeWidth={2} aria-hidden style={{ color: '#fff' }} /> : <Lock size={16} strokeWidth={2} aria-hidden style={{ color: '#fff' }} />}
          <span className="md:hidden">{isLocked ? 'Reabrir' : 'Concluir'}</span>
          <span className="hidden md:inline">{isLocked ? 'Reabrir fechamento' : 'Concluir fechamento'}</span>
        </button>
      )}
      {/* Modal de seleção dos itens do Saving */}
      {savingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setSavingModalOpen(false)}
        >
          <div
            className="rounded border p-4 max-w-md w-full shadow-xl"
            style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: resolve.text }}>Itens incluídos no Saving</h3>
            <div className="flex flex-col gap-2 mb-4">
              {SAVING_ITEMS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-[12px]" style={{ color: resolve.text }}>
                  <input
                    type="checkbox"
                    checked={saving.items.includes(key)}
                    onChange={(e) => {
                      setSaving((prev) => ({
                        ...prev,
                        items: e.target.checked ? [...prev.items, key] : prev.items.filter((i) => i !== key),
                      }))
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSavingModalOpen(false)}
              className="w-full py-2 rounded text-xs font-medium uppercase border"
              style={{ backgroundColor: resolve.yellowDark, borderColor: resolve.yellow, color: resolve.bg }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const activePhaseData = linesByPhaseAndDept.find((p) => p.phase === activePhase)

  return (
    <PageLayout title="Fechamento" strip={financeStrip} tabs={closingTabs}>
      {/* Navegação entre fases (como no Orçamento) */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center mb-4">
        {PHASE_TABS.map(({ key, label }) => {
          const isActive = activePhase === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActivePhase(key)}
              className="btn-resolve-hover h-8 flex-1 sm:flex-none min-w-0 px-2 sm:px-3 md:px-4 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border whitespace-nowrap"
              style={{
                backgroundColor: isActive ? resolve.yellowDark : resolve.panel,
                borderColor: isActive ? resolve.yellow : resolve.border,
                color: isActive ? resolve.bg : resolve.muted,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Blocos do departamento da fase ativa */}
      <div className={isLocked ? 'locked-sheet' : ''}>
        {!activePhaseData?.depts.length ? (
          <div className="py-8 text-center text-sm rounded border" style={{ color: resolve.muted, borderColor: resolve.border, backgroundColor: resolve.panel }}>
            Nenhum item nesta fase.
          </div>
        ) : (
        activePhaseData.depts.map(({ dept, lines }) => {
              const deptTotal = lines.reduce((s, l) => s + calcTotalNF(l), 0)
              return (
                <div key={`${activePhase}-${dept}`} className="overflow-hidden border rounded mb-6" style={{ borderColor: resolve.border, borderRadius: 3 }}>
                  <div className="px-3 py-2 flex justify-between items-center border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>{dept}</span>
                    <span className="font-mono text-[13px] font-medium" style={{ color: resolve.text }}>{formatCurrency(deptTotal)}</span>
                  </div>

                  <div className="overflow-x-auto" style={{ backgroundColor: resolve.panel }}>
                    {lines.map((line, lineIdx) => {
                      const overtime = calcOvertime(line)
                      const totalNF = calcTotalNF(line)
                      const diarias = normalizeDiarias(line)
                      const collab = line.name ? findCollaboratorByName(collaborators, line.name) : undefined
                      return (
                        <div
                          key={line.id}
                          className="border-b last:border-b-0"
                          style={{
                            borderColor: resolve.border,
                            borderBottomWidth: lineIdx < lines.length - 1 ? 2 : undefined,
                            marginBottom: lineIdx < lines.length - 1 ? 0 : undefined,
                          }}
                        >
                          {/* Linha principal: nome, função, jornada (diária/semana), botão FECHAR (sem+expandido) e botões de informação */}
                          <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                            <div className="min-w-0 flex items-center gap-2 flex-wrap flex-1">
                              <span className="text-xs font-medium" style={{ color: resolve.text }}>{line.name || '—'}</span>
                              {line.role && line.role !== line.name && (
                                <span className="text-[11px]" style={{ color: resolve.muted }}>{line.role}</span>
                              )}
                              {line.isLabor && line.type && (
                                <span
                                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: resolve.border, color: resolve.muted }}
                                  title="Jornada de pagamento"
                                >
                                  {JORNADA_LABEL[line.type] ?? line.type}
                                </span>
                              )}
                              {line.isLabor && line.type === 'sem' && showOvertimeForLineId[line.id] && (
                                <button
                                  type="button"
                                  onClick={() => setShowOvertimeForLineId((prev) => ({ ...prev, [line.id]: false }))}
                                  className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border transition-colors"
                                  style={{ borderColor: resolve.border, color: resolve.muted }}
                                >
                                  Fechar
                                </button>
                              )}
                            </div>
                            {line.isLabor && (line.name || line.role) && (
                              <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                <button type="button" title="Telefone, e-mail e endereço" className={iconBtnCls} style={{ borderColor: resolve.border, color: resolve.text }} onClick={() => setModalContact(collab ?? 'no-data')}><span className="font-serif font-bold">i</span></button>
                                <button type="button" title="Dados bancários e PIX" className={iconBtnCls} style={{ borderColor: resolve.border, color: resolve.text }} onClick={() => setModalBank(collab ?? 'no-data')}>$</button>
                                <button type="button" title="Contrato (Drive) — em breve" className={`${iconBtnCls} opacity-70`} style={{ borderColor: resolve.border, color: resolve.text }} onClick={() => window.alert('Abertura do contrato (Google Drive) será implementada em breve.')}>✎</button>
                                <button type="button" title="Nota fiscal (Drive) — em breve" className={`${iconBtnCls} opacity-70`} style={{ borderColor: resolve.border, color: resolve.text }} onClick={() => window.alert('Abertura da nota fiscal (Google Drive) será implementada em breve.')}>📄</button>
                              </div>
                            )}
                          </div>

                          {/* Uma linha de diária por dia (labor). Por semana: oculto até clicar em "Calcular hora extra das diárias" */}
                          {line.isLabor && line.type === 'sem' && !showOvertimeForLineId[line.id] && (
                            <div className="px-3 py-2 border-t flex items-center" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                              <button
                                type="button"
                                onClick={() => expandOvertimeForSemLine(line.id)}
                                className="text-[11px] font-medium uppercase tracking-wider px-3 py-1.5 rounded border transition-colors"
                                style={{ borderColor: resolve.border, color: resolve.muted }}
                              >
                                Calcular hora extra das diárias
                              </button>
                              <span className="ml-2 text-[10px]" style={{ color: resolve.muted }}>(ref.: {formatCurrency(getCachePerDay(line))}/dia)</span>
                            </div>
                          )}
                          {line.isLabor && (line.type !== 'sem' || showOvertimeForLineId[line.id]) && (
                            <div className="px-3 py-3 border-t space-y-3" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                              {diarias.map((d, diariaIdx) => (
                                <div
                                  key={diariaIdx}
                                  className={`grid grid-cols-2 sm:grid-cols-5 gap-x-1.5 gap-y-1 items-center ${diariaIdx < diarias.length - 1 ? 'border-b pb-3' : ''}`}
                                  style={{ borderColor: diariaIdx < diarias.length - 1 ? resolve.border : undefined }}
                                >
                                  <div className="self-stretch h-full min-h-0 flex items-stretch gap-1.5 min-w-0 col-span-2 sm:col-span-1">
                                    <span className="text-[10px] uppercase whitespace-nowrap truncate flex items-center font-bold" style={{ color: resolve.muted }} title="Valor da diária de referência">{formatCurrency(getCachePerDay(line))}/dia</span>
                                    {sepVertical()}
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Diária {diarias.length > 1 ? `${diariaIdx + 1} (horas)` : 'de'}</label>
                                    <select className={inputDiariaClassName} style={inputStyle} value={d.dailyHours} onChange={(e) => updateDiaria(line.id, diariaIdx, { dailyHours: Number(e.target.value) })}>
                                      {DAILY_HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h}h</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Adicional</label>
                                    <select className={inputDiariaClassName} style={inputStyle} value={d.additionalPct} onChange={(e) => updateDiaria(line.id, diariaIdx, { additionalPct: Number(e.target.value) })}>
                                      {ADDITIONAL_OPTIONS.map((p) => <option key={p} value={p}>{p}%</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Horas Extra</label>
                                    <select className={inputDiariaClassName} style={inputStyle} value={d.overtimeHours} onChange={(e) => updateDiaria(line.id, diariaIdx, { overtimeHours: Number(e.target.value) })}>
                                      {OVERTIME_OPTIONS.map((h) => <option key={h} value={h}>{h}h</option>)}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                                    {diarias.length > 1 && (
                                      <button type="button" onClick={() => removeDiaria(line.id, diariaIdx)} className="h-7 w-7 flex items-center justify-center rounded border" style={{ borderColor: resolve.border, color: resolve.muted }} title="Excluir diária" aria-label="Excluir diária"><X size={14} strokeWidth={2} /></button>
                                    )}
                                    {diariaIdx === diarias.length - 1 && (
                                      <button type="button" onClick={() => addDiaria(line.id)} className="h-7 px-2 flex items-center justify-center gap-1 rounded border text-[10px] font-medium uppercase" style={{ borderColor: resolve.border, color: resolve.text }} title="Adicionar diária"><Plus size={12} strokeWidth={2} style={{ color: 'currentColor' }} />Diária</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Linha de resumo: CACHÊ TOTAL | CACHÊ DIA 1… (ou REF. CACHÊ/DIA para sem) | DESL. | HE | Saving | NF (tudo maiúsculo, separadores verticais) */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 border-t text-[10px] uppercase tracking-wider" style={{ borderColor: resolve.border, color: resolve.muted }}>
                            {line.isLabor ? (
                              <>
                                <span className="whitespace-nowrap">Cachê total <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.finalUnitCost * line.finalQuantity)}</strong></span>
                                {line.type === 'dia' && (
                                  <>
                                    {sepVertical()}
                                    {diarias.length <= 1 ? (
                                      <span className="whitespace-nowrap">Cachê/dia <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(getCachePerDay(line))}</strong></span>
                                    ) : (
                                      diarias.map((_, i) => (
                                        <Fragment key={i}>
                                          {i > 0 && sepVertical()}
                                          <span className="whitespace-nowrap">Cachê dia {i + 1} <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(getCachePerDay(line))}</strong></span>
                                        </Fragment>
                                      ))
                                    )}
                                  </>
                                )}
                                {line.finalExtraCost > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Desl. <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.finalExtraCost * line.finalQuantity)}</strong></span>
                                  </>
                                )}
                                {line.type === 'sem' && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Ref. cachê/dia <span className="font-mono" style={{ color: resolve.muted }}>{formatCurrency(getCachePerDay(line))}</span></span>
                                  </>
                                )}
                                {overtime > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">HE <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(overtime)}</strong></span>
                                  </>
                                )}
                                {saving.responsibleId === line.id && valueToPay > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Saving <strong className="font-mono" style={{ color: cinema.success }}>{formatCurrency(valueToPay)}</strong></span>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {line.isVerba && <span>Verba</span>}
                              </>
                            )}
                            {sepVertical()}
                            <div className="flex items-center gap-1">
                              <span>NF</span>
                              <input className="py-0.5 px-1.5 text-[10px] uppercase focus:outline-none w-20" style={inputStyle} value={line.invoiceNumber} onChange={(e) => updateLine(line.id, { invoiceNumber: e.target.value })} placeholder="NF" />
                            </div>
                            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                              <span className="font-mono text-[11px] font-medium whitespace-nowrap" style={{ color: resolve.yellow }}>
                                {formatCurrency(saving.responsibleId === line.id && valueToPay > 0 ? totalNF + valueToPay : totalNF)}
                              </span>
                              <button
                                type="button"
                                className="text-[10px] font-medium uppercase px-2.5 py-0.5 rounded transition-colors whitespace-nowrap"
                                style={{ backgroundColor: line.payStatus === 'pago' ? cinema.success : cinema.danger, color: '#fff' }}
                                onClick={() => updateLine(line.id, { payStatus: line.payStatus === 'pago' ? 'pendente' : 'pago' })}
                              >
                                {line.payStatus === 'pago' ? 'PAGO ✓' : 'A PAGAR'}
                              </button>
                            </div>
                          </div>
                </div>
              )
            })}
                  </div>
                </div>
              )
            })
        )}
      </div>

      {/* Prestação de contas */}
      <div className={`overflow-hidden border rounded mt-1 ${isLocked ? 'locked-sheet' : ''}`} style={{ borderColor: resolve.border, borderRadius: 3 }}>
        <div className="px-3 py-2 flex justify-between items-center border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>Prestação de contas</span>
        </div>
        <div className="p-2 sm:p-3 overflow-x-auto min-w-0" style={{ backgroundColor: resolve.panel }}>
          <table className="w-full border-collapse text-[11px] min-w-[500px]">
            <thead>
              <tr className="border-b" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Nome</th>
                <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Descrição</th>
                <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Valor</th>
                <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>NF</th>
                <th className="text-center text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b" style={{ borderColor: resolve.border }}>
                  <td className="p-1.5"><input className={inputClassName} style={inputStyle} value={exp.name} onChange={(e) => updateExpense(exp.id, { name: e.target.value })} placeholder="Nome" /></td>
                  <td className="p-1.5"><input className={inputClassName} style={inputStyle} value={exp.description} onChange={(e) => updateExpense(exp.id, { description: e.target.value })} placeholder="Descrição" /></td>
                  <td className="p-1.5">
                    <input
                      className={inputClassName}
                      style={inputStyle}
                      value={exp.value > 0 ? formatCurrency(exp.value) : ''}
                      onFocus={(e) => { e.target.value = exp.value > 0 ? exp.value.toFixed(2).replace('.', ',') : '' }}
                      onChange={(e) => updateExpense(exp.id, { value: parseCurrencyInput(e.target.value) })}
                      onBlur={(e) => { e.target.value = exp.value > 0 ? formatCurrency(exp.value) : '' }}
                      placeholder="R$ 0,00"
                    />
                  </td>
                  <td className="p-1.5"><input className={inputClassName} style={inputStyle} value={exp.invoiceNumber} onChange={(e) => updateExpense(exp.id, { invoiceNumber: e.target.value })} placeholder="NF" /></td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      className="text-[10px] font-medium uppercase px-2 py-1 rounded"
                      style={{ backgroundColor: exp.payStatus === 'pago' ? cinema.success : cinema.danger, color: '#fff' }}
                      onClick={() => updateExpense(exp.id, { payStatus: exp.payStatus === 'pago' ? 'pendente' : 'pago' })}
                    >
                      {exp.payStatus === 'pago' ? 'PAGO ✓' : 'A PAGAR'}
                    </button>
                  </td>
                  <td className="p-1.5 text-center">
                    <button type="button" onClick={() => removeExpense(exp.id)} className="btn-remove-row inline-flex items-center justify-center" aria-label="Remover"><X size={16} strokeWidth={2} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn-resolve-hover w-full mt-2 py-2.5 border border-dashed rounded text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer"
            style={{ borderColor: resolve.border, color: resolve.muted, borderRadius: 3 }}
            onClick={addExpense}
          >
            <Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} className="shrink-0" /> Adicionar conta
          </button>
        </div>
      </div>

      {/* Modal: Contato (telefone, e-mail, endereço) */}
      {modalContact !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalContact(null)}>
          <div className="rounded border p-4 w-full max-w-sm shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: resolve.text }}><span>ℹ</span> Contato</h3>
            {modalContact !== 'no-data' ? (
              <div className="space-y-0 text-sm">
                <CopyableLine label="Telefone" value={modalContact.telefone ?? ''} />
                <CopyableLine label="E-mail" value={modalContact.email ?? ''} />
                <CopyableLine label="Endereço" value={modalContact.endereco ?? ''} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: resolve.muted }}>Nenhum colaborador cadastrado com este nome.</p>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setModalContact(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ borderColor: resolve.border, color: resolve.text }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dados bancários e PIX */}
      {modalBank !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalBank(null)}>
          <div className="rounded border p-4 w-full max-w-sm shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: resolve.text }}><span>$</span> Dados bancários</h3>
            {modalBank !== 'no-data' ? (
              <div className="space-y-0 text-sm">
                <CopyableLine label="Banco" value={modalBank.banco ?? ''} />
                <CopyableLine label="Agência" value={modalBank.agencia ?? ''} />
                <CopyableLine label="Conta" value={modalBank.conta ?? ''} />
                <CopyableLine label="PIX" value={modalBank.pix ?? ''} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: resolve.muted }}>Nenhum colaborador cadastrado com este nome.</p>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setModalBank(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ borderColor: resolve.border, color: resolve.text }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
})

export default ViewFechamento
