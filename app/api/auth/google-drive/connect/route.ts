import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { getAuthUrl } from '@/lib/google-drive-oauth'

export const dynamic = 'force-dynamic'

/** POST: Retorna a URL para autorizar o Google Drive. Apenas admin. */
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
    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser(token)
    if (!caller) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem conectar o Drive.' },
        { status: 403 }
      )
    }

    const authUrl = getAuthUrl()
    return NextResponse.json({ url: authUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar URL.'
    console.error('[google-drive/connect]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
