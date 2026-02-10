import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/** Cadastro inicial: cria o primeiro usuário como admin. Só funciona se não existir nenhum perfil. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name = '', surname = '', email = '', password = '' } = body as { name?: string; surname?: string; email?: string; password?: string }

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Já existem usuários. Use a tela de login.' }, { status: 400 })
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
      role: 'admin',
      name: (name || '').trim(),
      surname: (surname || '').trim(),
      email: email.trim(),
    })

    if (profileError) {
      console.error('init profile insert error:', profileError)
      return NextResponse.json({ error: 'Usuário criado mas falha ao criar perfil. Contate o suporte.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('init error:', e)
    return NextResponse.json({ error: 'Erro no servidor.' }, { status: 500 })
  }
}
