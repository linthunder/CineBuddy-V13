import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { getConnectionStatus, clearConnection, updateRootFolderId } from '@/lib/drive-connection'

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

/** GET: Status da conexão (admin apenas). */
export async function GET(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores.' },
        { status: 403 }
      )
    }

    const status = await getConnectionStatus()
    return NextResponse.json(status)
  } catch (err) {
    console.error('[drive/connection]', err)
    return NextResponse.json(
      { error: 'Erro ao verificar conexão.' },
      { status: 500 }
    )
  }
}

/** PATCH: Atualiza a pasta raiz (admin apenas). Body: { rootFolderId: string } */
export async function PATCH(request: NextRequest) {
  try {
    const result = await getAuthUser(request)
    const caller = result?.data?.user ?? null
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { rootFolderId?: string }
    const rootFolderId = (body.rootFolderId ?? '').trim()
    if (!rootFolderId) {
      return NextResponse.json({ error: 'rootFolderId é obrigatório.' }, { status: 400 })
    }

    await updateRootFolderId(rootFolderId)
    return NextResponse.json({ ok: true, rootFolderId })
  } catch (err) {
    console.error('[drive/connection PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar pasta.' }, { status: 500 })
  }
}

/** DELETE: Desconecta o Drive (admin apenas). */
export async function DELETE(request: NextRequest) {
  try {
    const { data: { user: caller } } = await getAuthUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem desconectar.' },
        { status: 403 }
      )
    }

    await clearConnection()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[drive/connection DELETE]', err)
    return NextResponse.json(
      { error: 'Erro ao desconectar.' },
      { status: 500 }
    )
  }
}
