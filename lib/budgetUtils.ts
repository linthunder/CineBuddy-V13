import type { BudgetRow, BudgetRowLabor, BudgetRowCost, VerbaRow } from './types'
import { LABOR_DEPTS } from './constants'

export function computeRowTotal(row: BudgetRow): number {
  if (row.type === 'labor') return (row.unitCost + row.extraCost) * row.quantity
  return row.unitCost * row.quantity
}

export function createEmptyRow(department: string): BudgetRow {
  const id = crypto.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const isLabor = LABOR_DEPTS.includes(department as never)
  if (isLabor) {
    return {
      id,
      type: 'labor',
      department,
      roleFunction: '',
      itemName: '',
      unitType: 'dia',
      unitCost: 0,
      extraCost: 0,
      quantity: 1,
      totalCost: 0,
    } satisfies BudgetRowLabor
  }
  return {
    id,
    type: 'cost',
    department,
    roleFunction: '',
    itemName: '',
    unitType: 'cache',
    unitCost: 0,
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
