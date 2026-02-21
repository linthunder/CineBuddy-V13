import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getOrCreatePath } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

/** GET: retorna URL do Drive para uma pasta do projeto. Query: projectId, path (path relativo à raiz do projeto). */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')?.trim()
    const path = request.nextUrl.searchParams.get('path')?.trim()
    if (!projectId || !path) {
      return NextResponse.json({ error: 'projectId e path são obrigatórios.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: project, error } = await supabase
      .from('projects')
      .select('drive_root_folder_id')
      .eq('id', projectId)
      .single()

    if (error || !project?.drive_root_folder_id) {
      return NextResponse.json(
        { error: 'Projeto não possui pasta no Drive. Salve o projeto para criar a estrutura.' },
        { status: 404 }
      )
    }

    const folderId = await getOrCreatePath(project.drive_root_folder_id, path)
    const url = `https://drive.google.com/drive/folders/${folderId}`
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao obter URL da pasta.'
    console.error('[drive/folder-url]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
