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

type RestrictionType = 'nav_page' | 'config_tab' | 'filme_button' | 'header_button'

export interface ProfileRestriction {
  role: string
  restriction_type: RestrictionType
  restriction_key: string
}

/** GET: Retorna todas as restrições de perfis. */
export async function GET(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (!profile?.role) {
      return NextResponse.json({ error: 'Sem perfil.' }, { status: 403 })
    }

    const { data: rows } = await supabase
      .from('profile_restrictions')
      .select('role, restriction_type, restriction_key')

    const restrictions: ProfileRestriction[] = (rows ?? []).map((r) => ({
      role: r.role,
      restriction_type: r.restriction_type as RestrictionType,
      restriction_key: r.restriction_key,
    }))

    return NextResponse.json({ restrictions })
  } catch (err) {
    console.error('[permissions/restrictions] GET', err)
    return NextResponse.json({ error: 'Erro ao carregar restrições.' }, { status: 500 })
  }
}

/** POST: Atualiza as restrições. Body: { restrictions: ProfileRestriction[] } */
export async function POST(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem alterar restrições.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { restrictions?: ProfileRestriction[] }
    const list = Array.isArray(body.restrictions) ? body.restrictions : []

    const valid = list.filter(
      (r) =>
        typeof r?.role === 'string' &&
        typeof r?.restriction_type === 'string' &&
        ['nav_page', 'config_tab', 'filme_button', 'header_button'].includes(r.restriction_type) &&
        typeof r?.restriction_key === 'string' &&
        r.restriction_key.trim()
    )

    await supabase.from('profile_restrictions').delete().neq('role', '__never__')

    if (valid.length > 0) {
      const rows = valid.map((r) => ({
        role: r.role.trim(),
        restriction_type: r.restriction_type,
        restriction_key: r.restriction_key.trim(),
      }))
      const { error } = await supabase.from('profile_restrictions').insert(rows)
      if (error) {
        console.error('[permissions/restrictions] insert', error)
        return NextResponse.json({ error: 'Erro ao salvar restrições.' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[permissions/restrictions] POST', err)
    return NextResponse.json({ error: 'Erro ao salvar restrições.' }, { status: 500 })
  }
}
