/**
 * Constantes e helpers para a página exclusiva de prestação de contas.
 * Uma página por departamento, vinculada ao projeto; acesso sem login via link com token.
 */

export const EXPENSE_DEPARTMENTS = [
  'PRODUÇÃO',
  'ARTE E CENOGRAFIA',
  'FIGURINO E MAQUIAGEM',
  'FOTOGRAFIA E TÉCNICA',
] as const

export type ExpenseDepartment = (typeof EXPENSE_DEPARTMENTS)[number]

/** Slug usado na URL para cada departamento */
export const DEPT_SLUGS: Record<ExpenseDepartment, string> = {
  'PRODUÇÃO': 'producao',
  'ARTE E CENOGRAFIA': 'arte-cenografia',
  'FIGURINO E MAQUIAGEM': 'figurino-maquiagem',
  'FOTOGRAFIA E TÉCNICA': 'fotografia-tecnica',
}

const SLUG_TO_DEPT: Record<string, ExpenseDepartment> = Object.fromEntries(
  (Object.entries(DEPT_SLUGS) as [ExpenseDepartment, string][]).map(([dept, slug]) => [slug, dept])
)

export const EXPENSE_TYPE_OPTIONS = ['Alimentação', 'Combustível', 'Estacionamento', 'Outros'] as const
export type ExpenseTypeOption = (typeof EXPENSE_TYPE_OPTIONS)[number]

/** Linha de despesa da prestação de contas (compatível com ViewFechamento). */
export interface ExpenseLine {
  id: string
  department: ExpenseDepartment
  name: string
  description: string
  value: number
  invoiceNumber: string
  payStatus: 'pendente' | 'pago'
  date: string
  supplier: string
  expenseType: string
}

/** Responsáveis do departamento (até 2). */
export interface ExpenseDeptConfig {
  responsible1?: string
  responsible2?: string
}

/** Retorna o departamento interno a partir do slug da URL, ou null se inválido. */
export function getDeptBySlug(slug: string): ExpenseDepartment | null {
  return SLUG_TO_DEPT[slug] ?? null
}

/** Retorna o slug da URL para o departamento. */
export function getSlugByDept(department: ExpenseDepartment): string {
  return DEPT_SLUGS[department]
}

/** Valida se o slug é um dos 4 departamentos. */
export function isValidDeptSlug(slug: string): slug is string {
  return slug in SLUG_TO_DEPT
}
