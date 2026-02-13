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

/** Produção: mesmos depts de pré/prod + AGÊNCIA e CLIENTE ao final (apenas em prod) */
export const PROD_LIST = [...PRE_PROD_LIST, 'AGÊNCIA', 'CLIENTE'] as const

/** Ordem dos departamentos para a tela Funções e Cachês (mesma sequência da página Orçamento) */
export const ROLES_DEPARTAMENTOS_ORDER: string[] = [...PRE_PROD_LIST, 'AGÊNCIA', 'CLIENTE', ...POS_PROD_LIST]

export const DEPARTMENTS = {
  pre: [...PRE_PROD_LIST],
  prod: [...PROD_LIST],
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

/** Tabelas de pessoas (NOME + FUNÇÃO), contabilizadas para catering; sem valores monetários. Apenas em prod. */
export const PEOPLE_DEPTS = ['AGÊNCIA', 'CLIENTE'] as const

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
  AGÊNCIA: { item: 'Nome', supplier: 'Função' },
  CLIENTE: { item: 'Nome', supplier: 'Função' },
}
