'use client'

import type { LucideIcon } from 'lucide-react'
import { Home, Film, CircleDollarSign, BadgeDollarSign, CreditCard, Users, BarChart3 } from 'lucide-react'
import { resolve } from '@/lib/theme'

export type ViewId = 'home' | 'filme' | 'orcamento' | 'orc-final' | 'fechamento' | 'dashboard' | 'team' | 'config'

interface NavItem {
  id: ViewId
  label: string
  Icon: LucideIcon
}

const ITEMS: NavItem[] = [
  { id: 'home', label: 'HOME', Icon: Home },
  { id: 'filme', label: 'FILME', Icon: Film },
  { id: 'orcamento', label: 'ORÇ. PREVISTO', Icon: CircleDollarSign },
  { id: 'orc-final', label: 'ORÇ. REALIZADO', Icon: BadgeDollarSign },
  { id: 'fechamento', label: 'FECHAMENTO', Icon: CreditCard },
  { id: 'team', label: 'EQUIPE', Icon: Users },
  { id: 'dashboard', label: 'DASHBOARD', Icon: BarChart3 },
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
            <item.Icon size={20} strokeWidth={1.5} className="flex-shrink-0 pointer-events-none" aria-hidden style={{ color: isActive ? resolve.yellow : resolve.muted }} />
            <span className="pointer-events-none hidden md:inline" title={item.label}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
