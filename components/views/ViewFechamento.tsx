'use client'

import { useMemo, useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import PageLayout from '@/components/PageLayout'
import { DEPARTMENTS, LABOR_DEPTS, VERBA_DEPTS } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { BudgetLinesByPhase, VerbaLinesByPhase, MiniTablesData, BudgetRow, BudgetRowLabor } from '@/lib/types'
import { computeRowTotal, computeVerbaRowTotal, sumDeptTotal } from '@/lib/budgetUtils'

/* ── Tipos internos ── */
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
  dailyHours: number
  additionalPct: number
  overtimeHours: number
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
const UNIT_TYPE_LABELS: Record<string, string> = {
  dia: 'Dia', sem: 'Semana', flat: 'Fechado',
  cache: 'Cachê', verba: 'Verba', extra: 'Extra',
}

function calcOvertime(line: ClosingLine): number {
  if (!line.isLabor || line.dailyHours <= 0) return 0
  const hourlyRate = line.finalUnitCost / line.dailyHours
  const additionalRate = hourlyRate * (line.additionalPct / 100)
  const rateWithAdditional = hourlyRate + additionalRate
  return rateWithAdditional * line.overtimeHours
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
}

export interface ViewFechamentoHandle {
  getState: () => { closingLines: ClosingLine[]; expenses: ExpenseLine[]; saving: SavingConfig | undefined }
  loadState: (state: { closingLines: ClosingLine[]; expenses: ExpenseLine[]; saving?: SavingConfig | null }) => void
}

/* ── Componente ── */
const defaultSaving: SavingConfig = { items: [], pct: 10, responsibleId: null }

const ViewFechamento = forwardRef<ViewFechamentoHandle, ViewFechamentoProps>(function ViewFechamento({ finalSnapshot, initialSnapshot, initialJobValue, isLocked = false, onToggleLock }, ref) {
  const [closingLines, setClosingLines] = useState<ClosingLine[]>([])
  const [expenses, setExpenses] = useState<ExpenseLine[]>([])
  const [saving, setSaving] = useState<SavingConfig>(defaultSaving)
  const [savingModalOpen, setSavingModalOpen] = useState(false)
  const loadedFromDB = useRef(false)

  useImperativeHandle(ref, () => ({
    getState: () => ({ closingLines, expenses, saving: saving.items.length > 0 || saving.responsibleId ? saving : undefined }),
    loadState: (state) => {
      loadedFromDB.current = state.closingLines.length > 0 || state.expenses.length > 0
      setClosingLines(state.closingLines)
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
          const total = computeRowTotal(row)
          if (total <= 0 && !row.itemName && !row.roleFunction) return
          const laborRow = row as BudgetRowLabor
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
            dailyHours: 8,
            additionalPct: 0,
            overtimeHours: 0,
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
            dailyHours: 8,
            additionalPct: 0,
            overtimeHours: 0,
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

  /* Agrupar linhas por departamento (mantendo a ordem original) */
  const linesByDept = useMemo(() => {
    const map: { dept: string; lines: ClosingLine[] }[] = []
    const seen = new Set<string>()
    closingLines.forEach((l) => {
      const key = `${l.phase}-${l.department}`
      if (!seen.has(key)) {
        seen.add(key)
        map.push({ dept: l.department, lines: [] })
      }
      map.find((g) => g.dept === l.department && g.lines === map.find((m) => `${closingLines.find((cl) => cl.department === l.department && cl.phase === l.phase)?.phase}-${l.department}` === key)?.lines)
    })
    // Simpler approach: group by dept name
    const grouped: Record<string, ClosingLine[]> = {}
    const order: string[] = []
    closingLines.forEach((l) => {
      if (!grouped[l.department]) {
        grouped[l.department] = []
        order.push(l.department)
      }
      grouped[l.department].push(l)
    })
    return order.map((dept) => ({ dept, lines: grouped[dept] }))
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
          <span aria-hidden>{isLocked ? '🔓' : '🔒'}</span>
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

  return (
    <PageLayout title="Fechamento" strip={financeStrip} tabs={closingTabs}>
      {/* Blocos por departamento */}
      <div className={isLocked ? 'locked-sheet' : ''}>
        {linesByDept.map(({ dept, lines }) => {
          const deptTotal = lines.reduce((s, l) => s + calcTotalNF(l), 0)
          return (
            <div key={dept} className="overflow-hidden border rounded mb-6" style={{ borderColor: resolve.border, borderRadius: 3 }}>
              {/* Header do departamento */}
              <div className="px-3 py-2 flex justify-between items-center border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>{dept}</span>
                <span className="font-mono text-[13px] font-medium" style={{ color: resolve.text }}>{formatCurrency(deptTotal)}</span>
              </div>

              <div className="overflow-x-auto" style={{ backgroundColor: resolve.panel }}>
                {lines.map((line) => {
                  const overtime = calcOvertime(line)
                  const totalNF = calcTotalNF(line)
                  const periodLabel = UNIT_TYPE_LABELS[line.type] ?? line.type
                  return (
                    <div key={line.id} className="border-b" style={{ borderColor: resolve.border }}>
                      {/* Linha principal */}
                      <div className="grid items-center gap-2 px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.03)', gridTemplateColumns: '1fr auto auto' }}>
                        <div className="min-w-0">
                          <span className="text-xs font-medium" style={{ color: resolve.text }}>{line.name || '—'}</span>
                          {line.role && line.role !== line.name && (
                            <span className="text-[11px] ml-2" style={{ color: resolve.muted }}>{line.role}</span>
                          )}
                        </div>
                        <span className="text-[11px] whitespace-nowrap" style={{ color: resolve.muted, justifySelf: 'center' }}>
                          Período: <strong style={{ color: resolve.text }}>{periodLabel}</strong>
                        </span>
                        <span className="text-[11px] whitespace-nowrap" style={{ color: resolve.muted, justifySelf: 'center' }}>
                          {line.finalQuantity > 0 && <>Qtd: <strong style={{ color: resolve.text }}>{line.finalQuantity}</strong></>}
                        </span>
                      </div>

                      {/* Linha de fechamento (labor only) */}
                      {line.isLabor && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 py-2 border-t" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                          <div>
                            <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Diária de</label>
                            <select className={inputClassName} style={inputStyle} value={line.dailyHours} onChange={(e) => updateLine(line.id, { dailyHours: Number(e.target.value) })}>
                              {DAILY_HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h}h</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Adicional</label>
                            <select className={inputClassName} style={inputStyle} value={line.additionalPct} onChange={(e) => updateLine(line.id, { additionalPct: Number(e.target.value) })}>
                              {ADDITIONAL_OPTIONS.map((p) => <option key={p} value={p}>{p}%</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Horas Extra</label>
                            <select className={inputClassName} style={inputStyle} value={line.overtimeHours} onChange={(e) => updateLine(line.id, { overtimeHours: Number(e.target.value) })}>
                              {OVERTIME_OPTIONS.map((h) => <option key={h} value={h}>{h}h</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Nota Fiscal</label>
                            <input className={inputClassName} style={inputStyle} value={line.invoiceNumber} onChange={(e) => updateLine(line.id, { invoiceNumber: e.target.value })} placeholder="NF" />
                          </div>
                        </div>
                      )}

                      {/* Linha de resumo com detalhes de valores + total e status */}
                      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-t text-[10px]" style={{ borderColor: resolve.border, color: resolve.muted }}>
                        {line.isLabor ? (
                          <>
                            <span>Cachê: <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.finalUnitCost * line.finalQuantity)}</strong></span>
                            {line.finalExtraCost > 0 && (
                              <span>Desl.: <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.finalExtraCost * line.finalQuantity)}</strong></span>
                            )}
                            {overtime > 0 && (
                              <span>HE: <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(overtime)}</strong></span>
                            )}
                            {saving.responsibleId === line.id && valueToPay > 0 && (
                              <span>Saving: <strong className="font-mono" style={{ color: cinema.success }}>{formatCurrency(valueToPay)}</strong></span>
                            )}
                          </>
                        ) : (
                          <>
                            {!line.isVerba && (
                              <div className="flex items-center gap-1">
                                <span>NF:</span>
                                <input className="py-0.5 px-1.5 text-xs focus:outline-none w-24" style={inputStyle} value={line.invoiceNumber} onChange={(e) => updateLine(line.id, { invoiceNumber: e.target.value })} placeholder="NF" />
                              </div>
                            )}
                            {line.isVerba && <span>Verba</span>}
                          </>
                        )}
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono text-[11px] font-medium whitespace-nowrap" style={{ color: resolve.yellow }}>
                            {formatCurrency(saving.responsibleId === line.id && valueToPay > 0 ? totalNF + valueToPay : totalNF)}
                          </span>
                          <button
                            type="button"
                            className="text-[10px] font-medium uppercase px-2.5 py-0.5 rounded transition-colors whitespace-nowrap"
                            style={{
                              backgroundColor: line.payStatus === 'pago' ? cinema.success : cinema.danger,
                              color: '#fff',
                            }}
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
        })}
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
                    <button type="button" onClick={() => removeExpense(exp.id)} className="btn-remove-row" aria-label="Remover">×</button>
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
            + Adicionar conta
          </button>
        </div>
      </div>
    </PageLayout>
  )
})

export default ViewFechamento
