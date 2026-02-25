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

/** GET: Lista todos os projetos (apenas admin/atendimento). Usado em Config > Usuários para atribuir projetos. */
export async function GET(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'atendimento') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, job_id, nome, agencia, cliente, duracao, duracao_unit, updated_at, status')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[projects/list-all]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(projects ?? [])
  } catch (err) {
    console.error('[projects/list-all]', err)
    return NextResponse.json({ error: 'Erro ao listar projetos.' }, { status: 500 })
  }
}
