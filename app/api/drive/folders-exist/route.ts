import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { pathExists } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

/** POST: verifica se as pastas existem. Body: { projectId, paths: string[] }. Retorna { exists: Record<string, boolean> }. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const paths = Array.isArray(body.paths) ? body.paths.filter((p: unknown): p is string => typeof p === 'string').slice(0, 100) : []
    if (!projectId || paths.length === 0) {
      return NextResponse.json({ exists: {} })
    }

    const supabase = createServerClient()
    const { data: project, error } = await supabase
      .from('projects')
      .select('drive_root_folder_id')
      .eq('id', projectId)
      .single()

    if (error || !project?.drive_root_folder_id) {
      return NextResponse.json({ exists: Object.fromEntries(paths.map((p: string) => [p, false])) })
    }

    const results = await Promise.all(
      paths.map(async (path: string) => {
        const exists = await pathExists(project.drive_root_folder_id, path)
        return [path, exists] as const
      })
    )
    return NextResponse.json({ exists: Object.fromEntries(results) })
  } catch (err) {
    console.error('[drive/folders-exist]', err)
    return NextResponse.json({ exists: {} }, { status: 500 })
  }
}
