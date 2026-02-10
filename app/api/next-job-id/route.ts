import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/** Retorna o próximo job_id sequencial (BZ0001, BZ0002, …). Usa contador no Supabase. */
export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('next-job-id: SUPABASE_SERVICE_ROLE_KEY não definida. Configure em Vercel > Settings > Environment Variables.')
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Configure SUPABASE_SERVICE_ROLE_KEY no Vercel.' },
      { status: 503 }
    )
  }
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.rpc('get_next_job_number')

    if (error) {
      console.error('get_next_job_number:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const num = Number(data)
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: 'Número de sequência inválido.' }, { status: 500 })
    }

    const jobId = `BZ${String(num).padStart(4, '0')}`
    return NextResponse.json({ jobId })
  } catch (e) {
    console.error('next-job-id', e)
    return NextResponse.json({ error: 'Erro ao obter próximo ID.' }, { status: 500 })
  }
}
