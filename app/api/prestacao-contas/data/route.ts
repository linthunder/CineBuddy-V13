import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getDeptBySlug, type ExpenseDepartment, type ExpenseLine } from '@/lib/prestacao-contas'
import { getDeptBudget } from '@/lib/budgetUtils'
import type { BudgetLinesByPhase, VerbaLinesByPhase } from '@/lib/types'

/** GET: retorna dados apenas do departamento (verba, despesas, responsáveis). Público; não exige login. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const deptSlug = searchParams.get('deptSlug')

    if (!projectId?.trim() || !deptSlug?.trim()) {
      return NextResponse.json({ error: 'projectId e deptSlug são obrigatórios.' }, { status: 400 })
    }

    const department = getDeptBySlug(deptSlug.trim())
    if (!department) {
      return NextResponse.json({ error: 'Departamento inválido.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, nome, budget_lines_final, verba_lines_final, closing_lines')
      .eq('id', projectId.trim())
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    const budgetLines = (project.budget_lines_final ?? {}) as unknown as BudgetLinesByPhase
    const verbaLines = (project.verba_lines_final ?? {}) as unknown as VerbaLinesByPhase
    const closingData = (project.closing_lines ?? []) as unknown[]

    const expensesAll = (Array.isArray(closingData) && closingData[1] ? closingData[1] : []) as ExpenseLine[]
    const expenses = expensesAll.filter((e) => e.department === department)

    const expenseDepartmentConfig =
      closingData.length >= 4 && closingData[3] != null && typeof closingData[3] === 'object'
        ? (closingData[3] as Record<string, { responsible1?: string; responsible2?: string }>)
        : undefined
    const config = expenseDepartmentConfig?.[department] ?? {}
    const responsible1 = config.responsible1 ?? ''
    const responsible2 = config.responsible2 ?? ''

    const verba = getDeptBudget(budgetLines, verbaLines, department)
    const totalGasto = expenses.reduce((s, e) => s + (e.value ?? 0), 0)
    const saldo = verba - totalGasto

    return NextResponse.json({
      projectName: project.nome ?? '',
      department: department as string,
      departmentSlug: deptSlug.trim(),
      responsible1,
      responsible2,
      verba,
      saldo,
      expenses,
    })
  } catch (e) {
    console.error('prestacao-contas/data GET error:', e)
    return NextResponse.json({ error: 'Erro ao carregar dados.' }, { status: 500 })
  }
}
