'use client'

import { useState, useRef, useEffect } from 'react'
import type { PhaseKey } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'

interface CacheTableOption {
  id: string
  name: string
  is_default: boolean
}

interface BudgetTabsProps {
  activePhase: PhaseKey
  onPhaseChange: (phase: PhaseKey) => void
  /** Se true, o orçamento está finalizado (locked) */
  isLocked?: boolean
  /** Callback do botão FINALIZAR / ABRIR ORÇAMENTO */
  onToggleLock?: () => void
  /** Tabelas de cachê para seleção (afeta as 3 fases) */
  cacheTables?: CacheTableOption[]
  cacheTableId?: string | null
  onCacheTableChange?: (id: string | null) => void
}

const TABS: { key: PhaseKey; label: string }[] = [
  { key: 'pre', label: 'Pré-produção' },
  { key: 'prod', label: 'Produção' },
  { key: 'pos', label: 'Pós-produção' },
]

export default function BudgetTabs({
  activePhase,
  onPhaseChange,
  isLocked,
  onToggleLock,
  cacheTables = [],
  cacheTableId,
  onCacheTableChange,
}: BudgetTabsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showCacheTableSelector = cacheTables.length > 0 && onCacheTableChange && !isLocked

  /* Mobile: linha 1 = TABELA + FINALIZAR; linha 2 = PRÉ/PROD/PÓS. Desktop: uma única linha. */
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
      {/* Linha de cima no mobile: TABELA DE CACHÊS + FINALIZAR (completos, sem espremer) */}
      <div className="flex flex-wrap gap-2 items-center justify-between sm:order-2 sm:flex-1 sm:justify-end min-w-0">
        {showCacheTableSelector && (
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="btn-resolve-hover h-8 px-3 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1 whitespace-nowrap"
              style={{
                backgroundColor: dropdownOpen ? resolve.accent : resolve.panel,
                borderColor: dropdownOpen ? resolve.accent : resolve.border,
                color: dropdownOpen ? resolve.bg : resolve.muted,
              }}
            >
              <span>TABELA DE CACHÊS</span>
              <span className="text-[8px]">▼</span>
            </button>
            {dropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1 py-1 rounded border shadow-lg z-50 flex flex-col min-w-[180px] max-h-[280px] overflow-y-auto"
                style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
              >
                {cacheTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onCacheTableChange(t.id)
                      setDropdownOpen(false)
                    }}
                    className="text-left px-3 py-2 text-[11px] uppercase tracking-wide transition-colors"
                    style={{
                      backgroundColor: cacheTableId === t.id ? resolve.accent : 'transparent',
                      color: cacheTableId === t.id ? resolve.bg : resolve.text,
                    }}
                  >
                    {t.name}
                    {t.is_default && <span className="ml-1 text-[9px] opacity-80">(padrão)</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onToggleLock != null && (
          <button
            type="button"
            onClick={onToggleLock}
            className="h-8 px-3 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1 flex-shrink-0 whitespace-nowrap sm:ml-auto"
            style={{
              backgroundColor: isLocked ? '#e67e22' : cinema.success,
              borderColor: isLocked ? '#e67e22' : cinema.success,
              color: '#ffffff',
            }}
          >
            <span aria-hidden>{isLocked ? '🔓' : '🔒'}</span>
            <span className="md:hidden">{isLocked ? 'Abrir' : 'Finalizar'}</span>
            <span className="hidden md:inline">{isLocked ? 'Abrir orçamento' : 'Finalizar orçamento'}</span>
          </button>
        )}
      </div>
      {/* Linha de baixo no mobile: PRÉ, PROD, PÓS */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center sm:order-1">
        {TABS.map(({ key, label }) => {
          const isActive = activePhase === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPhaseChange(key)}
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
    </div>
  )
}
