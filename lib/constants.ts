/**
 * Departamentos por fase (espelho do frontend V13.50)
 */
export const PRE_PROD_LIST = [
  'DIREÇÃO',
  'PRODUÇÃO',
  'FOTOGRAFIA E TÉCNICA',
  'ARTE E CENOGRAFIA',
  'FIGURINO E MAQUIAGEM',
  'SOM DIRETO',
  'CASTING',
  'EQUIPAMENTOS',
  'LOCAÇÕES',
  'TRANSPORTE',
  'CATERING',
  'DESPESAS GERAIS',
] as const

export const POS_PROD_LIST = ['FINALIZAÇÃO', 'ANIMAÇÃO', 'VFX', 'ÁUDIO'] as const

export const DEPARTMENTS = {
  pre: [...PRE_PROD_LIST],
  prod: [...PRE_PROD_LIST],
  pos: [...POS_PROD_LIST],
} as const

export const LABOR_DEPTS = [
  'DIREÇÃO',
  'PRODUÇÃO',
  'FOTOGRAFIA E TÉCNICA',
  'ARTE E CENOGRAFIA',
  'FIGURINO E MAQUIAGEM',
  'SOM DIRETO',
  'FINALIZAÇÃO',
  'ANIMAÇÃO',
  'VFX',
  'ÁUDIO',
] as const

/** Departamentos que possuem botão "Adicionar verba" (igual ao frontend V13.50) */
export const VERBA_DEPTS = [
  'PRODUÇÃO',
  'FOTOGRAFIA E TÉCNICA',
  'ARTE E CENOGRAFIA',
  'FIGURINO E MAQUIAGEM',
  'CASTING',
] as const

export type PhaseKey = 'pre' | 'prod' | 'pos'
export type LaborDept = (typeof LABOR_DEPTS)[number]

/** Cabeçalhos customizados por departamento (Item / Fornecedor) */
export const CUSTOM_HEADERS: Record<string, { item: string; supplier: string }> = {
  CASTING: { item: 'Nome', supplier: 'Descrição' },
  LOCAÇÕES: { item: 'Item', supplier: 'Descrição' },
  EQUIPAMENTOS: { item: 'Item', supplier: 'Fornecedor' },
  CATERING: { item: 'Item', supplier: 'Descrição' },
  TRANSPORTE: { item: 'Item', supplier: 'Descrição' },
  'DESPESAS GERAIS': { item: 'Item', supplier: 'Descrição' },
}
