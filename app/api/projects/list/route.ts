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

/** GET: Lista projetos acessíveis ao usuário atual. Query: search (opcional). */
export async function GET(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const search = request.nextUrl.searchParams.get('search')?.trim() ?? ''
    const supabase = createServerClient()

    // Projetos sem nenhum membro = todos têm acesso (retrocompatibilidade)
    // Projetos com membros = apenas os listados têm acesso
    const { data: projectsWithMembers } = await supabase
      .from('project_members')
      .select('project_id')

    const projectIdsWithMembers = new Set((projectsWithMembers ?? []).map((r) => r.project_id))

    let query = supabase
      .from('projects')
      .select('id, job_id, nome, agencia, cliente, duracao, duracao_unit, updated_at')
      .order('updated_at', { ascending: false })

    if (search) {
      query = query.ilike('nome', `%${search}%`)
    }

    const { data: allProjects, error } = await query

    if (error) {
      console.error('[projects/list]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const projects = (allProjects ?? []) as { id: string; job_id: string; nome: string; agencia: string; cliente: string; duracao: string; duracao_unit: string; updated_at: string }[]

    if (projectIdsWithMembers.size === 0) {
      return NextResponse.json(projects)
    }

    const { data: myMemberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', caller.id)

    const myProjectIds = new Set((myMemberships ?? []).map((r) => r.project_id))

    const filtered = projects.filter((p) => {
      if (!projectIdsWithMembers.has(p.id)) return true
      return myProjectIds.has(p.id)
    })

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('[projects/list]', err)
    return NextResponse.json({ error: 'Erro ao listar projetos.' }, { status: 500 })
  }
}
