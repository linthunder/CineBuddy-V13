'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { resolve, cinema } from '@/lib/theme'
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  CALENDAR_EVENT_LABELS,
  type CalendarEvent,
  type CalendarEventType,
} from '@/lib/services/calendar-events'
import { Save, Trash2, X } from 'lucide-react'

const EVENT_TYPES_HOME: CalendarEventType[] = [
  'orcamento_previsto',
  'orcamento_realizado',
  'fechamento',
  'custom',
]
const EVENT_TYPES_CRONOGRAMA: CalendarEventType[] = [
  'reuniao_apresentacao',
  'dia_producao',
  'dia_entrega',
  'custom',
]

const EVENT_COLORS: Record<CalendarEventType, string> = {
  orcamento_previsto: '#5c7c99',
  orcamento_realizado: '#6b5b95',
  fechamento: cinema.success,
  reuniao_apresentacao: resolve.accent,
  dia_producao: resolve.yellow,
  dia_entrega: cinema.success,
  custom: resolve.muted,
}

interface ProjectOption {
  id: string
  nome: string
  job_id?: string
}

interface CalendarWidgetProps {
  mode: 'home' | 'cronograma'
  projectId?: string | null
  projectName?: string
  projectsForHome?: ProjectOption[]
  onRefresh?: () => void
}

interface FCEvent {
  id: string
  title: string
  start: string
  allDay: boolean
  backgroundColor: string
  borderColor: string
  extendedProps: { resource: CalendarEvent }
}

export default function CalendarWidget({
  mode,
  projectId = null,
  projectName = '',
  projectsForHome = [],
  onRefresh,
}: CalendarWidgetProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [events, setEvents] = useState<FCEvent[]>([])
  const [modal, setModal] = useState<{
    type: 'create' | 'edit'
    date?: Date
    event?: CalendarEvent
  } | null>(null)
  const [form, setForm] = useState({
    event_type: 'custom' as CalendarEventType,
    title: '',
    description: '',
    project_id: null as string | null,
  })

  const eventTypes = mode === 'home' ? EVENT_TYPES_HOME : EVENT_TYPES_CRONOGRAMA

  const loadEvents = useCallback(
    async (viewStart?: Date, viewEnd?: Date) => {
      const start = viewStart ?? new Date()
      const startMonth = new Date(start.getFullYear(), start.getMonth() - 1, 1)
      const endMonth = viewEnd ?? new Date(start.getFullYear(), start.getMonth() + 2, 0)
      const data = await listCalendarEvents({
        projectId: mode === 'cronograma' ? projectId : undefined,
        startDate: startMonth.toISOString().slice(0, 10),
        endDate: endMonth.toISOString().slice(0, 10),
      })
      const fcEvents: FCEvent[] = data.map((e) => ({
        id: e.id,
        title: e.title || CALENDAR_EVENT_LABELS[e.event_type],
        start: e.event_date,
        allDay: true,
        backgroundColor: EVENT_COLORS[e.event_type] ?? resolve.accent,
        borderColor: EVENT_COLORS[e.event_type] ?? resolve.accent,
        extendedProps: { resource: e },
      }))
      setEvents(fcEvents)
    },
    [mode, projectId]
  )

  const handleDatesSet = useCallback(
    (arg: { start: Date; end: Date }) => {
      loadEvents(arg.start, arg.end)
    },
    [loadEvents]
  )

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleDateClick = useCallback(
    (arg: { date: Date }) => {
      if (mode === 'cronograma' && !projectId) {
        if (typeof window !== 'undefined') window.alert('Salve o projeto primeiro para adicionar eventos.')
        return
      }
      setForm({
        event_type: (mode === 'home' ? 'orcamento_previsto' : 'reuniao_apresentacao') as CalendarEventType,
        title: '',
        description: '',
        project_id: null,
      })
      setModal({ type: 'create', date: arg.date })
    },
    [mode, projectId]
  )

  const handleEventClick = useCallback((arg: { event: { extendedProps?: { resource?: CalendarEvent } }; jsEvent: Event }) => {
    arg.jsEvent.preventDefault()
    const ev = arg.event.extendedProps?.resource as CalendarEvent | undefined
    if (!ev) return
    setForm({
      event_type: ev.event_type,
      title: ev.title || '',
      description: ev.description || '',
      project_id: ev.project_id,
    })
    setModal({ type: 'edit', event: ev })
  }, [])

  const refreshCalendar = useCallback(() => {
    const api = calendarRef.current?.getApi()
    if (api) {
      const view = api.view
      if (view) loadEvents(view.activeStart, view.activeEnd)
    } else {
      loadEvents()
    }
  }, [loadEvents])

  const handleSaveEvent = useCallback(async () => {
    if (!modal) return
    if (modal.type === 'create' && modal.date) {
      const needsProject =
        mode === 'home' &&
        ['orcamento_previsto', 'orcamento_realizado', 'fechamento'].includes(form.event_type)
      if (needsProject && !form.project_id) {
        if (typeof window !== 'undefined') window.alert('Selecione o projeto.')
        return
      }
      const projId =
        mode === 'cronograma'
          ? projectId ?? undefined
          : needsProject
            ? form.project_id ?? undefined
            : undefined
      const ev = await createCalendarEvent({
        project_id: projId,
        event_type: form.event_type,
        event_date: modal.date.toISOString().slice(0, 10),
        title: form.title || CALENDAR_EVENT_LABELS[form.event_type],
        description: form.description || null,
      })
      if (ev) {
        refreshCalendar()
        onRefresh?.()
      }
    } else if (modal.type === 'edit' && modal.event) {
      const ev = await updateCalendarEvent(modal.event.id, {
        event_type: form.event_type,
        title: form.title || CALENDAR_EVENT_LABELS[form.event_type],
        description: form.description || null,
      })
      if (ev) {
        refreshCalendar()
        onRefresh?.()
      }
    }
    setModal(null)
  }, [modal, form, mode, projectId, refreshCalendar, onRefresh])

  const handleDeleteEvent = useCallback(async () => {
    if (modal?.type !== 'edit' || !modal.event) return
    if (typeof window !== 'undefined' && !window.confirm('Excluir este evento?')) return
    const ok = await deleteCalendarEvent(modal.event.id)
    if (ok) {
      refreshCalendar()
      onRefresh?.()
      setModal(null)
    }
  }, [modal, refreshCalendar, onRefresh])

  const upcomingEvents = [...events]
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((e) => e.start >= new Date().toISOString().slice(0, 10))
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div
        className="rounded-lg overflow-hidden flex-1 min-h-[400px] sm:min-h-[500px] cinebuddy-calendar"
        style={{
          backgroundColor: resolve.panel,
          borderColor: resolve.border,
          border: `1px solid ${resolve.border}`,
        }}
      >
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 border-b"
          style={{ backgroundColor: '#18181c', borderColor: resolve.border }}
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: resolve.muted }}>
            Legenda:
          </span>
          {eventTypes.map((t) => (
            <span key={t} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{
                  backgroundColor: EVENT_COLORS[t],
                  boxShadow: `0 1px 3px rgba(0,0,0,0.3)`,
                }}
              />
              <span className="text-[11px]" style={{ color: resolve.text }}>
                {CALENDAR_EVENT_LABELS[t]}
              </span>
            </span>
          ))}
        </div>
        <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="pt-br"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek',
            }}
            buttonText={{
              today: 'Hoje',
              month: 'Mês',
              week: 'Semana',
            }}
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            fixedWeekCount={false}
            firstDay={0}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            dayMaxEvents={4}
            moreLinkClick="popover"
            eventDisplay="block"
            eventDidMount={(arg) => {
              const ev = arg.event.extendedProps?.resource as CalendarEvent | undefined
              if (ev) {
                const color = EVENT_COLORS[ev.event_type] ?? resolve.accent
                arg.el.style.borderLeftColor = color
              }
            }}
          />
        {upcomingEvents.length > 0 && (
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: resolve.border, backgroundColor: '#151518' }}
          >
            <h4 className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: resolve.muted }}>
              Próximos eventos
            </h4>
            <div className="flex flex-wrap gap-2">
              {upcomingEvents.map((e) => {
                const ev = e.extendedProps?.resource
                const color = ev ? EVENT_COLORS[ev.event_type] : resolve.accent
                return (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-[11px]"
                    style={{
                      backgroundColor: `${color}22`,
                      borderColor: color,
                      border: `1px solid ${color}66`,
                      color: resolve.text,
                    }}
                  >
                    <span className="font-mono text-[10px]" style={{ color: resolve.muted }}>
                      {format(new Date(e.start), 'dd/MM')}
                    </span>
                    <span>{e.title}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="rounded border w-full max-w-md p-4"
            style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold uppercase" style={{ color: resolve.text }}>
                {modal.type === 'create' ? 'Novo evento' : 'Editar evento'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="p-1 rounded"
                style={{ color: resolve.muted }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {mode === 'home' &&
                modal.type === 'create' &&
                ['orcamento_previsto', 'orcamento_realizado', 'fechamento'].includes(form.event_type) && (
                  <div>
                    <label className="block text-[11px] uppercase mb-1" style={{ color: resolve.muted }}>
                      Projeto *
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded border text-sm"
                      style={{
                        backgroundColor: resolve.bg,
                        borderColor: resolve.border,
                        color: resolve.text,
                      }}
                      value={form.project_id ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, project_id: e.target.value || null }))
                      }
                      required
                    >
                      <option value="">Selecione o projeto</option>
                      {projectsForHome.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.job_id ? `#${p.job_id} ` : ''}{p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <div>
                <label className="block text-[11px] uppercase mb-1" style={{ color: resolve.muted }}>
                  Tipo
                </label>
                <select
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    backgroundColor: resolve.bg,
                    borderColor: resolve.border,
                    color: resolve.text,
                  }}
                  value={form.event_type}
                  onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value as CalendarEventType }))}
                >
                  {eventTypes.map((t) => (
                    <option key={t} value={t}>
                      {CALENDAR_EVENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase mb-1" style={{ color: resolve.muted }}>
                  Título (opcional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    backgroundColor: resolve.bg,
                    borderColor: resolve.border,
                    color: resolve.text,
                  }}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={CALENDAR_EVENT_LABELS[form.event_type]}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase mb-1" style={{ color: resolve.muted }}>
                  Descrição (opcional)
                </label>
                <textarea
                  className="w-full px-3 py-2 rounded border text-sm resize-none"
                  rows={2}
                  style={{
                    backgroundColor: resolve.bg,
                    borderColor: resolve.border,
                    color: resolve.text,
                  }}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              {modal.type === 'create' && modal.date && (
                <p className="text-[11px]" style={{ color: resolve.muted }}>
                  Data: {format(modal.date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              {modal.type === 'edit' && (
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  className="px-3 py-1.5 text-xs rounded border flex items-center gap-1"
                  style={{ borderColor: cinema.danger, color: cinema.danger }}
                >
                  <Trash2 size={14} /> Excluir
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-3 py-1.5 text-xs rounded border"
                style={{ borderColor: resolve.border, color: resolve.text }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEvent}
                className="px-3 py-1.5 text-xs rounded flex items-center gap-1"
                style={{ backgroundColor: resolve.yellow, color: resolve.bg }}
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
