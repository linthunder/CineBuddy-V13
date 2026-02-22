import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/Bearer\s+/i, '')
  if (!token) return { data: { user: null } }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabaseAuth = createClient(url, anonKey)
  return supabaseAuth.auth.getUser(token)
}

/** GET: Retorna os IDs dos projetos aos quais o usuário tem acesso. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'atendimento') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data: rows } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)

    const projectIds = (rows ?? []).map((r) => r.project_id)
    return NextResponse.json({ projectIds })
  } catch (err) {
    console.error('[users/:id/projects]', err)
    return NextResponse.json({ error: 'Erro ao listar projetos do usuário.' }, { status: 500 })
  }
}

/** POST: Define os projetos aos quais o usuário tem acesso. Body: { projectIds: string[] } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'atendimento') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { projectIds?: string[] }
    const projectIds = Array.isArray(body.projectIds) ? body.projectIds.filter((id) => typeof id === 'string' && id.trim()) : []

    const { error: delErr } = await supabase.from('project_members').delete().eq('user_id', userId)
    if (delErr) {
      console.error('[users/:id/projects] delete', delErr)
      return NextResponse.json({ error: 'Erro ao atualizar projetos.' }, { status: 500 })
    }

    if (projectIds.length > 0) {
      const rows = projectIds.map((projectId) => ({ project_id: projectId, user_id: userId }))
      const { error: insertErr } = await supabase.from('project_members').insert(rows)
      if (insertErr) {
        console.error('[users/:id/projects] insert', insertErr)
        return NextResponse.json({ error: 'Erro ao salvar projetos.' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, count: projectIds.length })
  } catch (err) {
    console.error('[users/:id/projects] POST', err)
    return NextResponse.json({ error: 'Erro ao atualizar projetos.' }, { status: 500 })
  }
}
