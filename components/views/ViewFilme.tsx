'use client'

import { useState, useCallback, useMemo } from 'react'
import { ScrollText, ClipboardList, Image, CalendarDays, DollarSign, Presentation, CalendarClock, Palette, FolderOpen } from 'lucide-react'
import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'
import type { ProjectData } from '@/lib/types'
import type { ProfileRole } from '@/lib/permissions'
import { getRoleDisabledFilmeButtons } from '@/lib/permissions'
import type { ProfileRestriction } from '@/lib/services/profile-restrictions'

interface ViewFilmeProps {
  projectData: ProjectData
  projectDbId?: string | null
  profileRole?: ProfileRole | null
  restrictions?: ProfileRestriction[] | null
}

export default function ViewFilme({ projectData, projectDbId, profileRole, restrictions }: ViewFilmeProps) {
  const [driveLoading, setDriveLoading] = useState(false)
  const disabledButtons = useMemo(
    () => new Set(getRoleDisabledFilmeButtons(profileRole, restrictions)),
    [profileRole, restrictions]
  )

  const openDriveRoot = useCallback(async () => {
    if (!projectDbId?.trim()) {
      if (typeof window !== 'undefined') window.alert('Salve o projeto primeiro para abrir a pasta no Drive.')
      return
    }
    setDriveLoading(true)
    try {
      const params = new URLSearchParams({ projectId: projectDbId, path: '' })
      const res = await fetch(`/api/drive/folder-url?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir pasta.')
      if (data.url) window.open(data.url, '_blank')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao abrir.'
      if (typeof window !== 'undefined') window.alert(msg)
    } finally {
      setDriveLoading(false)
    }
  }, [projectDbId])

  const actions = [
    { id: 'roteiro', label: 'ROTEIRO', Icon: ScrollText },
    { id: 'decupagem', label: 'DECUPAGEM', Icon: ClipboardList },
    { id: 'ordemDia', label: 'ORDEM DO DIA', Icon: CalendarDays },
    { id: 'cronograma', label: 'CRONOGRAMA', Icon: CalendarClock },
    { id: 'moodboard', label: 'MOODBOARD', Icon: Palette },
    { id: 'storyboard', label: 'STORYBOARD', Icon: Image },
    { id: 'orcamento', label: 'ORÇ. PREVISTO', Icon: DollarSign },
    { id: 'apresentacao', label: 'APRESENTAÇÃO', Icon: Presentation },
  ]
  const driveAction = { id: 'drive', label: 'DRIVE', Icon: FolderOpen }

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
        {actions.map((a) => {
          const isDisabled = disabledButtons.has(a.id)
          return (
          <button
            key={a.id}
            type="button"
            disabled={isDisabled}
            className={`streaming-tile flex flex-col items-center justify-center gap-2 min-h-[100px] sm:min-h-[120px] rounded-lg border transition-all duration-300 ease-out ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{
              backgroundColor: resolve.panel,
              borderColor: resolve.border,
              color: resolve.muted,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            onClick={() => { if (!isDisabled && typeof window !== 'undefined') window.alert(`Em breve: ${a.label.toLowerCase()}`) }}
            onMouseEnter={(e) => {
              if (isDisabled) return
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
        )})}
        {/* Botão DRIVE: abre pasta raiz do projeto */}
        <button
          key={driveAction.id}
          type="button"
          disabled={driveLoading || disabledButtons.has('drive')}
          className={`streaming-tile flex flex-col items-center justify-center gap-2 min-h-[100px] sm:min-h-[120px] rounded-lg border transition-all duration-300 ease-out ${disabledButtons.has('drive') ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          style={{
            backgroundColor: resolve.panel,
            borderColor: resolve.border,
            color: resolve.muted,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
          onClick={() => !disabledButtons.has('drive') && openDriveRoot()}
          onMouseEnter={(e) => {
            if (disabledButtons.has('drive')) return
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
          <driveAction.Icon size={32} strokeWidth={1.5} className="flex-shrink-0 transition-colors duration-300" style={{ color: 'currentColor' }} />
          <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-center leading-tight px-0.5">{driveLoading ? '…' : driveAction.label}</span>
        </button>
      </div>
    </PageLayout>
  )
}
