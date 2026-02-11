import type { PhaseKey } from './constants'

/** Tipo de unidade para linha de mão de obra */
export type LaborUnitType = 'dia' | 'sem' | 'flat'

/** Tipo de unidade para linha de custo */
export type CostUnitType = 'cache' | 'verba' | 'extra'

/** Linha de orçamento - Mão de obra (diárias, etc.) */
export interface BudgetRowLabor {
  id: string
  type: 'labor'
  department: string
  roleFunction: string
  itemName: string
  unitType: LaborUnitType
  unitCost: number
  extraCost: number
  quantity: number
  totalCost: number
}

/** Linha de orçamento - Custo (item/fornecedor) */
export interface BudgetRowCost {
  id: string
  type: 'cost'
  department: string
  roleFunction: string
  itemName: string
  unitType: CostUnitType
  unitCost: number
  extraCost: 0
  quantity: number
  totalCost: number
  /** Apenas 1ª linha CATERING: false = valor manual (usuário editou); undefined/true = cálculo auto */
  cateringAuto?: boolean
}

/** Linha de pessoas (AGÊNCIA, CLIENTE): apenas NOME e FUNÇÃO; 1 pessoa por linha; contabilizada para catering */
export interface BudgetRowPeople {
  id: string
  type: 'people'
  department: string
  itemName: string
  roleFunction: string
}

export type BudgetRow = BudgetRowLabor | BudgetRowCost | BudgetRowPeople

/** Dados das mini tabelas (contingência, CRT, BV agência) */
export interface MiniTablesData {
  contingencia: number
  crt: number
  bvagencia: number
}

/** Padrões por fase (diárias, semanas, deslocamento, alimentação por pessoa) */
export interface PhaseDefaults {
  dias: number
  semanas: number
  deslocamento: number
  alimentacaoPerPerson: number
}

export type PhaseDefaultsByPhase = Record<'pre' | 'prod' | 'pos', PhaseDefaults>

/** Estado do orçamento por fase: departamento -> linhas */
export type BudgetLinesByDept = Record<string, BudgetRow[]>

/** Estado por fase (pre/prod/pos) */
export type BudgetLinesByPhase = Record<'pre' | 'prod' | 'pos', BudgetLinesByDept>

/** Linha da seção "Verbas" (dentro de um departamento) */
export interface VerbaRow {
  id: string
  itemName: string
  unitCost: number
  quantity: number
  totalCost: number
}

/** Verbas por fase e departamento */
export type VerbaLinesByPhase = Record<'pre' | 'prod' | 'pos', Record<string, VerbaRow[]>>

/** Status de lock por estágio do projeto */
export interface ProjectStatus {
  initial: 'open' | 'locked'
  final: 'open' | 'locked'
  closing: 'open' | 'locked'
}

/** Dados do projeto (cabeçalho / View Filme) */
export interface ProjectData {
  jobId: string
  nome: string
  agencia: string
  cliente: string
  duracao: string
  duracaoUnit: 'segundos' | 'minutos'
}
