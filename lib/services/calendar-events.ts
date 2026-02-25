import { supabase } from '@/lib/supabase'

export type CalendarEventType =
  | 'orcamento_previsto'
  | 'orcamento_realizado'
  | 'fechamento'
  | 'reuniao_apresentacao'
  | 'dia_producao'
  | 'dia_entrega'
  | 'custom'

export interface CalendarEvent {
  id: string
  project_id: string | null
  event_type: CalendarEventType
  event_date: string
  title: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEventInsert {
  project_id?: string | null
  event_type: CalendarEventType
  event_date: string
  title?: string
  description?: string | null
}

export const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  orcamento_previsto: 'Orç. previsto fechado',
  orcamento_realizado: 'Orç. realizado fechado',
  fechamento: 'Fechamento concluído',
  reuniao_apresentacao: 'Reunião de apresentação',
  dia_producao: 'Dia da produção',
  dia_entrega: 'Dia de entrega',
  custom: 'Evento',
}

export async function listCalendarEvents(opts: {
  projectId?: string | null
  startDate: string
  endDate: string
}): Promise<CalendarEvent[]> {
  const { projectId, startDate, endDate } = opts
  let query = supabase
    .from('calendar_events')
    .select('*')
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })

  if (projectId != null && projectId !== '') {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) {
    console.error('[listCalendarEvents]', error)
    return []
  }
  return (data ?? []) as CalendarEvent[]
}

export async function createCalendarEvent(evt: CalendarEventInsert): Promise<CalendarEvent | null> {
  const { error, data } = await supabase
    .from('calendar_events')
    .insert({
      project_id: evt.project_id ?? null,
      event_type: evt.event_type,
      event_date: evt.event_date,
      title: evt.title ?? CALENDAR_EVENT_LABELS[evt.event_type],
      description: evt.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[createCalendarEvent]', error)
    return null
  }
  return data as CalendarEvent
}

export async function updateCalendarEvent(
  id: string,
  updates: Partial<Pick<CalendarEvent, 'event_type' | 'event_date' | 'title' | 'description'>>
): Promise<CalendarEvent | null> {
  const { error, data } = await supabase
    .from('calendar_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[updateCalendarEvent]', error)
    return null
  }
  return data as CalendarEvent
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) {
    console.error('[deleteCalendarEvent]', error)
    return false
  }
  return true
}
