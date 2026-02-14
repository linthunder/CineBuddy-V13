'use client'

import { ScrollText, ClipboardList, Image, CalendarDays, DollarSign, Presentation, CalendarClock, Palette } from 'lucide-react'
import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'
import type { ProjectData } from '@/lib/types'

interface ViewFilmeProps {
  projectData: ProjectData
}

export default function ViewFilme({ projectData }: ViewFilmeProps) {
  const actions = [
    { id: 'roteiro', label: 'ROTEIRO', Icon: ScrollText },
    { id: 'decupagem', label: 'DECUPAGEM', Icon: ClipboardList },
    { id: 'ordemDia', label: 'ORDEM DO DIA', Icon: CalendarDays },
    { id: 'cronograma', label: 'CRONOGRAMA', Icon: CalendarClock },
    { id: 'moodboard', label: 'MOODBOARD', Icon: Palette },
    { id: 'storyboard', label: 'STORYBOARD', Icon: Image },
    { id: 'orcamento', label: 'ORÇAMENTO', Icon: DollarSign },
    { id: 'apresentacao', label: 'APRESENTAÇÃO', Icon: Presentation },
  ]

  const projectName = projectData.nome || 'Projeto sem nome'
  const clientName = projectData.cliente || 'Cliente não informado'

  return (
    <PageLayout contentLayout="single">
      {/* Título: nome do projeto e cliente */}
      <div className="text-center mb-8 px-4">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider mb-1"
          style={{ color: resolve.text }}
        >
          {projectName}
        </h2>
        <p
          className="text-sm sm:text-base md:text-lg font-medium tracking-wide"
          style={{ color: resolve.muted }}
        >
          {clientName}
        </p>
        <div
          className="mt-3 mx-auto h-0.5 w-24 rounded-full"
          style={{ backgroundColor: resolve.yellow }}
        />
      </div>

      {/* Linha divisória */}
      <hr
        className="border-t mb-6"
        style={{ borderColor: resolve.border }}
      />

      {/* Botões em uma única linha ocupando toda a largura */}
      <div className="grid grid-cols-8 gap-2 sm:gap-3 w-full min-w-0">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="streaming-tile flex flex-col items-center justify-center gap-2 min-h-[100px] sm:min-h-[120px] rounded-lg border transition-all duration-300 ease-out cursor-pointer"
            style={{
              backgroundColor: resolve.panel,
              borderColor: resolve.border,
              color: resolve.muted,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            onClick={() => { if (typeof window !== 'undefined') window.alert(`Em breve: ${a.label.toLowerCase()}`) }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.transform = 'scale(1.03)'
              el.style.zIndex = '10'
              el.style.borderColor = resolve.yellow
              el.style.color = resolve.yellow
              el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${resolve.yellow}`
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.transform = 'scale(1)'
              el.style.zIndex = '1'
              el.style.borderColor = resolve.border
              el.style.color = resolve.muted
              el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <a.Icon size={32} strokeWidth={1.5} className="flex-shrink-0 transition-colors duration-300" style={{ color: 'currentColor' }} />
            <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-center leading-tight px-0.5">{a.label}</span>
          </button>
        ))}
      </div>
    </PageLayout>
  )
}
