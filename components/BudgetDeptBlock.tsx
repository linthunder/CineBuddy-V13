'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { BudgetRow, VerbaRow } from '@/lib/types'
import { CUSTOM_HEADERS, LABOR_DEPTS } from '@/lib/constants'
import { computeRowTotal, computeVerbaRowTotal } from '@/lib/budgetUtils'
import { resolve } from '@/lib/theme'
import BudgetTableRow from './BudgetTableRow'

interface BudgetDeptBlockProps {
  department: string
  rows: BudgetRow[]
  verbaRows: VerbaRow[]
  showVerbaButton: boolean
  cacheTableId?: string | null
  onAddRow: () => void
  onUpdateRow: (rowId: string, updates: Partial<BudgetRow>) => void
  onRemoveRow: (rowId: string) => void
  onAddVerbaRow: () => void
  onUpdateVerbaRow: (rowId: string, updates: Partial<VerbaRow>) => void
  onRemoveVerbaRow: (rowId: string) => void
}

const inputStyle = { backgroundColor: resolve.bg, border: `1px solid ${resolve.border}`, color: resolve.text, borderRadius: 2 }
const inputClassName = 'w-full py-1 px-2 text-[11px] focus:outline-none min-w-[4.5rem]'

function toVerbaEditValue(n: number): string {
  if (n <= 0) return ''
  return n.toFixed(2).replace('.', ',')
}

export default function BudgetDeptBlock({
  department,
  rows,
  verbaRows,
  showVerbaButton,
  cacheTableId,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onAddVerbaRow,
  onUpdateVerbaRow,
  onRemoveVerbaRow,
}: BudgetDeptBlockProps) {
  const isLabor = LABOR_DEPTS.includes(department as never)
  const custom = CUSTOM_HEADERS[department]
  const itemLabel = custom?.item ?? 'Item'
  const supplierLabel = custom?.supplier ?? 'Fornecedor'
  const deptTotal = rows.reduce((sum, r) => sum + computeRowTotal(r), 0)
  const verbaTotal = verbaRows.reduce((sum, v) => sum + computeVerbaRowTotal(v), 0)
  const totalDisplay = deptTotal + verbaTotal
  const hasVerbaSection = verbaRows.length > 0

  const [editingVerbaId, setEditingVerbaId] = useState<string | null>(null)
  const [editingVerbaValue, setEditingVerbaValue] = useState('')
  const verbaCurrencyDisplay = useCallback((v: VerbaRow) => {
    if (editingVerbaId !== v.id) return v.unitCost > 0 ? formatCurrency(v.unitCost) : ''
    return editingVerbaValue
  }, [editingVerbaId, editingVerbaValue])

  return (
    <div className="overflow-hidden border rounded" style={{ borderColor: resolve.border, borderRadius: 3 }}>
      <div className="px-2 sm:px-3 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
        <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: resolve.accent }}>{department}</span>
        <span className="font-mono text-[13px] font-medium normal-case" style={{ color: resolve.yellow }}>{formatCurrency(totalDisplay)}</span>
      </div>
      <div className="p-2 sm:p-3 border-t overflow-x-auto" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
        <table className="budget-table-cards budget-table-main w-full border-collapse text-[11px] table-fixed min-w-0">
          <colgroup>
            {isLabor ? (
              <>
                <col style={{ width: '20%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '32px' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '32px' }} />
              </>
            ) : (
              <>
                <col style={{ width: '30%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '32px' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '32px' }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr className="border-b" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.04)' }}>
              {isLabor ? (
                <>
                  {['Função', 'Nome', 'Tipo', 'Cachê', 'Desl.', 'Qtd', 'Total'].map((h) => (
                    <th key={h} className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>{h}</th>
                  ))}
                  <th className="budget-th-remove" aria-hidden />
                </>
              ) : (
                <>
                  <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>{itemLabel}</th>
                  <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>{supplierLabel}</th>
                  <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Tipo</th>
                  <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Valor</th>
                  <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Qtd</th>
                  <th className="text-right text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Total</th>
                  <th className="budget-th-remove" aria-hidden />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BudgetTableRow
                key={row.id}
                row={row}
                department={department}
                cacheTableId={cacheTableId}
                onUpdate={(updates) => onUpdateRow(row.id, updates)}
                onRemove={() => onRemoveRow(row.id)}
              />
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn-resolve-hover w-full mt-2 py-2.5 border border-dashed rounded text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer"
          style={{ borderColor: resolve.border, color: resolve.muted, borderRadius: 3 }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAddRow()
          }}
          aria-label={`Adicionar ${isLabor ? 'profissional' : 'item'}`}
        >
          + Adicionar {isLabor ? 'profissional' : 'item'}
        </button>
        {showVerbaButton && !hasVerbaSection && (
          <button
            type="button"
            className="btn-resolve-hover w-full mt-2 py-2.5 border rounded-b text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
            style={{ borderColor: resolve.accent, color: resolve.accent, borderTop: 'none', borderRadius: '0 0 6px 6px' }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAddVerbaRow()
            }}
            aria-label="Adicionar verba"
          >
            <span aria-hidden>💼</span> Adicionar verba
          </button>
        )}
        {hasVerbaSection && (
          <div className="mt-2 border rounded-b overflow-hidden" style={{ borderColor: resolve.border, borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider flex items-center gap-2" style={{ backgroundColor: resolve.accent, color: '#0d0d0f' }}>
              <span aria-hidden>💼</span> Verbas
            </div>
            <div className="p-2 border-t" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
              <table className="budget-table-cards w-full border-collapse text-[11px] min-w-0 xl:min-w-[400px]">
                <colgroup>
                  <col style={{ width: '50%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '32px' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '32px' }} />
                </colgroup>
                <thead>
                  <tr className="border-b" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Descrição</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Valor</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Qtd</th>
                    <th className="text-right text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Total</th>
                    <th className="budget-th-remove" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {verbaRows.map((v) => (
                    <tr key={v.id} className="border-b transition-colors" style={{ borderColor: resolve.border }}>
                      <td className="p-1.5 align-middle">
                        <input className={inputClassName} style={inputStyle} value={v.itemName} onChange={(e) => onUpdateVerbaRow(v.id, { itemName: e.target.value })} placeholder="Descrição" />
                      </td>
                      <td className="p-1.5 align-middle">
                        <input
                          className={inputClassName}
                          style={inputStyle}
                          value={verbaCurrencyDisplay(v)}
                          placeholder="R$ 0,00"
                          onFocus={() => { setEditingVerbaId(v.id); setEditingVerbaValue(toVerbaEditValue(v.unitCost)) }}
                          onChange={(e) => { setEditingVerbaValue(e.target.value); onUpdateVerbaRow(v.id, { unitCost: parseCurrencyInput(e.target.value) }) }}
                          onBlur={() => { setEditingVerbaId(null); setEditingVerbaValue('') }}
                        />
                      </td>
                      <td className="p-1.5 align-middle budget-cell-qty">
                        <input type="number" className={`${inputClassName} text-center`} style={inputStyle} value={v.quantity || ''} onChange={(e) => onUpdateVerbaRow(v.id, { quantity: parseFloat(e.target.value) || 0 })} min={0} step="any" />
                      </td>
                      <td className="p-1.5 align-middle font-mono text-[11px] text-right font-medium budget-cell-total" style={{ color: resolve.text }}>{formatCurrency(computeVerbaRowTotal(v))}</td>
                      <td className="budget-row-remove">
                        <button type="button" onClick={() => onRemoveVerbaRow(v.id)} className="btn-remove-row" aria-label="Remover linha">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="btn-resolve-hover w-full mt-2 py-2 border border-dashed rounded text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer"
                style={{ borderColor: resolve.border, color: resolve.muted, borderRadius: 3 }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddVerbaRow() }}
                aria-label="Adicionar item na verba"
              >
                + Adicionar item
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
