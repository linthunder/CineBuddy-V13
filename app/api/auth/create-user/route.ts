import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

/** Cria novo usuário (admin apenas). Requer sessão de admin. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey)
    const { data: { user: caller } } = await supabaseAuth.auth.getUser(token)
    if (!caller) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem criar usuários.' }, { status: 403 })
    }

    const VALID_ROLES = ['admin', 'atendimento', 'produtor_executivo', 'crew', 'assistente_direcao', 'convidado'] as const
    const body = await request.json()
    const { name = '', surname = '', email = '', password = '', role = 'produtor_executivo' } = body as {
      name?: string; surname?: string; email?: string; password?: string; role?: string
    }

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })
    }

    if (role === 'admin') {
      const { count, error: countError } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin')
      if (!countError && (count ?? 0) >= 3) {
        return NextResponse.json({ error: 'Máximo de 3 administradores permitidos.' }, { status: 400 })
      }
    }

    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    if (!userData.user) {
      return NextResponse.json({ error: 'Falha ao criar usuário.' }, { status: 500 })
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userData.user.id,
      role,
      name: (name || '').trim(),
      surname: (surname || '').trim(),
      email: email.trim(),
    })

    if (profileError) {
      console.error('create-user profile insert error:', profileError)
      return NextResponse.json({ error: 'Usuário criado mas falha ao criar perfil.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('create-user error:', e)
    return NextResponse.json({ error: 'Erro no servidor.' }, { status: 500 })
  }
}
