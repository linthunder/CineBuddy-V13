'use client'

import { ScrollText, ClipboardList, Image, CalendarDays } from 'lucide-react'
import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'

export default function ViewFilme() {
  const actions = [
    { id: 'roteiro', label: 'ROTEIRO', Icon: ScrollText },
    { id: 'decupagem', label: 'DECUPAGEM', Icon: ClipboardList },
    { id: 'storyboard', label: 'STORYBOARD', Icon: Image },
    { id: 'ordemDia', label: 'ORDEM DO DIA', Icon: CalendarDays },
  ]

  return (
    <PageLayout contentLayout="single">
      {/* Linha divisória */}
      <hr
        className="border-t mb-6"
        style={{ borderColor: resolve.border }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-w-0">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="nav-btn-resolve flex flex-col items-center justify-center gap-1 sm:gap-2 py-3 sm:py-5 px-2 sm:px-3 rounded border transition-colors cursor-pointer min-w-0"
            style={{
              backgroundColor: resolve.panel,
              borderColor: resolve.border,
              color: resolve.muted,
            }}
            onClick={() => { if (typeof window !== 'undefined') window.alert(`Em breve: ${a.label.toLowerCase()}`) }}
          >
            <a.Icon size={28} strokeWidth={1.5} className="flex-shrink-0" color={resolve.muted} style={{ color: resolve.muted }} />
            <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider">{a.label}</span>
          </button>
        ))}
      </div>
    </PageLayout>
  )
}
