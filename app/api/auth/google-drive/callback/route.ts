import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/google-drive-oauth'

export const dynamic = 'force-dynamic'

/** GET: Callback do Google OAuth. Google redireciona aqui com ?code=... */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const baseUrl =
    process.env.GOOGLE_OAUTH_REDIRECT_BASE ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  const appUrl = baseUrl.replace(/\/$/, '')

  if (error) {
    console.error('[google-drive/callback] OAuth error:', error)
    return NextResponse.redirect(`${appUrl}?view=config&drive_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}?view=config&drive_error=missing_code`)
  }

  try {
    const { email } = await exchangeCodeForTokens(code)
    return NextResponse.redirect(
      `${appUrl}?view=config&drive_connected=1&email=${encodeURIComponent(email)}`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar.'
    console.error('[google-drive/callback]', err)
    return NextResponse.redirect(
      `${appUrl}?view=config&drive_error=${encodeURIComponent(message)}`
    )
  }
}
