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

/** GET: Retorna os IDs dos membros de um projeto. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { id: projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto é obrigatório.' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single()
    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    const isAdmin = profile?.role === 'admin'
    const isAtendimento = profile?.role === 'atendimento'

    const { data: members } = await supabase.from('project_members').select('user_id').eq('project_id', projectId)
    const isMember = (members ?? []).some((m) => m.user_id === caller.id)

    if (!isAdmin && !isAtendimento && !isMember) {
      return NextResponse.json({ error: 'Sem permissão para ver membros deste projeto.' }, { status: 403 })
    }

    const memberIds = (members ?? []).map((m) => m.user_id)
    return NextResponse.json({ memberIds }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err) {
    console.error('[projects/:id/members]', err)
    return NextResponse.json({ error: 'Erro ao listar membros.' }, { status: 500 })
  }
}
