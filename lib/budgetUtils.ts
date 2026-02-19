import type { BudgetRow, BudgetRowLabor, BudgetRowCost, BudgetRowPeople, VerbaRow, PhaseDefaults, ComplementaryLine } from './types'
import type { BudgetLinesByPhase, VerbaLinesByPhase } from './types'
import { LABOR_DEPTS, PEOPLE_DEPTS } from './constants'

export function computeRowTotal(row: BudgetRow): number {
  if (row.type === 'labor') {
    const laborTotal = (row.unitCost + row.extraCost) * row.quantity
    const complTotal = (row.complementaryLines ?? []).reduce((s, c) => s + c.value, 0)
    return laborTotal + complTotal
  }
  if (row.type === 'people') return 0
  return row.unitCost * row.quantity
}

export interface CreateEmptyRowOptions {
  phaseDefaults?: PhaseDefaults
  /** Para CATERING: unitCost = alimentacaoPerPerson × teamCount */
  cateringDefaultUnitCost?: number
}

export function createEmptyRow(department: string, options?: CreateEmptyRowOptions): BudgetRow {
  const id = crypto.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const isLabor = LABOR_DEPTS.includes(department as never)
  const isPeople = PEOPLE_DEPTS.includes(department as never)
  const def = options?.phaseDefaults
  if (isLabor) {
    return {
      id,
      type: 'labor',
      department,
      roleFunction: '',
      itemName: '',
      unitType: 'dia',
      unitCost: 0,
      extraCost: def ? def.deslocamento : 0,
      quantity: def ? (def.dias > 0 ? def.dias : 1) : 1,
      totalCost: 0,
    } satisfies BudgetRowLabor
  }
  if (isPeople) {
    return {
      id,
      type: 'people',
      department,
      itemName: '',
      roleFunction: '',
    } satisfies BudgetRowPeople
  }
  const isCatering = department === 'CATERING'
  const unitCost = isCatering && options?.cateringDefaultUnitCost != null ? options.cateringDefaultUnitCost : 0
  return {
    id,
    type: 'cost',
    department,
    roleFunction: '',
    itemName: '',
    unitType: 'cache',
    unitCost,
    extraCost: 0,
    quantity: 1,
    totalCost: 0,
  } satisfies BudgetRowCost
}

export function sumDeptTotal(rows: BudgetRow[]): number {
  return rows.reduce((sum, r) => sum + computeRowTotal(r), 0)
}

export function computeVerbaRowTotal(row: VerbaRow): number {
  return row.unitCost * row.quantity
}

export function createEmptyVerbaRow(): VerbaRow {
  const id = crypto.randomUUID?.() ?? `verba-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return { id, itemName: '', unitCost: 0, quantity: 1, totalCost: 0 }
}

export function createEmptyComplementaryLine(): ComplementaryLine {
  const id = crypto.randomUUID?.() ?? `compl-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return { id, lineType: 'OUTROS', description: '', value: 0 }
}

/** Verba total destinada ao departamento no orçamento (budget + verba) por fase. */
export function getDeptBudget(
  budgetLines: BudgetLinesByPhase,
  verbaLines: VerbaLinesByPhase,
  dept: string
): number {
  let total = 0
  ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
    const rows = budgetLines[phase]?.[dept] ?? []
    total += sumDeptTotal(rows)
    const verbaRows = verbaLines[phase]?.[dept] ?? []
    total += verbaRows.reduce((s, r) => s + computeVerbaRowTotal(r), 0)
  })
  return total
}
