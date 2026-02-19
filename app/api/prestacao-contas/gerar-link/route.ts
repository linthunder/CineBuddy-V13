import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { getDeptBySlug, getSlugByDept } from '@/lib/prestacao-contas'
import { signPrestacaoToken } from '@/lib/prestacao-contas-jwt'

/** POST: gera link com token para o departamento. Exige usuário logado (Bearer). */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.PRESTACAO_CONTAS_JWT_SECRET) {
      console.error('prestacao-contas/gerar-link: PRESTACAO_CONTAS_JWT_SECRET não definida (Vercel/env)')
      return NextResponse.json(
        { error: 'Serviço de link não configurado. Defina PRESTACAO_CONTAS_JWT_SECRET no painel da Vercel.' },
        { status: 503 }
      )
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada. Faça login novamente.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { projectId, deptSlug } = body as { projectId?: string; deptSlug?: string }
    if (!projectId?.trim() || !deptSlug?.trim()) {
      return NextResponse.json({ error: 'projectId e deptSlug são obrigatórios.' }, { status: 400 })
    }

    const department = getDeptBySlug(deptSlug.trim())
    if (!department) {
      return NextResponse.json({ error: 'Departamento inválido.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId.trim())
      .single()
    if (projectError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const jwt = signPrestacaoToken(projectId.trim(), department)
    // Usar origin da requisição para o link ficar na mesma porta em que o usuário está; fallback para env
    const baseUrl = (request.headers.get('origin') || '').trim() || process.env.NEXT_PUBLIC_APP_URL || ''
    const path = `/prestacao-contas/${projectId.trim()}/${getSlugByDept(department)}`
    const fullUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}?token=${encodeURIComponent(jwt)}` : `${path}?token=${encodeURIComponent(jwt)}`

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 90)

    return NextResponse.json({ url: fullUrl, expiresAt: expiresAt.toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    console.error('prestacao-contas/gerar-link error:', e)
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Servidor: configure SUPABASE_SERVICE_ROLE_KEY na Vercel.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Erro ao gerar link.' }, { status: 500 })
  }
}
