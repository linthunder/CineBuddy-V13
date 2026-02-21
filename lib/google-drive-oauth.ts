/**
 * Helpers OAuth para Google Drive.
 * Usado apenas em API routes (servidor).
 */

import { google } from 'googleapis'
import { createServerClient } from '@/lib/supabase-server'
import { getConnectionRow, saveConnection } from '@/lib/drive-connection'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

export function getRedirectUri(): string {
  const baseUrl =
    process.env.GOOGLE_OAUTH_REDIRECT_BASE ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  return `${baseUrl.replace(/\/$/, '')}/api/auth/google-drive/callback`
}

function getOAuth2Client(redirectUri?: string) {
  const uri = redirectUri ?? getRedirectUri()
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET devem estar definidas. Configure em .env.local'
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, uri)
}

/** Gera a URL para o usuário autorizar o acesso ao Drive. */
export function getAuthUrl(): string {
  const oauth2 = getOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_SCOPE],
  })
}

/** Troca o código de autorização por tokens e salva no banco. NÃO cria pasta — o usuário define em Configurações. */
export async function exchangeCodeForTokens(code: string): Promise<{ email: string }> {
  const oauth2 = getOAuth2Client()
  const { tokens } = await oauth2.getToken(code)
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Google não retornou os tokens necessários. Tente novamente.')
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000)

  oauth2.setCredentials(tokens)
  const drive = google.drive({ version: 'v3', auth: oauth2 })

  let email = ''
  try {
    const about = await drive.about.get({ fields: 'user' })
    const user = about.data.user
    if (user?.emailAddress) email = user.emailAddress
  } catch {
    // ignorar
  }

  await saveConnection({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    email: email || undefined,
    root_folder_id: null,
  })

  return { email }
}

/** Retorna um OAuth2Client configurado com tokens válidos (renova se expirado). */
export async function getAuthenticatedClient() {
  const row = await getConnectionRow()
  if (!row) {
    throw new Error(
      'Google Drive não está conectado. Vá em Configurações → Drive e clique em Conectar.'
    )
  }

  const oauth2 = getOAuth2Client()
  oauth2.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: new Date(row.expires_at).getTime(),
  })

  const isExpired = new Date(row.expires_at).getTime() < Date.now() + 60 * 1000
  if (isExpired && row.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken()
    if (credentials.access_token && credentials.refresh_token) {
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000)
      await saveConnection({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expires_at: expiresAt,
        email: row.email ?? undefined,
        root_folder_id: row.root_folder_id ?? undefined,
      })
      oauth2.setCredentials(credentials)
    }
  }

  return oauth2
}

/** Retorna o ID da pasta raiz (CineBuddy - Projetos). */
export async function getDriveRootFolderId(): Promise<string> {
  const row = await getConnectionRow()
  if (!row?.root_folder_id) {
    throw new Error(
      'Google Drive não está conectado. Vá em Configurações → Drive e clique em Conectar.'
    )
  }
  return row.root_folder_id
}
