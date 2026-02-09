'use client'

import type { PhaseKey } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'

interface BudgetTabsProps {
  activePhase: PhaseKey
  onPhaseChange: (phase: PhaseKey) => void
  /** Se true, o orçamento está finalizado (locked) */
  isLocked?: boolean
  /** Callback do botão FINALIZAR / ABRIR ORÇAMENTO */
  onToggleLock?: () => void
}

const TABS: { key: PhaseKey; label: string }[] = [
  { key: 'pre', label: 'Pré-produção' },
  { key: 'prod', label: 'Produção' },
  { key: 'pos', label: 'Pós-produção' },
]

export default function BudgetTabs({ activePhase, onPhaseChange, isLocked, onToggleLock }: BudgetTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-1 items-center">
      {TABS.map(({ key, label }) => {
        const isActive = activePhase === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPhaseChange(key)}
            className="btn-resolve-hover h-9 sm:h-8 flex-1 sm:flex-none min-w-0 px-3 sm:px-4 rounded text-xs font-medium uppercase tracking-wide transition-colors border"
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
      {onToggleLock != null && (
        <button
          type="button"
          onClick={onToggleLock}
          className="ml-auto h-9 sm:h-8 px-3 sm:px-4 rounded text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1.5"
          style={{
            backgroundColor: isLocked ? '#e67e22' : cinema.success,
            borderColor: isLocked ? '#e67e22' : cinema.success,
            color: '#ffffff',
          }}
        >
          <span aria-hidden>{isLocked ? '🔓' : '🔒'}</span>
          {isLocked ? 'Abrir orçamento' : 'Finalizar orçamento'}
        </button>
      )}
    </div>
  )
}
