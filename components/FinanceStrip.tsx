'use client'

import { useState } from 'react'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import { resolve, cinema } from '@/lib/theme'

interface FinanceStripProps {
  jobValue: number
  totalCost: number
  taxRate: number
  onJobValueChange?: (value: number) => void
  onTaxRateChange?: (value: number) => void
  /** Se definido, exibe botão +30% ao lado de Valor total e chama ao clicar (percent = 30). */
  onApplyMarkup?: (percent: number) => void
}

export default function FinanceStrip({
  jobValue,
  totalCost,
  taxRate,
  onJobValueChange,
  onTaxRateChange,
  onApplyMarkup,
}: FinanceStripProps) {
  const [jobInputRaw, setJobInputRaw] = useState<string | null>(null)
  const taxValue = jobValue * (taxRate / 100)
  const profitNet = jobValue - totalCost - taxValue
  const margin = jobValue > 0 ? (profitNet / jobValue) * 100 : 0

  const displayJobValue = jobInputRaw !== null ? jobInputRaw : (jobValue > 0 ? formatCurrency(jobValue) : '')

  const isEditable = !!onJobValueChange

  const handleJobFocus = () => {
    if (!isEditable) return
    setJobInputRaw(jobValue > 0 ? jobValue.toFixed(2).replace('.', ',') : '')
  }
  const handleJobBlur = () => {
    if (!isEditable) return
    const v = parseCurrencyInput(jobInputRaw ?? '')
    if (v >= 0) onJobValueChange!(v)
    setJobInputRaw(null)
  }

  return (
    <div
      className="rounded overflow-hidden grid grid-cols-1 lg:grid-cols-5 gap-0 border-b min-w-0"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.purple, borderRadius: 3 }}
    >
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5 flex flex-wrap items-center justify-center gap-1.5" style={{ color: resolve.muted }}>
          Valor total
          {onApplyMarkup != null && (
            <button
              type="button"
              onClick={() => onApplyMarkup(30)}
              className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
              style={{ backgroundColor: resolve.accent, color: resolve.bg }}
            >
              +30%
            </button>
          )}
        </label>
        <input
          type="text"
          className="w-full bg-transparent text-base sm:text-lg font-semibold text-center border-b border-transparent focus:outline-none py-0.5"
          style={{ color: resolve.text }}
          value={displayJobValue}
          onFocus={handleJobFocus}
          onBlur={handleJobBlur}
          readOnly={!isEditable}
          onChange={(e) => {
            if (!isEditable) return
            setJobInputRaw(e.target.value)
            const v = parseCurrencyInput(e.target.value)
            if (v >= 0) onJobValueChange!(v)
          }}
          placeholder="R$ 0,00"
        />
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Custo</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(totalCost)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Lucro líquido</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: profitNet >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(profitNet)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5 flex items-center justify-center gap-1.5" style={{ color: resolve.muted }}>
          Impostos
          <input
            type="number"
            className="w-10 px-1 py-0.5 text-center text-xs rounded border"
            style={{ backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }}
            value={taxRate}
            readOnly={!onTaxRateChange}
            onChange={(e) => onTaxRateChange?.(Number(e.target.value) || 0)}
            min={0}
            max={100}
            step={0.5}
          />
          %
        </label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(taxValue)}</div>
      </div>
      <div className="p-3 flex flex-col items-center justify-center min-w-0">
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Margem</label>
        <div className="text-sm sm:text-base font-semibold" style={{ color: margin >= 20 ? cinema.success : margin >= 10 ? resolve.accent : cinema.danger }}>{margin.toFixed(1)}%</div>
      </div>
    </div>
  )
}
