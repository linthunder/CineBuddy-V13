'use client'

import { useMemo, useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import PageLayout from '@/components/PageLayout'
import { DEPARTMENTS, LABOR_DEPTS, VERBA_DEPTS } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { BudgetLinesByPhase, VerbaLinesByPhase, MiniTablesData, BudgetRow, BudgetRowLabor } from '@/lib/types'
import { computeRowTotal, computeVerbaRowTotal } from '@/lib/budgetUtils'

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
const inputClassName = 'w-full py-1 px-2 text-sm focus:outline-none'

const DAILY_HOURS_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const ADDITIONAL_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const OVERTIME_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

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
  initialJobValue: number
  isLocked?: boolean
}

export interface ViewFechamentoHandle {
  getState: () => { closingLines: ClosingLine[]; expenses: ExpenseLine[] }
  loadState: (state: { closingLines: ClosingLine[]; expenses: ExpenseLine[] }) => void
}

/* ── Componente ── */
const ViewFechamento = forwardRef<ViewFechamentoHandle, ViewFechamentoProps>(function ViewFechamento({ finalSnapshot, initialJobValue, isLocked = false }, ref) {
  const [closingLines, setClosingLines] = useState<ClosingLine[]>([])
  const [expenses, setExpenses] = useState<ExpenseLine[]>([])
  const loadedFromDB = useRef(false)

  useImperativeHandle(ref, () => ({
    getState: () => ({ closingLines, expenses }),
    loadState: (state) => {
      // Só ativa o flag se houver dados reais (evita bloquear a cascata ao resetar)
      loadedFromDB.current = state.closingLines.length > 0 || state.expenses.length > 0
      setClosingLines(state.closingLines)
      setExpenses(state.expenses)
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
      className="rounded overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-b"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.purple, borderRadius: 3 }}
    >
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Valor Job</label>
        <div className="text-base sm:text-lg font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(initialJobValue)}</div>
      </div>
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Custo Final</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(totalCustoFinal + totalExpenses)}</div>
      </div>
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Total Pago</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: cinema.success }}>{formatCurrency(totalPago)}</div>
      </div>
      <div className="p-3 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Pendente</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: cinema.danger }}>{formatCurrency(totalPendente)}</div>
      </div>
      <div className="p-3 flex flex-col items-center justify-center">
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Lucro Final</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: lucroFinal >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(lucroFinal)}</div>
      </div>
    </div>
  )

  return (
    <PageLayout title="Fechamento" strip={financeStrip}>
      {/* Blocos por departamento */}
      <div className={isLocked ? 'locked-sheet' : ''}>
        {linesByDept.map(({ dept, lines }) => {
          const deptTotal = lines.reduce((s, l) => s + calcTotalNF(l), 0)
          return (
            <div key={dept} className="overflow-hidden border rounded mb-3" style={{ borderColor: resolve.border, borderRadius: 3 }}>
              {/* Header do departamento */}
              <div className="px-3 py-2 flex justify-between items-center border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>{dept}</span>
                <span className="font-mono text-sm font-medium" style={{ color: resolve.text }}>{formatCurrency(deptTotal)}</span>
              </div>

              <div className="overflow-x-auto" style={{ backgroundColor: resolve.panel }}>
                {lines.map((line) => {
                  const overtime = calcOvertime(line)
                  const totalNF = calcTotalNF(line)
                  const periodLabel = UNIT_TYPE_LABELS[line.type] ?? line.type
                  return (
                    <div key={line.id} className="border-b" style={{ borderColor: resolve.border }}>
                      {/* Linha principal */}
                      <div className="grid items-center gap-2 px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.03)', gridTemplateColumns: '1fr auto 1fr auto auto' }}>
                        <div className="min-w-0">
                          <span className="text-xs font-medium" style={{ color: resolve.text }}>{line.name || '—'}</span>
                          {line.role && line.role !== line.name && (
                            <span className="text-[10px] ml-2" style={{ color: resolve.muted }}>{line.role}</span>
                          )}
                        </div>
                        <span className="text-[10px] whitespace-nowrap" style={{ color: resolve.muted, justifySelf: 'center' }}>
                          Período: <strong style={{ color: resolve.text }}>{periodLabel}</strong>
                        </span>
                        <span className="text-[10px] whitespace-nowrap" style={{ color: resolve.muted, justifySelf: 'center' }}>
                          {line.finalQuantity > 0 && <>Qtd: <strong style={{ color: resolve.text }}>{line.finalQuantity}</strong></>}
                        </span>
                        <span className="font-mono text-sm font-medium whitespace-nowrap" style={{ color: resolve.text }}>{formatCurrency(totalNF)}</span>
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

                      {/* Linha de resumo com detalhes de valores */}
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
        <div className="p-2 sm:p-3 overflow-x-auto" style={{ backgroundColor: resolve.panel }}>
          <table className="w-full border-collapse text-sm min-w-[500px]">
            <thead>
              <tr className="border-b" style={{ borderColor: resolve.border }}>
                <th className="text-left text-[11px] uppercase font-medium py-1.5 px-2" style={{ color: resolve.muted }}>Nome</th>
                <th className="text-left text-[11px] uppercase font-medium py-1.5 px-2" style={{ color: resolve.muted }}>Descrição</th>
                <th className="text-left text-[11px] uppercase font-medium py-1.5 px-2" style={{ color: resolve.muted }}>Valor</th>
                <th className="text-left text-[11px] uppercase font-medium py-1.5 px-2" style={{ color: resolve.muted }}>NF</th>
                <th className="text-center text-[11px] uppercase font-medium py-1.5 px-2" style={{ color: resolve.muted }}>Status</th>
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
