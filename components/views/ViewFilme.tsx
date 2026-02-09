'use client'

import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'

export default function ViewFilme() {
  const actions = [
    { id: 'roteiro', label: 'ROTEIRO', icon: '📜' },
    { id: 'decupagem', label: 'DECUPAGEM', icon: '📋' },
    { id: 'storyboard', label: 'STORYBOARD', icon: '🖼️' },
    { id: 'ordemDia', label: 'ORDEM DO DIA', icon: '📌' },
  ]

  return (
    <PageLayout contentLayout="single">
      {/* Linha divisória */}
      <hr
        className="border-t mb-6"
        style={{ borderColor: resolve.border }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="nav-btn-resolve flex flex-col items-center justify-center gap-2 py-5 px-3 rounded border transition-colors cursor-pointer"
            style={{
              backgroundColor: resolve.panel,
              borderColor: resolve.border,
              color: resolve.muted,
            }}
            onClick={() => { if (typeof window !== 'undefined') window.alert(`Em breve: ${a.label.toLowerCase()}`) }}
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="text-[11px] font-medium uppercase tracking-wider">{a.label}</span>
          </button>
        ))}
      </div>
    </PageLayout>
  )
}
