import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getOrCreatePath, uploadFileToFolder } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const runtime = 'nodejs'

/** POST: upload de arquivo para uma pasta do projeto. FormData: projectId, path, file. */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const projectId = (formData.get('projectId') as string)?.trim()
    const path = (formData.get('path') as string)?.trim()
    const file = formData.get('file') as File | null

    if (!projectId || !path) {
      return NextResponse.json(
        { error: 'projectId e path são obrigatórios.' },
        { status: 400 }
      )
    }
    if (!file || typeof file.size !== 'number' || file.size <= 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo válido enviado. Selecione um arquivo e clique em ENVIAR.' },
        { status: 400 }
      )
    }

    let mimeType = file.type || ''
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = (file.name || '').toLowerCase().split('.').pop()
      const extMap: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
      }
      mimeType = extMap[ext || ''] || 'application/octet-stream'
    }
    const allowed = mimeType === 'application/pdf' || mimeType.startsWith('image/')
    if (!allowed) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use PDF ou imagem (jpg, png, gif, webp, etc.).' },
        { status: 400 }
      )
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
    const arrayBuffer = await file.arrayBuffer()
    if (!arrayBuffer) {
      return NextResponse.json(
        { error: 'Falha ao ler o conteúdo do arquivo.' },
        { status: 400 }
      )
    }
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name || `upload-${Date.now()}`

    const { id, webViewLink } = await uploadFileToFolder(
      folderId,
      buffer,
      mimeType,
      fileName
    )

    return NextResponse.json({ fileId: id, fileUrl: webViewLink })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar arquivo.'
    console.error('[drive/upload]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
