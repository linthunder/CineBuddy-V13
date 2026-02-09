'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import type { MiniTablesData } from '@/lib/types'
import { resolve } from '@/lib/theme'

interface MiniTablesProps {
  data: MiniTablesData
  onChange: (data: MiniTablesData) => void
}

const cellStyle = { backgroundColor: resolve.panel, borderColor: resolve.border, borderRadius: 3 }

function toEditValue(n: number): string {
  if (n <= 0) return ''
  return n.toFixed(2).replace('.', ',')
}

export default function MiniTables({ data, onChange }: MiniTablesProps) {
  const [editingKey, setEditingKey] = useState<keyof MiniTablesData | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const update = useCallback((key: keyof MiniTablesData, value: number) => {
    onChange({ ...data, [key]: value })
  }, [data, onChange])

  const handleFocus = useCallback((key: keyof MiniTablesData) => {
    setEditingKey(key)
    setEditingValue(toEditValue(data[key]))
  }, [data])

  const handleChange = useCallback((key: keyof MiniTablesData, raw: string) => {
    setEditingValue(raw)
    const v = parseCurrencyInput(raw)
    if (v >= 0) update(key, v)
  }, [update])

  const handleBlur = useCallback(() => {
    setEditingKey(null)
    setEditingValue('')
  }, [])

  const displayValue = useCallback((key: keyof MiniTablesData): string => {
    if (editingKey === key) return editingValue
    return data[key] > 0 ? formatCurrency(data[key]) : ''
  }, [editingKey, editingValue, data])

  const inputStyle = { backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
      {(['contingencia', 'crt', 'bvagencia'] as const).map((key) => (
        <div key={key} className="overflow-hidden border rounded" style={cellStyle}>
          <div className="px-3 py-2.5 flex justify-between items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>
              {key === 'bvagencia' ? 'BV Agência' : key === 'crt' ? 'CRT' : 'Contingência'}
            </span>
            <input
              type="text"
              className="flex-1 py-1.5 px-2 border rounded text-right text-sm font-mono focus:outline-none"
              style={inputStyle}
              value={displayValue(key)}
              onFocus={() => handleFocus(key)}
              onChange={(e) => handleChange(key, e.target.value)}
              onBlur={handleBlur}
              placeholder="R$ 0,00"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
