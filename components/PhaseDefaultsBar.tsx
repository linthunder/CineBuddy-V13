'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { PhaseDefaults } from '@/lib/types'
import { resolve } from '@/lib/theme'

function toEditValue(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n) || n <= 0) return ''
  return Number(n).toFixed(2).replace('.', ',')
}

interface PhaseDefaultsBarProps {
  /** Valores da fase ativa */
  data: PhaseDefaults
  onChange: (data: PhaseDefaults) => void
  /** Fase atual (para label) */
  phaseLabel: string
  /** Se o orçamento está bloqueado */
  isLocked?: boolean
  /** Callback para aplicar DIAS a todos os profissionais com tipo DIA */
  onApplyDias?: () => void
  /** Callback para aplicar SEMANAS a todos os profissionais com tipo SEMANA */
  onApplySemanas?: () => void
  /** Callback para aplicar DESLOCAMENTO a todos os profissionais */
  onApplyDeslocamento?: () => void
  /** Callback para aplicar ALIMENTAÇÃO às linhas de CATERING (valor × qtd profissionais) */
  onApplyAlimentacao?: () => void
}

const inputStyle = { backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }

export default function PhaseDefaultsBar({
  data,
  onChange,
  phaseLabel,
  isLocked,
  onApplyDias,
  onApplySemanas,
  onApplyDeslocamento,
  onApplyAlimentacao,
}: PhaseDefaultsBarProps) {
  const [editingField, setEditingField] = useState<'deslocamento' | 'alimentacaoPerPerson' | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const update = useCallback(
    (key: keyof PhaseDefaults, value: number) => {
      if (value < 0) return
      onChange({ ...data, [key]: value })
    },
    [data, onChange]
  )

  const displayCurrency = useCallback(
    (key: 'deslocamento' | 'alimentacaoPerPerson'): string => {
      if (editingField === key) return editingValue
      const val = data[key]
      if (val == null || Number.isNaN(val) || val <= 0) return ''
      return formatCurrency(Number(val))
    },
    [editingField, editingValue, data]
  )

  const handleCurrencyFocus = useCallback((key: 'deslocamento' | 'alimentacaoPerPerson') => {
    setEditingField(key)
    setEditingValue(toEditValue(data[key]))
  }, [data])

  const handleCurrencyBlur = useCallback(() => {
    setEditingField(null)
    setEditingValue('')
  }, [])

  const handleCurrencyChange = useCallback(
    (key: 'deslocamento' | 'alimentacaoPerPerson', raw: string) => {
      setEditingValue(raw)
      update(key, parseCurrencyInput(raw))
    },
    [update]
  )

  const btnCls = 'btn-resolve-hover h-7 px-2 text-[10px] font-medium uppercase rounded transition-colors border'
  const disabled = isLocked

  return (
    <div
      className="rounded border min-w-0 overflow-hidden"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
    >
      <div className="px-2 py-2 border-b" style={{ borderColor: resolve.border }}>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>
          Padrões da fase: {phaseLabel}
        </span>
      </div>
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-stretch py-2 px-2 min-w-0"
        style={{ borderColor: resolve.border }}
      >
      {/* DIAS */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-[10px] font-medium uppercase tracking-wider shrink-0 whitespace-nowrap" style={{ color: resolve.muted }}>
          Dias
        </span>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="number"
            className="py-1 px-2 text-[11px] rounded border focus:outline-none min-w-0 w-12 sm:w-14 flex-1 max-w-[4rem]"
            style={inputStyle}
            value={data.dias || ''}
            onChange={(e) => update('dias', Math.max(0, parseFloat(e.target.value) || 0))}
            min={0}
            step={1}
            disabled={disabled}
            placeholder="0"
          />
          {!disabled && onApplyDias && (
            <button
              type="button"
              className={`${btnCls} shrink-0 whitespace-nowrap`}
              style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
              onClick={onApplyDias}
              title="Aplicar a todos os profissionais com tipo Diária"
            >
              Aplicar
            </button>
          )}
        </div>
      </div>

      {/* SEMANAS */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-[10px] font-medium uppercase tracking-wider shrink-0 whitespace-nowrap" style={{ color: resolve.muted }}>
          Semanas
        </span>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="number"
            className="py-1 px-2 text-[11px] rounded border focus:outline-none min-w-0 w-12 sm:w-14 flex-1 max-w-[4rem]"
            style={inputStyle}
            value={data.semanas || ''}
            onChange={(e) => update('semanas', Math.max(0, parseFloat(e.target.value) || 0))}
            min={0}
            step={1}
            disabled={disabled}
            placeholder="0"
          />
          {!disabled && onApplySemanas && (
            <button
              type="button"
              className={`${btnCls} shrink-0 whitespace-nowrap`}
              style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
              onClick={onApplySemanas}
              title="Aplicar a todos os profissionais com tipo Semana"
            >
              Aplicar
            </button>
          )}
        </div>
      </div>

      {/* DESLOCAMENTO */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-[10px] font-medium uppercase tracking-wider shrink-0 whitespace-nowrap" style={{ color: resolve.muted }}>
          Deslocamento
        </span>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="text"
            className="py-1 px-2 text-[11px] rounded border focus:outline-none min-w-0 w-16 sm:w-20 flex-1 max-w-[5rem]"
            style={inputStyle}
            value={displayCurrency('deslocamento')}
            onChange={(e) => handleCurrencyChange('deslocamento', e.target.value)}
            onFocus={() => handleCurrencyFocus('deslocamento')}
            onBlur={handleCurrencyBlur}
            disabled={disabled}
            placeholder="R$ 0,00"
          />
          {!disabled && onApplyDeslocamento && (
            <button
              type="button"
              className={`${btnCls} shrink-0 whitespace-nowrap`}
              style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
              onClick={onApplyDeslocamento}
              title="Aplicar a todos os profissionais"
            >
              Aplicar
            </button>
          )}
        </div>
      </div>

      {/* ALIMENTAÇÃO (por pessoa) */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-[10px] font-medium uppercase tracking-wider shrink-0 whitespace-nowrap" style={{ color: resolve.muted }}>
          Alimentação/pax
        </span>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="text"
            className="py-1 px-2 text-[11px] rounded border focus:outline-none min-w-0 w-16 sm:w-20 flex-1 max-w-[5rem]"
            style={inputStyle}
            value={displayCurrency('alimentacaoPerPerson')}
            onChange={(e) => handleCurrencyChange('alimentacaoPerPerson', e.target.value)}
            onFocus={() => handleCurrencyFocus('alimentacaoPerPerson')}
            onBlur={handleCurrencyBlur}
            disabled={disabled}
            placeholder="R$ 0,00"
            title="Valor por pessoa. Ao adicionar item em CATERING, usa este valor × quantidade de profissionais."
          />
          {!disabled && onApplyAlimentacao && (
            <button
              type="button"
              className={`${btnCls} shrink-0 whitespace-nowrap`}
              style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
              onClick={onApplyAlimentacao}
              title="Aplicar às linhas de CATERING (valor × quantidade de profissionais)"
            >
              Aplicar
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
