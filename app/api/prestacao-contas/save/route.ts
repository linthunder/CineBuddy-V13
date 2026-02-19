import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getDeptBySlug, type ExpenseDepartment, type ExpenseLine } from '@/lib/prestacao-contas'
import { verifyPrestacaoToken } from '@/lib/prestacao-contas-jwt'

/** POST: salva despesas do departamento. Valida token (sem login). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token, projectId, deptSlug, expenses } = body as {
      token?: string
      projectId?: string
      deptSlug?: string
      expenses?: ExpenseLine[]
    }

    if (!token || !projectId?.trim() || !deptSlug?.trim()) {
      return NextResponse.json({ error: 'token, projectId e deptSlug são obrigatórios.' }, { status: 400 })
    }

    const payload = verifyPrestacaoToken(token)
    if (!payload || payload.projectId !== projectId.trim() || payload.department !== getDeptBySlug(deptSlug.trim())) {
      return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 403 })
    }

    const department = getDeptBySlug(deptSlug.trim()) as ExpenseDepartment
    if (!department) {
      return NextResponse.json({ error: 'Departamento inválido.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('closing_lines')
      .eq('id', projectId.trim())
      .single()

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const closingData = (project.closing_lines ?? []) as unknown[]
    const closingLines = Array.isArray(closingData) && closingData[0] ? closingData[0] : []
    let expensesFull = (Array.isArray(closingData) && closingData[1] ? closingData[1] : []) as ExpenseLine[]
    const saving = closingData[2] ?? null
    const expenseDepartmentConfig = closingData.length >= 4 && closingData[3] != null ? closingData[3] : null

    const newExpensesDept = Array.isArray(expenses) ? expenses.map((e) => ({ ...e, department })) : []
    expensesFull = expensesFull.filter((e) => e.department !== department)
    expensesFull = [...expensesFull, ...newExpensesDept]

    const updatedClosing: unknown[] = [closingLines, expensesFull, saving, expenseDepartmentConfig]

    const { error } = await supabase
      .from('projects')
      .update({ closing_lines: updatedClosing })
      .eq('id', projectId.trim())

    if (error) {
      console.error('prestacao-contas/save update error:', error)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('prestacao-contas/save error:', e)
    return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
  }
}
