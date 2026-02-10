import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/** Verifica se já existe pelo menos um usuário (para mostrar login vs cadastro inicial). */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  try {
    const supabase = createServerClient()
    const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    if (error) {
      console.error('check-setup error:', error)
      return NextResponse.json({ hasUsers: true }, { status: 200, headers })
    }
    return NextResponse.json({ hasUsers: (count ?? 0) > 0 }, { status: 200, headers })
  } catch {
    return NextResponse.json({ hasUsers: true }, { status: 200, headers })
  }
}
