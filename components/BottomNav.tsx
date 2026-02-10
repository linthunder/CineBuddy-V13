'use client'

import { resolve } from '@/lib/theme'

export type ViewId = 'filme' | 'orcamento' | 'orc-final' | 'fechamento' | 'dashboard' | 'team' | 'config'

interface NavItem {
  id: ViewId
  label: string
  icon: string
}

const ITEMS: NavItem[] = [
  { id: 'filme', label: 'FILME', icon: '🎬' },
  { id: 'orcamento', label: 'ORÇAMENTO', icon: '💰' },
  { id: 'orc-final', label: 'ORÇ. FINAL', icon: '📄' },
  { id: 'fechamento', label: 'FECHAMENTO', icon: '💳' },
  { id: 'dashboard', label: 'DASHBOARD', icon: '📊' },
  { id: 'team', label: 'EQUIPE', icon: '👥' },
  { id: 'config', label: 'CONFIG', icon: '⚙️' },
]

interface BottomNavProps {
  currentView: ViewId
  onViewChange: (view: ViewId) => void
  /** IDs de views que devem aparecer opacas / bloqueadas */
  disabledViews?: ViewId[]
}

export default function BottomNav({ currentView, onViewChange, disabledViews = [] }: BottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-2 border-t"
      style={{
        backgroundColor: resolve.panel,
        borderColor: resolve.purple,
        minHeight: 52,
        paddingLeft: 'var(--page-gutter)',
        paddingRight: 'var(--page-gutter)',
        touchAction: 'manipulation',
      }}
    >
      {ITEMS.map((item) => {
        const isActive = currentView === item.id
        const isDisabled = disabledViews.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onViewChange(item.id)}
            onPointerDown={(e) => {
              if (e.button === 0 && !isDisabled) onViewChange(item.id)
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            data-view-id={item.id}
            className={`
              nav-btn-resolve flex flex-col items-center justify-center gap-0.5 min-w-[44px] md:min-w-[56px] lg:min-w-[64px] py-1 px-1
              border-b-2 transition-colors text-[10px] sm:text-[11px] font-medium uppercase tracking-wider
              ${isActive ? 'active' : ''}
              ${isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : 'cursor-pointer'}
            `}
            style={{
              color: isActive ? resolve.yellow : resolve.muted,
              borderBottomColor: isActive ? resolve.yellow : 'transparent',
              pointerEvents: isDisabled ? 'none' : undefined,
            }}
          >
            <span className="text-base sm:text-lg leading-none pointer-events-none" aria-hidden>{item.icon}</span>
            <span className="pointer-events-none hidden md:inline" title={item.label}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
