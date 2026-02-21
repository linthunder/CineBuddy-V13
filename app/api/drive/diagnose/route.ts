import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getConnectionStatus } from '@/lib/drive-connection'

export const dynamic = 'force-dynamic'

/**
 * GET: Diagnóstico da integração com o Drive.
 * Verifica OAuth configurado, conexão e projetos com drive_root_folder_id.
 */
export async function GET() {
  const checks: Record<string, boolean | string> = {}
  let projectsWithDrive = 0
  let projectsWithoutDrive = 0

  // 1. GOOGLE_OAUTH_CLIENT_ID
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  checks.GOOGLE_OAUTH_CLIENT_ID = !!(clientId?.trim())

  // 2. GOOGLE_OAUTH_CLIENT_SECRET
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  checks.GOOGLE_OAUTH_CLIENT_SECRET = !!(clientSecret?.trim())

  // 3. drive_connection (OAuth conectado)
  try {
    const status = await getConnectionStatus()
    checks.drive_connected = status.connected
    if (status.connected && status.email) {
      checks.drive_email = status.email
    }
  } catch {
    checks.drive_connected = false
  }

  // 4. Projetos com/sem drive_root_folder_id
  try {
    const supabase = createServerClient()
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, job_id, drive_root_folder_id')
    if (!error && projects) {
      projectsWithDrive = projects.filter((p) => !!p.drive_root_folder_id).length
      projectsWithoutDrive = projects.filter((p) => !p.drive_root_folder_id).length
    }
  } catch {
    // ignorar
  }

  return NextResponse.json({
    env: checks,
    projects: { withDrive: projectsWithDrive, withoutDrive: projectsWithoutDrive },
    hint:
      !checks.drive_connected
        ? 'Conecte o Google Drive em Configurações → Drive.'
        : projectsWithoutDrive > 0
          ? 'Salve os projetos sem drive_root_folder_id para criar a estrutura no Drive.'
          : undefined,
  })
}
