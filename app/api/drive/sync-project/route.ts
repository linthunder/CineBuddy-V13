import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { syncProjectToDrive, projectRootFolderName } from '@/lib/google-drive'
import { extractTeamFromBudgetLines, extractCastingFromBudgetLines, extractCostItemsByDepartment } from '@/lib/drive-folder-structure'

export const dynamic = 'force-dynamic'

/** POST: sincroniza a estrutura do projeto no Google Drive (raiz + estrutura fixa + pastas da equipe).
 * Body: { projectId, forceRecreate?: boolean } — forceRecreate=true força recriação mesmo com drive_root_folder_id preenchido. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const forceRecreate = body.forceRecreate === true
    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'projectId é obrigatório.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, job_id, nome, cliente, budget_lines_final, drive_root_folder_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })
    }

    let existingRootId = (project.drive_root_folder_id ?? '') as string
    if (forceRecreate) {
      await supabase.from('projects').update({ drive_root_folder_id: null }).eq('id', projectId)
      existingRootId = ''
    }

    const budgetLines = (project.budget_lines_final ?? {}) as Record<string, unknown>
    const team = extractTeamFromBudgetLines(budgetLines)
    const casting = extractCastingFromBudgetLines(budgetLines)
    const costItemsByDepartment = extractCostItemsByDepartment(budgetLines)
    const nome = (project.nome ?? '').toString()
    const cliente = (project.cliente ?? '').toString()
    const hadRoot = !!existingRootId?.trim()

    const jobId = (project.job_id ?? '').toString().trim() || project.id
    const { rootId, recreated } = await syncProjectToDrive(
      project.id,
      jobId,
      nome,
      cliente,
      team,
      casting,
      costItemsByDepartment,
      hadRoot ? existingRootId : null
    )

    if ((!hadRoot || recreated) && rootId) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ drive_root_folder_id: rootId })
        .eq('id', projectId)
      if (updateError) {
        console.error('[drive/sync-project] Falha ao atualizar drive_root_folder_id:', updateError)
        return NextResponse.json(
          { ok: false, error: `Pasta criada, mas falha ao salvar no banco: ${updateError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      driveRootFolderId: rootId,
      projectRootName: projectRootFolderName(jobId, nome, cliente),
      recreated: recreated || undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao sincronizar com o Drive.'
    console.error('[drive/sync-project]', err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
