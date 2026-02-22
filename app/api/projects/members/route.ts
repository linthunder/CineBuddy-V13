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

/** POST: Define os membros de um projeto. Body: { projectId: string, memberIds: string[] } */
export async function POST(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { projectId?: string; memberIds?: string[] }
    const projectId = (body.projectId ?? '').trim()
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter((id) => typeof id === 'string' && id.trim()) : []

    if (!projectId) {
      return NextResponse.json({ error: 'projectId é obrigatório.' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single()
    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    const isAdmin = profile?.role === 'admin'
    const isAtendimento = profile?.role === 'atendimento'

    const { data: existingMembers } = await supabase.from('project_members').select('user_id').eq('project_id', projectId)
    const isMember = (existingMembers ?? []).some((m) => m.user_id === caller.id)

    if (!isAdmin && !isAtendimento && !isMember) {
      return NextResponse.json({ error: 'Sem permissão para alterar membros deste projeto.' }, { status: 403 })
    }

    const finalMemberIds = [...new Set([...memberIds, caller.id])]

    await supabase.from('project_members').delete().eq('project_id', projectId)

    if (finalMemberIds.length > 0) {
      const rows = finalMemberIds.map((userId) => ({ project_id: projectId, user_id: userId }))
      const { error: insertError } = await supabase.from('project_members').insert(rows)
      if (insertError) {
        console.error('[projects/members] insert', insertError)
        return NextResponse.json({ error: 'Erro ao salvar membros.' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, count: finalMemberIds.length })
  } catch (err) {
    console.error('[projects/members]', err)
    return NextResponse.json({ error: 'Erro ao atualizar membros.' }, { status: 500 })
  }
}
