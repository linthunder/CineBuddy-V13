'use client'

import { useState, useCallback, Fragment } from 'react'
import { X, Plus } from 'lucide-react'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { ExpenseLine } from '@/lib/prestacao-contas'
import { EXPENSE_TYPE_OPTIONS } from '@/lib/prestacao-contas'

const inputStyle: React.CSSProperties = {
  backgroundColor: resolve.bg,
  border: `1px solid ${resolve.border}`,
  color: resolve.text,
  borderRadius: 2,
}
const inputClassName = 'w-full py-1 px-2 text-[11px] focus:outline-none'

function sepVertical(key?: string) {
  return (
    <span
      key={key}
      className="flex-shrink-0 w-px min-h-full self-stretch"
      style={{ backgroundColor: resolve.border }}
      aria-hidden
    />
  )
}

export interface PrestacaoContasDeptViewProps {
  projectName: string
  department: string
  responsible1?: string
  responsible2?: string
  verba: number
  saldo: number
  expenses: ExpenseLine[]
  onUpdate: (id: string, updates: Partial<ExpenseLine>) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onSave: () => void
  saving?: boolean
  canEdit?: boolean
  saveSuccess?: boolean
  saveError?: string | null
}

export default function PrestacaoContasDeptView({
  projectName,
  department,
  responsible1 = '',
  responsible2 = '',
  verba,
  saldo,
  expenses,
  onUpdate,
  onAdd,
  onRemove,
  onSave,
  saving = false,
  canEdit = true,
  saveSuccess = false,
  saveError = null,
}: PrestacaoContasDeptViewProps) {
  const [editingExpenseValueId, setEditingExpenseValueId] = useState<string | null>(null)
  const [editingExpenseValueRaw, setEditingExpenseValueRaw] = useState('')

  const toEditValue = (n: number): string => (n <= 0 ? '' : n.toFixed(2).replace('.', ','))
  const expenseValueDisplay = (exp: ExpenseLine): string => {
    if (editingExpenseValueId === exp.id) return editingExpenseValueRaw
    return exp.value > 0 ? formatCurrency(exp.value) : ''
  }
  const handleExpenseValueFocus = useCallback((exp: ExpenseLine) => {
    setEditingExpenseValueId(exp.id)
    setEditingExpenseValueRaw(toEditValue(exp.value))
  }, [])
  const handleExpenseValueChange = useCallback(
    (id: string, raw: string) => {
      setEditingExpenseValueRaw(raw)
      onUpdate(id, { value: parseCurrencyInput(raw) })
    },
    [onUpdate]
  )
  const handleExpenseValueBlur = useCallback(() => {
    setEditingExpenseValueId(null)
    setEditingExpenseValueRaw('')
  }, [])

  const responsaveis = [responsible1, responsible2].filter(Boolean)

  return (
    <div className="max-w-5xl mx-auto p-4" style={{ backgroundColor: resolve.bg, color: resolve.text }}>
      <h1 className="text-lg font-semibold uppercase tracking-wider mb-1" style={{ color: resolve.text }}>
        {projectName} – Prestação de contas – {department}
      </h1>
      <p className="text-[11px] mb-4" style={{ color: resolve.muted }}>
        Preencha as despesas do departamento. Ao finalizar, clique em <strong style={{ color: resolve.text }}>Salvar prestação</strong> para enviar os dados ao sistema de forma segura.
      </p>

      <div
        className="flex flex-wrap items-center justify-between gap-2 mb-4 py-3 px-3 rounded border-l-2"
        style={{
          borderColor: resolve.border,
          borderLeftColor: resolve.accent,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-[10px] shrink-0" style={{ color: resolve.muted }}>
            Responsáveis:
          </span>
          {responsaveis.length > 0 ? (
            responsaveis.map((name, i) => (
              <Fragment key={`resp-${i}`}>
                {i > 0 && sepVertical(`r-${i}`)}
                <span className="text-[11px]" style={{ color: resolve.text }}>
                  {name}
                </span>
              </Fragment>
            ))
          ) : (
            <span className="text-[11px]" style={{ color: resolve.muted }}>
              —
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px]" style={{ color: resolve.muted }}>
            Verba:
          </span>
          <span className="font-mono text-[11px]" style={{ color: resolve.text }}>
            {formatCurrency(verba)}
          </span>
          <span className="text-[10px]" style={{ color: resolve.muted }}>
            Saldo:
          </span>
          <span
            className={`font-mono text-[11px] font-medium ${saldo < 0 ? '' : ''}`}
            style={{ color: saldo < 0 ? cinema.danger : resolve.text }}
          >
            {formatCurrency(saldo)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded border" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
        <table className="budget-table-cards w-full border-collapse text-[11px] min-w-[500px] table-fixed">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '40px' }} />
          </colgroup>
          <thead>
            <tr className="border-b" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                Data
              </th>
              <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                Fornecedor
              </th>
              <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                Descrição
              </th>
              <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                Tipo
              </th>
              <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                Valor
              </th>
              <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                NF
              </th>
              <th className="text-center text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>
                Status
              </th>
              {canEdit && <th className="budget-th-remove" aria-hidden />}
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-b" style={{ borderColor: resolve.border }}>
                <td className="p-1.5">
                  <input
                    type="date"
                    className={inputClassName}
                    style={inputStyle}
                    value={exp.date}
                    onChange={(e) => onUpdate(exp.id, { date: e.target.value })}
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    className={inputClassName}
                    style={inputStyle}
                    value={exp.supplier}
                    onChange={(e) => onUpdate(exp.id, { supplier: e.target.value })}
                    placeholder="Fornecedor"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    className={inputClassName}
                    style={inputStyle}
                    value={exp.description}
                    onChange={(e) => onUpdate(exp.id, { description: e.target.value })}
                    placeholder="Descrição"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td className="p-1.5">
                  <select
                    className={inputClassName}
                    style={inputStyle}
                    value={exp.expenseType}
                    onChange={(e) => onUpdate(exp.id, { expenseType: e.target.value })}
                    disabled={!canEdit}
                  >
                    {EXPENSE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1.5">
                  <input
                    className={inputClassName}
                    style={inputStyle}
                    value={expenseValueDisplay(exp)}
                    onFocus={() => handleExpenseValueFocus(exp)}
                    onChange={(e) => handleExpenseValueChange(exp.id, e.target.value)}
                    onBlur={handleExpenseValueBlur}
                    placeholder="R$ 0,00"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    className={inputClassName}
                    style={inputStyle}
                    value={exp.invoiceNumber}
                    onChange={(e) => onUpdate(exp.id, { invoiceNumber: e.target.value })}
                    placeholder="NF"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td className="p-1.5 text-center">
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-[10px] font-medium uppercase px-2 py-1 rounded"
                      style={{
                        backgroundColor: exp.payStatus === 'pago' ? cinema.success : cinema.danger,
                        color: '#fff',
                      }}
                      onClick={() => onUpdate(exp.id, { payStatus: exp.payStatus === 'pago' ? 'pendente' : 'pago' })}
                    >
                      {exp.payStatus === 'pago' ? 'PAGO ✓' : 'A PAGAR'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-medium uppercase" style={{ color: resolve.muted }}>
                      {exp.payStatus === 'pago' ? 'PAGO' : 'A PAGAR'}
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="budget-row-remove align-middle">
                    <button
                      type="button"
                      onClick={() => onRemove(exp.id)}
                      className="btn-remove-row inline-flex items-center justify-center"
                      aria-label="Remover"
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <button
            type="button"
            className="btn-resolve-hover w-full py-2.5 border border-dashed rounded-b text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
            style={{ borderColor: resolve.border, color: resolve.muted, borderRadius: 0 }}
            onClick={onAdd}
          >
            <Plus size={14} strokeWidth={2} className="shrink-0" aria-hidden /> Adicionar conta
          </button>
        )}
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-resolve-hover px-5 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 border"
            style={{ backgroundColor: resolve.accent, color: '#fff', borderColor: resolve.accent }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar prestação'}
          </button>
          {saveSuccess && (
            <span className="text-[11px]" style={{ color: cinema.success }}>
              Salvo com sucesso.
            </span>
          )}
          {saveError && (
            <span className="text-[11px]" style={{ color: cinema.danger }}>
              {saveError}
            </span>
          )}
        </div>
      )}

      {!canEdit && (
        <p className="mt-4 text-[11px]" style={{ color: resolve.muted }}>
          Link sem permissão de edição. Use o link enviado pelo responsável para editar e salvar.
        </p>
      )}
    </div>
  )
}
