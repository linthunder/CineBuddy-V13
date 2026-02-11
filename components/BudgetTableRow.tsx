'use client'

import { useState, useCallback, useMemo } from 'react'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { BudgetRow, BudgetRowLabor, BudgetRowCost, BudgetRowPeople } from '@/lib/types'
import { CUSTOM_HEADERS } from '@/lib/constants'
import { computeRowTotal } from '@/lib/budgetUtils'
import { resolve } from '@/lib/theme'
import AutocompleteInput, { type AutocompleteOption } from '@/components/AutocompleteInput'
import { searchRoles } from '@/lib/services/roles-rates'
import { searchCollaborators } from '@/lib/services/collaborators'

interface BudgetTableRowProps {
  row: BudgetRow
  department: string
  /** Índice da linha (0 = primeira). Usado para identificar 1ª linha de CATERING. */
  rowIndex?: number
  /** ID da tabela de cachê selecionada (para autocomplete de funções) */
  cacheTableId?: string | null
  onUpdate: (updates: Partial<BudgetRow>) => void
  onRemove: () => void
}

/* ── Estilos constantes (fora do render para não recriar referências) ── */
const inputStyle: React.CSSProperties = {
  backgroundColor: resolve.bg,
  border: `1px solid ${resolve.border}`,
  color: resolve.text,
  borderRadius: 2,
}
const inputClassName = 'w-full py-1 px-2 text-[11px] focus:outline-none'

/** Retorna string para edição (apenas números e vírgula), sem formatação R$ */
function toEditValue(n: number): string {
  if (n <= 0) return ''
  return n.toFixed(2).replace('.', ',')
}

/** Adapter: busca funções no Supabase → opções do autocomplete */
async function searchRolesAdapter(term: string, tableId?: string | null): Promise<AutocompleteOption[]> {
  const results = await searchRoles(term, 10, tableId)
  return results.map((r) => ({
    label: r.funcao,
    data: { cache_dia: r.cache_dia, cache_semana: r.cache_semana },
  }))
}

/** Adapter: busca colaboradores no Supabase → opções do autocomplete */
async function searchCollabAdapter(term: string): Promise<AutocompleteOption[]> {
  const results = await searchCollaborators(term)
  return results.map((c) => ({
    label: c.nome,
    data: { id: c.id },
  }))
}

export default function BudgetTableRow({ row, department, rowIndex = 0, cacheTableId, onUpdate, onRemove }: BudgetTableRowProps) {
  const total = computeRowTotal(row)
  const custom = CUSTOM_HEADERS[department]
  const itemLabel = custom?.item ?? 'Item'
  const supplierLabel = custom?.supplier ?? 'Fornecedor'

  const [editingField, setEditingField] = useState<'unitCost' | 'extraCost' | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const handleCurrencyFocus = useCallback((field: 'unitCost' | 'extraCost', value: number) => {
    setEditingField(field)
    setEditingValue(toEditValue(value))
  }, [])

  const handleCurrencyChange = useCallback((field: 'unitCost' | 'extraCost', raw: string) => {
    setEditingValue(raw)
    const num = parseCurrencyInput(raw)
    onUpdate(field === 'unitCost' ? { unitCost: num } : { extraCost: num })
  }, [onUpdate])

  const handleCurrencyBlur = useCallback(() => {
    setEditingField(null)
    setEditingValue('')
  }, [])

  const currencyDisplayValue = (field: 'unitCost' | 'extraCost', value: number): string => {
    if (editingField === field) return editingValue
    return value > 0 ? formatCurrency(value) : ''
  }

  /* ── Memoizar funções de busca para não recriar refs ── */
  const searchRolesFn = useMemo(() => (term: string) => searchRolesAdapter(term, cacheTableId), [cacheTableId])
  const searchCollabFn = useMemo(() => searchCollabAdapter, [])

  if (row.type === 'people') {
    const r = row as BudgetRowPeople
    return (
      <tr className="border-b transition-colors budget-row-people" style={{ borderColor: resolve.border }}>
        <td data-label={itemLabel} className="p-1.5 align-middle">
          <input className={inputClassName} style={inputStyle} value={r.itemName} onChange={(e) => onUpdate({ itemName: e.target.value })} placeholder={itemLabel} />
        </td>
        <td data-label={supplierLabel} className="p-1.5 align-middle">
          <input className={inputClassName} style={inputStyle} value={r.roleFunction} onChange={(e) => onUpdate({ roleFunction: e.target.value })} placeholder={supplierLabel} />
        </td>
        <td className="budget-row-remove"><button type="button" onClick={onRemove} className="btn-remove-row" aria-label="Remover linha">×</button></td>
      </tr>
    )
  }

  if (row.type === 'labor') {
    const r = row as BudgetRowLabor

    /** Ao selecionar uma função, preenche o cachê baseado no tipo selecionado */
    const handleRoleSelect = (opt: AutocompleteOption) => {
      if (!opt.data) return
      const { cache_dia, cache_semana } = opt.data as { cache_dia: number; cache_semana: number }

      const updates: Partial<BudgetRowLabor> = { roleFunction: opt.label }

      if (r.unitType === 'dia') {
        updates.unitCost = cache_dia
      } else if (r.unitType === 'sem') {
        updates.unitCost = cache_semana
      }
      // Se for 'flat' (Fechado), não preenche automaticamente

      onUpdate(updates)
    }

    /** Ao selecionar um colaborador, preenche o nome */
    const handleCollabSelect = (opt: AutocompleteOption) => {
      onUpdate({ itemName: opt.label })
    }

    /** Ao mudar o TIPO (Diária/Semana/Fechado), busca o cachê correspondente */
    const handleUnitTypeChange = async (newType: BudgetRowLabor['unitType']) => {
      const updates: Partial<BudgetRowLabor> = { unitType: newType }

      // Se tem função preenchida, buscar cachê correspondente no banco
      if (r.roleFunction?.trim()) {
        const results = await searchRoles(r.roleFunction.trim(), 5, cacheTableId)
        const match = results.find(
          (role) => role.funcao.toLowerCase() === r.roleFunction.trim().toLowerCase()
        )
        if (match) {
          if (newType === 'dia') {
            updates.unitCost = match.cache_dia
          } else if (newType === 'sem') {
            updates.unitCost = match.cache_semana
          }
        }
      }

      onUpdate(updates)
    }

    return (
      <tr className="border-b transition-colors budget-row-labor" style={{ borderColor: resolve.border }}>
        <td data-label="Função" className="p-1.5 align-middle">
          <AutocompleteInput
            value={r.roleFunction}
            onChange={(val) => onUpdate({ roleFunction: val })}
            onSelect={handleRoleSelect}
            search={searchRolesFn}
            placeholder="Função"
            className={inputClassName}
            style={inputStyle}
          />
        </td>
        <td data-label="Nome" className="p-1.5 align-middle">
          <AutocompleteInput
            value={r.itemName}
            onChange={(val) => onUpdate({ itemName: val })}
            onSelect={handleCollabSelect}
            search={searchCollabFn}
            placeholder="Nome"
            className={inputClassName}
            style={inputStyle}
          />
        </td>
        <td data-label="Tipo" className="p-1.5 align-middle">
          <select className={inputClassName} style={inputStyle} value={r.unitType} onChange={(e) => handleUnitTypeChange(e.target.value as BudgetRowLabor['unitType'])}>
            <option value="dia">Diária</option>
            <option value="sem">Semana</option>
            <option value="flat">Fechado</option>
          </select>
        </td>
        <td data-label="Cachê" className="p-1.5 align-middle">
          <input
            className={inputClassName}
            style={inputStyle}
            value={currencyDisplayValue('unitCost', r.unitCost)}
            placeholder="R$ 0,00"
            onFocus={() => handleCurrencyFocus('unitCost', r.unitCost)}
            onChange={(e) => handleCurrencyChange('unitCost', e.target.value)}
            onBlur={handleCurrencyBlur}
          />
        </td>
        <td data-label="Desl." className="p-1.5 align-middle">
          <input
            className={inputClassName}
            style={inputStyle}
            value={currencyDisplayValue('extraCost', r.extraCost)}
            placeholder="R$ 0,00"
            onFocus={() => handleCurrencyFocus('extraCost', r.extraCost)}
            onChange={(e) => handleCurrencyChange('extraCost', e.target.value)}
            onBlur={handleCurrencyBlur}
          />
        </td>
        <td data-label="Qtd" className="p-1.5 align-middle budget-cell-qty">
          <input type="number" className={`${inputClassName} text-center`} style={inputStyle} value={r.quantity || ''} onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })} min={0} step="any" />
        </td>
        <td data-label="Total" className="p-1.5 align-middle font-mono text-[11px] text-right font-medium budget-cell-total" style={{ color: resolve.text }}>{formatCurrency(total)}</td>
        <td className="budget-row-remove"><button type="button" onClick={onRemove} className="btn-remove-row" aria-label="Remover linha">×</button></td>
      </tr>
    )
  }

  const r = row as BudgetRowCost
  const isFirstCateringRow = department === 'CATERING' && rowIndex === 0
  const handleUnitCostChange = useCallback((raw: string) => {
    setEditingValue(raw)
    const num = parseCurrencyInput(raw)
    onUpdate(isFirstCateringRow ? { unitCost: num, cateringAuto: false } : { unitCost: num })
  }, [onUpdate, isFirstCateringRow])

  return (
    <tr className="border-b transition-colors budget-row-cost" style={{ borderColor: resolve.border }}>
      <td data-label={itemLabel} className="p-1.5 align-middle">
        <input className={inputClassName} style={inputStyle} value={r.itemName} onChange={(e) => onUpdate({ itemName: e.target.value })} placeholder={itemLabel} />
      </td>
      <td data-label={supplierLabel} className="p-1.5 align-middle">
        <input className={inputClassName} style={inputStyle} value={r.roleFunction} onChange={(e) => onUpdate({ roleFunction: e.target.value })} placeholder={supplierLabel} />
      </td>
      <td data-label="Tipo" className="p-1.5 align-middle">
        <select className={inputClassName} style={inputStyle} value={r.unitType} onChange={(e) => onUpdate({ unitType: e.target.value as BudgetRowCost['unitType'] })}>
          <option value="cache">Cachê</option>
          <option value="verba">Verba</option>
          <option value="extra">Extra</option>
        </select>
      </td>
      <td data-label="Valor" className="p-1.5 align-middle">
        <input
          className={inputClassName}
          style={inputStyle}
          value={currencyDisplayValue('unitCost', r.unitCost)}
          placeholder="R$ 0,00"
          onFocus={() => handleCurrencyFocus('unitCost', r.unitCost)}
          onChange={(e) => handleUnitCostChange(e.target.value)}
          onBlur={handleCurrencyBlur}
        />
      </td>
      <td data-label="Qtd" className="p-1.5 align-middle budget-cell-qty">
        <input type="number" className={`${inputClassName} text-center`} style={inputStyle} value={r.quantity || ''} onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })} min={0} step="any" />
      </td>
      <td data-label="Total" className="p-1.5 align-middle font-mono text-[11px] text-right font-medium budget-cell-total" style={{ color: resolve.text }}>{formatCurrency(total)}</td>
      <td className="budget-row-remove"><button type="button" onClick={onRemove} className="btn-remove-row" aria-label="Remover linha">×</button></td>
    </tr>
  )
}
