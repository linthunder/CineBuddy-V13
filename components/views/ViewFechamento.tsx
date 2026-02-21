'use client'

import { useMemo, useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, Fragment, startTransition } from 'react'
import PageLayout from '@/components/PageLayout'
import { CUSTOM_HEADERS, DEPARTMENTS, LABOR_DEPTS } from '@/lib/constants'
import type { PhaseKey } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency, parseCurrencyInput } from '@/lib/utils'
import { getSlugByDept } from '@/lib/prestacao-contas'
import type { BudgetLinesByPhase, VerbaLinesByPhase, MiniTablesData, BudgetRow, BudgetRowLabor, PhaseDefaultsByPhase } from '@/lib/types'
import { computeRowTotal, computeVerbaRowTotal, sumDeptTotal, getDeptBudget } from '@/lib/budgetUtils'
import { listCollaborators, type Collaborator } from '@/lib/services/collaborators'
import { memberFolderName, costItemFolderName, EQUIPE_DRIVE_PATH, CASTING_DRIVE_PATH } from '@/lib/drive-folder-structure'
import DriveLinkButton from '@/components/DriveLinkButton'
import { X, Plus, Lock, LockOpen, Info, DollarSign, PenLine, Receipt, FolderOpen } from 'lucide-react'

/* ── Tipos internos ── */
/** Uma diária de gravação: horas da diária, adicional % e horas extras nesse dia */
export interface DiariaEntry {
  dailyHours: number
  additionalPct: number
  overtimeHours: number
}

interface ClosingLine {
  id: string
  department: string
  phase: string
  name: string
  role: string
  type: string
  isLabor: boolean
  isVerba: boolean
  finalValue: number
  finalUnitCost: number
  finalExtraCost: number
  finalQuantity: number
  /** Soma dos valores das linhas complementares (para exibir no resumo do profissional) */
  complementaryTotal?: number
  /** Diárias de gravação (uma entrada por dia); substitui os campos únicos para labor */
  diarias: DiariaEntry[]
  /** @deprecated use diarias; mantido para migração no loadState */
  dailyHours?: number
  additionalPct?: number
  overtimeHours?: number
  invoiceNumber: string
  payStatus: 'pendente' | 'pago'
  /** Linha de despesa extra adicionada via botão +EXTRA (não vem do orçamento) */
  isExtra?: boolean
  /** Para extras em CASTING: id da linha do profissional ao qual esta extra pertence (adicionada via "+") */
  parentLineId?: string
}

/** Departamentos que possuem botão +EXTRA para adicionar linha de despesa extra */
const COST_DEPTS_WITH_EXTRA = ['CASTING', 'EQUIPAMENTOS', 'LOCAÇÕES', 'TRANSPORTE', 'CATERING', 'DESPESAS GERAIS'] as const

/** Departamentos da prestação de contas */
const EXPENSE_DEPARTMENTS = ['PRODUÇÃO', 'ARTE E CENOGRAFIA', 'FIGURINO E MAQUIAGEM', 'FOTOGRAFIA E TÉCNICA'] as const
export type ExpenseDepartment = (typeof EXPENSE_DEPARTMENTS)[number]

/** Responsáveis pela prestação de contas do departamento (até 2) */
export interface ExpenseDeptConfig {
  responsible1?: string
  responsible2?: string
}

/** Cargos sempre disponíveis para responsáveis em todos os departamentos */
const EXPENSE_FIXED_ROLES = ['Produtor Executivo', 'Diretor de produção', 'Diretor de Cena'] as const

/** Opções do campo TIPO na prestação de contas */
const EXPENSE_TYPE_OPTIONS = ['Alimentação', 'Combustível', 'Estacionamento', 'Outros'] as const
export type ExpenseTypeOption = (typeof EXPENSE_TYPE_OPTIONS)[number]

interface ExpenseLine {
  id: string
  department: ExpenseDepartment
  name: string
  description: string
  value: number
  invoiceNumber: string
  payStatus: 'pendente' | 'pago'
  /** Data da despesa (YYYY-MM-DD) */
  date: string
  /** Fornecedor */
  supplier: string
  /** Tipo: Alimentação, Combustível, Estacionamento, Outros */
  expenseType: string
}

/* ── Helpers ── */
const PHASE_LABELS: Record<string, string> = {
  pre: 'Pré-produção',
  prod: 'Produção',
  pos: 'Pós-produção',
}

const PHASE_TABS: { key: PhaseKey; label: string }[] = [
  { key: 'pre', label: 'Pré-produção' },
  { key: 'prod', label: 'Produção' },
  { key: 'pos', label: 'Pós-produção' },
]

/** Normaliza linha para sempre ter diarias (para compatibilidade com dados antigos). */
function normalizeDiarias(line: ClosingLine): DiariaEntry[] {
  if (line.diarias && line.diarias.length > 0) return line.diarias
  return [{
    dailyHours: line.dailyHours ?? 8,
    additionalPct: line.additionalPct ?? 0,
    overtimeHours: line.overtimeHours ?? 0,
  }]
}

/** Path da pasta no Drive para uma linha do fechamento (labor, casting ou custo). */
function getLineFolderPath(line: ClosingLine): string {
  if (line.isLabor) return `${EQUIPE_DRIVE_PATH}/${memberFolderName({ name: line.name, role: line.role })}`
  if (line.department === 'CASTING') return `${CASTING_DRIVE_PATH}/${memberFolderName({ name: line.name, role: line.role })}`
  return `_PRODUÇÃO/PRESTAÇÃO DE CONTAS/PRODUÇÃO/${line.department}/${costItemFolderName({ name: line.name, role: line.role })}`
}

function getLineContractPath(line: ClosingLine): string {
  return `${line.department === 'CASTING' ? CASTING_DRIVE_PATH : EQUIPE_DRIVE_PATH}/${memberFolderName({ name: line.name, role: line.role })}/CONTRATO`
}

function getLineInvoicePath(line: ClosingLine): string {
  return `${line.department === 'CASTING' ? CASTING_DRIVE_PATH : EQUIPE_DRIVE_PATH}/${memberFolderName({ name: line.name, role: line.role })}/NOTA FISCAL`
}

/** Valor da diária de referência (para exibição e cálculo de HE: semana = semanal/5) */
function getCachePerDay(line: ClosingLine): number {
  if (line.type === 'sem') return line.finalUnitCost / 5
  if (line.type === 'dia') return line.finalUnitCost
  const diarias = normalizeDiarias(line)
  const n = Math.max(1, diarias.length)
  return line.finalValue / n
}

function calcOvertime(line: ClosingLine): number {
  if (!line.isLabor) return 0
  const diarias = normalizeDiarias(line)
  const unitPerDay = line.type === 'sem' ? line.finalUnitCost / 5 : line.finalUnitCost
  let total = 0
  for (const d of diarias) {
    if (d.dailyHours <= 0) continue
    const hourlyRate = unitPerDay / d.dailyHours
    const rateWithAdditional = hourlyRate * (1 + d.additionalPct / 100)
    total += rateWithAdditional * d.overtimeHours
  }
  return total
}

function findCollaboratorByName(collaborators: Collaborator[], name: string): Collaborator | undefined {
  const normalized = (name || '').trim().toLowerCase()
  return collaborators.find((c) => c.nome?.trim().toLowerCase() === normalized)
}

function calcTotalNF(line: ClosingLine): number {
  /* Labor type dia: total = valor/diária × quantidade de diárias (ao adicionar diária, recalcula) */
  const base = line.isLabor && line.type === 'dia'
    ? (line.finalUnitCost ?? 0) * Math.max(1, normalizeDiarias(line).length)
    : line.finalValue
  return base + calcOvertime(line)
}

const inputStyle: React.CSSProperties = {
  backgroundColor: resolve.bg,
  border: `1px solid ${resolve.border}`,
  color: resolve.text,
  borderRadius: 2,
}
const inputClassName = 'w-full py-1 px-2 text-[11px] focus:outline-none'
/** Selects da linha de diária: compactos e bem distribuídos */
const inputDiariaClassName = 'w-full max-w-[6.5rem] py-0.5 px-1.5 text-[10px] focus:outline-none'
/** Linha vertical que ocupa toda a altura do container (uso em células com flex items-stretch) */
const sepVertical = (key?: string) => (
  <span key={key} className="flex-shrink-0 w-px min-h-full self-stretch" style={{ backgroundColor: resolve.border }} aria-hidden />
)
const iconBtnCls = 'team-info-btn w-7 h-7 flex items-center justify-center rounded border transition-colors text-xs font-medium'

function CopyableLine({ label, value }: { label: string; value: string }) {
  const text = value || '—'
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof window !== 'undefined') window.alert('Copiado!')
    }).catch(() => {})
  }
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] uppercase block" style={{ color: resolve.muted }}>{label}</span>
        <span className="text-sm break-words" style={{ color: resolve.text }}>{text}</span>
      </div>
      <button type="button" onClick={copy} title="Copiar" className="team-info-btn flex-shrink-0 h-7 px-2 rounded border text-[10px] font-medium uppercase" style={{ borderColor: resolve.border, color: resolve.text }}>Copiar</button>
    </div>
  )
}

const DAILY_HOURS_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const ADDITIONAL_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const OVERTIME_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Itens que podem entrar no cálculo do Saving (verbas + departamentos de custo) */
const SAVING_ITEMS: { key: string; label: string }[] = [
  { key: 'verba-PRODUÇÃO', label: 'Verba de Produção' },
  { key: 'verba-ARTE E CENOGRAFIA', label: 'Verba de Arte e Cenografia' },
  { key: 'verba-FOTOGRAFIA E TÉCNICA', label: 'Verba de Fotografia e Técnica' },
  { key: 'verba-FIGURINO E MAQUIAGEM', label: 'Verba de Figurino e Maquiagem' },
  { key: 'dept-EQUIPAMENTOS', label: 'Equipamentos' },
  { key: 'dept-LOCAÇÕES', label: 'Locações' },
  { key: 'dept-TRANSPORTE', label: 'Transporte' },
  { key: 'dept-CATERING', label: 'Catering' },
  { key: 'dept-DESPESAS GERAIS', label: 'Despesas Gerais' },
]

const SAVING_PCT_OPTIONS = [5, 10, 15, 20, 25] as const

export interface SavingConfig {
  items: string[]
  pct: number
  responsibleId: string | null
}

function sumSnapshotTotal(
  budgetLines: BudgetLinesByPhase,
  verbaLines: VerbaLinesByPhase,
  itemKey: string
): number {
  const [kind, dept] = itemKey.startsWith('verba-') ? ['verba', itemKey.slice(6)] : ['dept', itemKey.slice(5)]
  let total = 0
  ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
    if (kind === 'verba') {
      const rows = verbaLines[phase]?.[dept] ?? []
      total += rows.reduce((s, r) => s + computeVerbaRowTotal(r), 0)
    } else {
      const rows = budgetLines[phase]?.[dept] ?? []
      total += sumDeptTotal(rows)
    }
  })
  return total
}

/* ── Props ── */
interface ViewFechamentoProps {
  finalSnapshot: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
    miniTables: MiniTablesData
    jobValue: number
    taxRate: number
    notes: Record<'pre' | 'prod' | 'pos', string>
  } | null
  initialSnapshot?: {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
  } | null
  initialJobValue: number
  isLocked?: boolean
  /** Callback do botão CONCLUIR FECHAMENTO / REABRIR FECHAMENTO */
  onToggleLock?: () => void
  /** Padrões por fase (dias da fase) para HE de profissional por semana */
  getPhaseDefaults?: () => PhaseDefaultsByPhase | undefined
  /** ID do projeto no banco (para gerar link da prestação por departamento) */
  projectDbId?: string | null
  /** Gera URL com token para a página exclusiva do departamento. Retorna { url } ou { error }. */
  onGenerateLink?: (projectId: string, deptSlug: string) => Promise<{ url: string } | { error: string }>
}

export interface ViewFechamentoHandle {
  getState: () => { closingLines: ClosingLine[]; expenses: ExpenseLine[]; expenseDepartmentConfig?: Record<ExpenseDepartment, ExpenseDeptConfig>; saving: SavingConfig | undefined }
  loadState: (state: { closingLines: ClosingLine[]; expenses: ExpenseLine[]; expenseDepartmentConfig?: Record<string, ExpenseDeptConfig>; saving?: SavingConfig | null }) => void
}

/* ── Componente ── */
const defaultSaving: SavingConfig = { items: [], pct: 10, responsibleId: null }

const defaultDiaria = (): DiariaEntry => ({ dailyHours: 8, additionalPct: 0, overtimeHours: 0 })

const JORNADA_LABEL: Record<string, string> = { dia: 'Diária', sem: 'Semana', flat: 'Fechado' }

const ViewFechamento = forwardRef<ViewFechamentoHandle, ViewFechamentoProps>(function ViewFechamento({ finalSnapshot, initialSnapshot, initialJobValue, isLocked = false, onToggleLock, getPhaseDefaults, projectDbId, onGenerateLink }, ref) {
  const [closingLines, setClosingLines] = useState<ClosingLine[]>([])
  const [expenses, setExpenses] = useState<ExpenseLine[]>([])
  const [saving, setSaving] = useState<SavingConfig>(defaultSaving)
  const [savingModalOpen, setSavingModalOpen] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [modalContact, setModalContact] = useState<Collaborator | 'no-data' | null>(null)
  const [modalBank, setModalBank] = useState<Collaborator | 'no-data' | null>(null)
  const [activePhase, setActivePhase] = useState<PhaseKey>('prod')
  /** Para tipo 'sem': linha expandida para cálculo de HE (mostra diárias) */
  const [showOvertimeForLineId, setShowOvertimeForLineId] = useState<Record<string, boolean>>({})
  const [expenseDepartmentConfig, setExpenseDepartmentConfig] = useState<Record<ExpenseDepartment, ExpenseDeptConfig>>(() =>
    EXPENSE_DEPARTMENTS.reduce((acc, d) => ({ ...acc, [d]: {} }), {} as Record<ExpenseDepartment, ExpenseDeptConfig>)
  )
  const [expenseResponsibleModalDept, setExpenseResponsibleModalDept] = useState<ExpenseDepartment | null>(null)
  const [linkModal, setLinkModal] = useState<{ url: string; department: string } | { error: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  /** Loading por departamento: só o dept em que clicou mostra "…"; os outros continuam "Gerar link". */
  const [linkModalLoadingDept, setLinkModalLoadingDept] = useState<ExpenseDepartment | null>(null)
  const [editingExpenseValueId, setEditingExpenseValueId] = useState<string | null>(null)
  const [editingExpenseValueRaw, setEditingExpenseValueRaw] = useState('')
  /** Estado de edição do campo Valor nas linhas extra (evita "1000,00" virar "1,00" ao digitar) */
  const [editingExtraValorId, setEditingExtraValorId] = useState<string | null>(null)
  const [editingExtraValorRaw, setEditingExtraValorRaw] = useState('')
  const loadedFromDB = useRef(false)

  const toEditValue = (n: number): string => (n <= 0 ? '' : n.toFixed(2).replace('.', ','))

  useEffect(() => {
    listCollaborators().then(setCollaborators).catch(() => setCollaborators([]))
  }, [])

  useImperativeHandle(ref, () => ({
    getState: () => ({
      closingLines,
      expenses,
      expenseDepartmentConfig: expenseDepartmentConfig,
      saving: saving.items.length > 0 || saving.responsibleId ? saving : undefined,
    }),
    loadState: (state) => {
      loadedFromDB.current = state.closingLines.length > 0 || state.expenses.length > 0
      const normalized = state.closingLines.map((l: ClosingLine & { complementaryTotal?: number }) => {
        const diarias = l.diarias?.length
          ? l.diarias
          : [{ dailyHours: l.dailyHours ?? 8, additionalPct: l.additionalPct ?? 0, overtimeHours: l.overtimeHours ?? 0 }]
        return { ...l, diarias }
      })
      setClosingLines(normalized)
      const expenseList = (state.expenses as (ExpenseLine & { department?: string })[]).map((e) => ({
        ...e,
        department: (e.department && EXPENSE_DEPARTMENTS.includes(e.department as ExpenseDepartment)) ? e.department as ExpenseDepartment : 'PRODUÇÃO',
        date: e.date ?? '',
        supplier: e.supplier ?? '',
        expenseType: e.expenseType ?? 'Outros',
      }))
      setExpenses(expenseList)
      if (state.expenseDepartmentConfig && typeof state.expenseDepartmentConfig === 'object') {
        const next: Record<ExpenseDepartment, ExpenseDeptConfig> = EXPENSE_DEPARTMENTS.reduce((acc, d) => ({
          ...acc,
          [d]: (state.expenseDepartmentConfig as Record<string, ExpenseDeptConfig>)[d] || {},
        }), {} as Record<ExpenseDepartment, ExpenseDeptConfig>)
        setExpenseDepartmentConfig(next)
      }
      setSaving(state.saving != null ? { ...defaultSaving, ...state.saving } : defaultSaving)
    },
  }))

  useEffect(() => {
    if (!finalSnapshot) return
    if (loadedFromDB.current) { loadedFromDB.current = false; return }
    const lines: ClosingLine[] = []
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const depts = DEPARTMENTS[phase]
      depts.forEach((dept) => {
        const rows: BudgetRow[] = finalSnapshot.budgetLines[phase]?.[dept] ?? []
        const isLabor = LABOR_DEPTS.includes(dept as never)
        rows.forEach((row) => {
          if (row.type === 'people') return
          const total = computeRowTotal(row)
          if (total <= 0 && !row.itemName && !row.roleFunction) return
          const laborRow = row as BudgetRowLabor
          const complementaryTotal = isLabor ? (laborRow.complementaryLines ?? []).reduce((s, c) => s + c.value, 0) : 0
          const numDias = Math.max(1, row.quantity || 1)
          const diarias: DiariaEntry[] = Array.from({ length: numDias }, () => defaultDiaria())
          lines.push({
            id: row.id,
            department: dept,
            phase,
            name: row.itemName || row.roleFunction || '',
            role: isLabor ? row.roleFunction : row.roleFunction || '',
            type: row.unitType,
            isLabor,
            isVerba: false,
            finalValue: total,
            finalUnitCost: row.unitCost,
            finalExtraCost: isLabor ? (laborRow.extraCost ?? 0) : 0,
            finalQuantity: row.quantity,
            complementaryTotal: complementaryTotal > 0 ? complementaryTotal : undefined,
            diarias,
            invoiceNumber: '',
            payStatus: 'pendente',
          })
        })
        // Verbas deste dept
        const verbaRows = finalSnapshot.verbaLines[phase]?.[dept] ?? []
        verbaRows.forEach((v) => {
          const total = computeVerbaRowTotal(v)
          if (total <= 0 && !v.itemName) return
          lines.push({
            id: v.id,
            department: dept,
            phase,
            name: v.itemName || 'Verba',
            role: '',
            type: 'verba',
            isLabor: false,
            isVerba: true,
            finalValue: total,
            finalUnitCost: v.unitCost,
            finalExtraCost: 0,
            finalQuantity: v.quantity,
            diarias: [],
            invoiceNumber: '',
            payStatus: 'pendente',
          })
        })
      })
    })
    setClosingLines(lines)
    setExpenses([])
  }, [finalSnapshot])

  const updateLine = useCallback((id: string, updates: Partial<ClosingLine>) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }, [isLocked])

  const updateDiaria = useCallback((lineId: string, diariaIndex: number, updates: Partial<DiariaEntry>) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId || !l.diarias?.length) return l
      const next = [...l.diarias]
      if (diariaIndex < 0 || diariaIndex >= next.length) return l
      next[diariaIndex] = { ...next[diariaIndex], ...updates }
      return { ...l, diarias: next }
    }))
  }, [isLocked])

  const addDiaria = useCallback((lineId: string) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId) return l
      const diarias = normalizeDiarias(l)
      return { ...l, diarias: [...diarias, defaultDiaria()] }
    }))
  }, [isLocked])

  const removeDiaria = useCallback((lineId: string, diariaIndex: number) => {
    if (isLocked) return
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId) return l
      const diarias = normalizeDiarias(l)
      if (diarias.length <= 1) return l
      const next = diarias.filter((_, i) => i !== diariaIndex)
      return { ...l, diarias: next }
    }))
  }, [isLocked])

  /** Expande o bloco de HE para profissional por semana; cria diárias conforme dias da fase */
  const expandOvertimeForSemLine = useCallback((lineId: string) => {
    setShowOvertimeForLineId((prev) => ({ ...prev, [lineId]: true }))
    const phaseDefs = getPhaseDefaults?.()
    const dias = phaseDefs?.[activePhase]?.dias ?? 1
    const n = Math.max(1, dias)
    setClosingLines((prev) => prev.map((l) => {
      if (l.id !== lineId || l.type !== 'sem') return l
      const current = normalizeDiarias(l)
      if (current.length >= n) return l
      const next = [...current]
      while (next.length < n) next.push(defaultDiaria())
      return { ...l, diarias: next }
    }))
  }, [activePhase, getPhaseDefaults])

  const addExtraLine = useCallback((dept: string, parentLineId?: string) => {
    if (isLocked) return
    const id = `extra-${dept}-${Date.now()}`
    const newLine: ClosingLine = {
      id,
      department: dept,
      phase: activePhase,
      name: '',
      role: '',
      type: 'cache',
      isLabor: false,
      isVerba: false,
      finalValue: 0,
      finalUnitCost: 0,
      finalExtraCost: 0,
      finalQuantity: 1,
      diarias: [],
      invoiceNumber: '',
      payStatus: 'pendente',
      isExtra: true,
      parentLineId,
    }
    setClosingLines((prev) => [...prev, newLine])
  }, [activePhase, isLocked])

  const removeLine = useCallback((lineId: string) => {
    if (isLocked) return
    setClosingLines((prev) => prev.filter((l) => l.id !== lineId))
  }, [isLocked])

  /* Agrupar por fase e depois por departamento (pré → produção → pós). Exclui linhas de verba (tabelas dedicadas em Prestação de contas). */
  const linesByPhaseAndDept = useMemo(() => {
    const byPhase: Record<string, Record<string, ClosingLine[]>> = { pre: {}, prod: {}, pos: {} }
    const deptOrder: Record<string, string[]> = { pre: [], prod: [], pos: [] }
    closingLines.forEach((l) => {
      if (l.isVerba) return
      const phase = l.phase in byPhase ? l.phase : 'prod'
      if (!byPhase[phase][l.department]) {
        byPhase[phase][l.department] = []
        deptOrder[phase].push(l.department)
      }
      byPhase[phase][l.department].push(l)
    })
    const result: { phase: string; phaseLabel: string; depts: { dept: string; lines: ClosingLine[] }[] }[] = []
    ;(['pre', 'prod', 'pos'] as const).forEach((phase) => {
      const depts = deptOrder[phase].map((dept) => ({ dept, lines: byPhase[phase][dept] }))
      if (depts.length > 0) {
        result.push({ phase, phaseLabel: PHASE_LABELS[phase] ?? phase, depts })
      }
    })
    return result
  }, [closingLines])

  /* Totais */
  const totalCustoFinal = useMemo(() => closingLines.reduce((s, l) => s + calcTotalNF(l), 0), [closingLines])
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.value, 0), [expenses])
  const totalPago = useMemo(() => {
    const fromLines = closingLines.filter((l) => l.payStatus === 'pago').reduce((s, l) => s + calcTotalNF(l), 0)
    const fromExp = expenses.filter((e) => e.payStatus === 'pago').reduce((s, e) => s + e.value, 0)
    return fromLines + fromExp
  }, [closingLines, expenses])
  const totalPendente = useMemo(() => {
    const fromLines = closingLines.filter((l) => l.payStatus === 'pendente').reduce((s, l) => s + calcTotalNF(l), 0)
    const fromExp = expenses.filter((e) => e.payStatus === 'pendente').reduce((s, e) => s + e.value, 0)
    return fromLines + fromExp
  }, [closingLines, expenses])
  const lucroFinal = initialJobValue - totalCustoFinal - totalExpenses

  /* Verba destinada e saldo por departamento (prestação de contas) */
  const expenseDeptBudget = useMemo(() => {
    if (!finalSnapshot) return {} as Record<ExpenseDepartment, number>
    return EXPENSE_DEPARTMENTS.reduce((acc, d) => ({
      ...acc,
      [d]: getDeptBudget(finalSnapshot.budgetLines, finalSnapshot.verbaLines, d),
    }), {} as Record<ExpenseDepartment, number>)
  }, [finalSnapshot])
  const expenseDeptSaldo = useMemo(() => {
    return EXPENSE_DEPARTMENTS.reduce((acc, d) => {
      const budget = expenseDeptBudget[d] ?? 0
      const gasto = expenses.filter((e) => e.department === d).reduce((s, e) => s + e.value, 0)
      return { ...acc, [d]: budget - gasto }
    }, {} as Record<ExpenseDepartment, number>)
  }, [expenseDeptBudget, expenses])

  /* Opções de responsáveis: cargos fixos (em todos os depts) + profissionais do dept. Diretor de Cena em qualquer dept pode ser responsável por qualquer verba. */
  const expenseDeptResponsibleOptions = useMemo(() => {
    const normalizedRole = (r: string) => (r || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const fixedWithNames: string[] = []
    const addLabel = (label: string) => {
      if (label && !fixedWithNames.includes(label)) fixedWithNames.push(label)
    }
    EXPENSE_FIXED_ROLES.forEach((role) => {
      const roleNorm = normalizedRole(role)
      const matches = closingLines.filter((l) => normalizedRole(l.role || '') === roleNorm)
      if (matches.length > 0) {
        matches.forEach((l) => addLabel(l.name ? `${l.name} (${l.role})` : (l.role || '')))
      } else {
        fixedWithNames.push(role)
      }
    })
    /* Diretores de Cena de qualquer departamento: podem ser responsáveis por todas as verbas */
    const diretorCenaNorm = normalizedRole('Diretor de Cena')
    closingLines
      .filter((l) => (l.name || l.role) && normalizedRole(l.role || '').includes(diretorCenaNorm))
      .forEach((l) => addLabel(l.name ? `${l.name} (${l.role})` : (l.role || '')))
    return EXPENSE_DEPARTMENTS.reduce((acc, dept) => {
      const fromLines = closingLines
        .filter((l) => l.department === dept && (l.name || l.role))
        .map((l) => (l.role ? `${l.name || ''} (${l.role})`.trim() || l.role : l.name || ''))
        .filter(Boolean)
      const uniq = Array.from(new Set(fromLines))
      acc[dept] = Array.from(new Set([...fixedWithNames, ...uniq]))
      return acc
    }, {} as Record<ExpenseDepartment, string[]>)
  }, [closingLines])

  const setExpenseDeptResponsible = useCallback((dept: ExpenseDepartment, slot: 1 | 2, value: string | undefined) => {
    if (isLocked) return
    setExpenseDepartmentConfig((prev) => {
      const cur = prev[dept] || {}
      if (slot === 1) return { ...prev, [dept]: { ...cur, responsible1: value, responsible2: value === cur.responsible2 ? undefined : cur.responsible2 } }
      return { ...prev, [dept]: { ...cur, responsible2: value, responsible1: value === cur.responsible1 ? undefined : cur.responsible1 } }
    })
  }, [isLocked])

  /* Saving: economia inicial vs final nos itens selecionados; valor a pagar = economia × % */
  const { totalEconomy, valueToPay } = useMemo(() => {
    if (!finalSnapshot || saving.items.length === 0) return { totalEconomy: 0, valueToPay: 0 }
    const init = initialSnapshot
    let economy = 0
    saving.items.forEach((key) => {
      const initialTotal = init ? sumSnapshotTotal(init.budgetLines, init.verbaLines, key) : 0
      const finalTotal = sumSnapshotTotal(finalSnapshot.budgetLines, finalSnapshot.verbaLines, key)
      const diff = initialTotal - finalTotal
      if (diff > 0) economy += diff
    })
    const pct = Math.min(25, Math.max(5, saving.pct)) / 100
    return { totalEconomy: economy, valueToPay: economy * pct }
  }, [finalSnapshot, initialSnapshot, saving.items, saving.pct])

  const laborLinesForSaving = useMemo(() => closingLines.filter((l) => l.isLabor && (l.name || l.role)), [closingLines])

  /* Prestação de contas */
  const addExpense = useCallback((department: ExpenseDepartment = 'PRODUÇÃO') => {
    if (isLocked) return
    setExpenses((prev) => [...prev, { id: `exp-${Date.now()}`, department, name: '', description: '', value: 0, invoiceNumber: '', payStatus: 'pendente', date: '', supplier: '', expenseType: 'Outros' }])
  }, [isLocked])
  const updateExpense = useCallback((id: string, updates: Partial<ExpenseLine>) => {
    if (isLocked) return
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }, [isLocked])
  const removeExpense = useCallback((id: string) => {
    if (isLocked) return
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }, [isLocked])

  const expenseValueDisplay = (exp: ExpenseLine): string => {
    if (editingExpenseValueId === exp.id) return editingExpenseValueRaw
    return exp.value > 0 ? formatCurrency(exp.value) : ''
  }
  const handleExpenseValueFocus = useCallback((exp: ExpenseLine) => {
    setEditingExpenseValueId(exp.id)
    setEditingExpenseValueRaw(toEditValue(exp.value))
  }, [])
  const handleExpenseValueChange = useCallback((id: string, raw: string) => {
    setEditingExpenseValueRaw(raw)
    updateExpense(id, { value: parseCurrencyInput(raw) })
  }, [updateExpense])
  const handleExpenseValueBlur = useCallback(() => {
    setEditingExpenseValueId(null)
    setEditingExpenseValueRaw('')
  }, [])

  if (!finalSnapshot) {
    return (
      <PageLayout title="Fechamento">
        <div className="text-center py-12" style={{ color: resolve.muted }}>
          <p className="text-sm">Finalize o Orçamento Realizado para acessar o Fechamento.</p>
        </div>
      </PageLayout>
    )
  }

  /* Finance strip */
  const financeStrip = (
    <div
      className="rounded overflow-hidden grid grid-cols-1 lg:grid-cols-5 gap-0 border-b min-w-0"
      style={{ backgroundColor: resolve.panel, borderColor: resolve.purple, borderRadius: 3 }}
    >
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Valor total</label>
        <div className="text-base sm:text-lg font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(initialJobValue)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Custo Final</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: resolve.text }}>{formatCurrency(totalCustoFinal + totalExpenses)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Total Pago</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: cinema.success }}>{formatCurrency(totalPago)}</div>
      </div>
      <div className="p-3 border-b lg:border-b-0 lg:border-r flex flex-col items-center justify-center min-w-0" style={{ borderColor: resolve.border }}>
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Pendente</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: cinema.danger }}>{formatCurrency(totalPendente)}</div>
      </div>
      <div className="p-3 flex flex-col items-center justify-center min-w-0">
        <label className="text-[11px] uppercase tracking-wider font-medium mb-0.5" style={{ color: resolve.muted }}>Lucro Final</label>
        <div className="text-sm sm:text-base font-semibold font-mono" style={{ color: lucroFinal >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(lucroFinal)}</div>
      </div>
    </div>
  )

  const closingTabs = (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 items-center w-full min-w-0">
      {/* Saving: alinhado à esquerda */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 items-center min-w-0">
        <button
          type="button"
          onClick={() => setSavingModalOpen(true)}
          disabled={isLocked}
          className="h-8 px-2 sm:px-3 md:px-4 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1"
          style={{
            backgroundColor: resolve.panel,
            borderColor: resolve.border,
            color: resolve.text,
          }}
        >
          Saving
        </button>
        <span className="text-[11px] min-w-0 truncate max-w-[120px] sm:max-w-none" style={{ color: resolve.muted }} title={`Total economia: ${formatCurrency(totalEconomy)}`}>
          <span className="hidden sm:inline">Total economia: </span><strong className="font-mono" style={{ color: resolve.text }}>{formatCurrency(totalEconomy)}</strong>
        </span>
        <select
          className="h-8 px-2 rounded text-[10px] sm:text-xs font-medium border focus:outline-none min-w-0"
          style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
          value={saving.pct}
          onChange={(e) => setSaving((prev) => ({ ...prev, pct: Number(e.target.value) }))}
          disabled={isLocked}
        >
          {SAVING_PCT_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}%</option>
          ))}
        </select>
        <span className="text-[11px]" style={{ color: resolve.muted }}>
          A pagar: <strong className="font-mono" style={{ color: cinema.success }}>{formatCurrency(valueToPay)}</strong>
        </span>
        <select
          className="h-8 px-2 rounded text-[10px] sm:text-xs font-medium border focus:outline-none min-w-[90px] md:min-w-[140px]"
          style={{ backgroundColor: resolve.panel, borderColor: resolve.border, color: resolve.text }}
          value={saving.responsibleId ?? ''}
          onChange={(e) => setSaving((prev) => ({ ...prev, responsibleId: e.target.value || null }))}
          disabled={isLocked}
        >
          <option value="">Responsável</option>
          {laborLinesForSaving.map((l) => (
            <option key={l.id} value={l.id}>{l.name || l.role || '—'} ({l.role || l.department})</option>
          ))}
        </select>
      </div>
      {onToggleLock && (
        <button
          type="button"
          onClick={onToggleLock}
          className="ml-auto h-8 px-2 sm:px-3 md:px-4 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border flex items-center gap-1"
          style={{
            backgroundColor: isLocked ? '#e67e22' : cinema.success,
            borderColor: isLocked ? '#e67e22' : cinema.success,
            color: '#ffffff',
          }}
        >
          {isLocked ? <LockOpen size={16} strokeWidth={2} aria-hidden style={{ color: '#fff' }} /> : <Lock size={16} strokeWidth={2} aria-hidden style={{ color: '#fff' }} />}
          <span className="md:hidden">{isLocked ? 'Reabrir' : 'Concluir'}</span>
          <span className="hidden md:inline">{isLocked ? 'Reabrir fechamento' : 'Concluir fechamento'}</span>
        </button>
      )}
      {/* Modal de seleção dos itens do Saving */}
      {savingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setSavingModalOpen(false)}
        >
          <div
            className="rounded border p-4 max-w-md w-full shadow-xl"
            style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: resolve.text }}>Itens incluídos no Saving</h3>
            <div className="flex flex-col gap-2 mb-4">
              {SAVING_ITEMS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-[12px]" style={{ color: resolve.text }}>
                  <input
                    type="checkbox"
                    checked={saving.items.includes(key)}
                    onChange={(e) => {
                      setSaving((prev) => ({
                        ...prev,
                        items: e.target.checked ? [...prev.items, key] : prev.items.filter((i) => i !== key),
                      }))
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSavingModalOpen(false)}
              className="w-full py-2 rounded text-xs font-medium uppercase border"
              style={{ backgroundColor: resolve.yellowDark, borderColor: resolve.yellow, color: resolve.bg }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const activePhaseData = linesByPhaseAndDept.find((p) => p.phase === activePhase)

  return (
    <PageLayout title="Fechamento" strip={financeStrip} tabs={closingTabs}>
      {/* Navegação entre fases (como no Orçamento) */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center mb-4">
        {PHASE_TABS.map(({ key, label }) => {
          const isActive = activePhase === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => startTransition(() => setActivePhase(key))}
              className="btn-resolve-hover h-8 flex-1 sm:flex-none min-w-0 px-2 sm:px-3 md:px-4 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide transition-colors border whitespace-nowrap"
              style={{
                backgroundColor: isActive ? resolve.yellowDark : resolve.panel,
                borderColor: isActive ? resolve.yellow : resolve.border,
                color: isActive ? resolve.bg : resolve.muted,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Blocos do departamento da fase ativa */}
      <div className={isLocked ? 'locked-sheet' : ''}>
        {!activePhaseData?.depts.length ? (
          <div className="py-8 text-center text-sm rounded border" style={{ color: resolve.muted, borderColor: resolve.border, backgroundColor: resolve.panel }}>
            Nenhum item nesta fase.
          </div>
        ) : (
        activePhaseData.depts.map(({ dept, lines }) => {
              const deptTotal = lines.reduce((s, l) => s + calcTotalNF(l), 0)
              return (
                <div key={`${activePhase}-${dept}`} className="overflow-hidden border rounded mb-6" style={{ borderColor: resolve.border, borderRadius: 3 }}>
                  <div className="px-3 py-2 flex justify-between items-center border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>{dept}</span>
                    <div className="flex items-center gap-2">
                      {!isLocked && COST_DEPTS_WITH_EXTRA.includes(dept as (typeof COST_DEPTS_WITH_EXTRA)[number]) && (
                        <button
                          type="button"
                          onClick={() => addExtraLine(dept)}
                          className="btn-resolve-hover h-7 px-2 flex items-center justify-center gap-1 rounded border text-[10px] font-medium uppercase"
                          style={{ borderColor: resolve.border, color: resolve.text }}
                          title="Adicionar despesa extra"
                        >
                          <Plus size={12} strokeWidth={2} style={{ color: 'currentColor' }} />Extra
                        </button>
                      )}
                      <span className="font-mono text-[13px] font-medium" style={{ color: resolve.text }}>{formatCurrency(deptTotal)}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto" style={{ backgroundColor: resolve.panel }}>
                    {(() => {
                      /* CASTING: agrupa extras por profissional (parentLineId) e renderiza profissionais + extras abaixo de cada um */
                      const itemsToRender: { line: ClosingLine; lineIdx: number }[] = dept === 'CASTING'
                        ? (() => {
                            const professionals = lines.filter((l) => !l.isExtra)
                            const extrasWithParent = lines.filter((l) => l.isExtra && l.parentLineId)
                            const standaloneExtras = lines.filter((l) => l.isExtra && !l.parentLineId)
                            const nestedByParent = new Map<string, ClosingLine[]>()
                            extrasWithParent.forEach((ext) => {
                              const arr = nestedByParent.get(ext.parentLineId!) || []
                              arr.push(ext)
                              nestedByParent.set(ext.parentLineId!, arr)
                            })
                            const out: { line: ClosingLine; lineIdx: number }[] = []
                            let idx = 0
                            professionals.forEach((pro) => {
                              out.push({ line: pro, lineIdx: idx++ })
                              ;(nestedByParent.get(pro.id) || []).forEach((ext) => { out.push({ line: ext, lineIdx: idx++ }) })
                            })
                            standaloneExtras.forEach((ext) => { out.push({ line: ext, lineIdx: idx++ }) })
                            return out
                          })()
                        : lines.map((line, i) => ({ line, lineIdx: i }))

                      return itemsToRender.map(({ line, lineIdx }) => {
                        const overtime = calcOvertime(line)
                        const totalNF = calcTotalNF(line)
                        const diarias = normalizeDiarias(line)
                        const collab = line.name ? findCollaboratorByName(collaborators, line.name) : undefined
                        const isCastProfessional = dept === 'CASTING' && !line.isExtra && (line.name || line.role)
                        return (
                        <div
                          key={line.id}
                          className="border-b last:border-b-0"
                          style={{
                            borderColor: resolve.border,
                            borderBottomWidth: lineIdx < itemsToRender.length - 1 ? 2 : undefined,
                            marginBottom: lineIdx < itemsToRender.length - 1 ? 0 : undefined,
                          }}
                        >
                          {line.isExtra ? (
                            /* Linha extra: Item, Descrição, Tipo, Valor, Qtd, Total, Remover (como tabela de orçamento) */
                            <div className="px-3 py-2 border-t overflow-x-auto" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                              <table className="budget-table-main w-full border-collapse text-[11px] table-fixed min-w-0">
                                <colgroup>
                                  <col style={{ width: '24%' }} />
                                  <col style={{ width: '24%' }} />
                                  <col style={{ width: '12%' }} />
                                  <col style={{ width: '12%' }} />
                                  <col style={{ width: '8%' }} />
                                  <col style={{ width: '12%' }} />
                                  <col style={{ width: '40px' }} />
                                </colgroup>
                                <tbody>
                                  <tr className="border-b-0" style={{ borderColor: resolve.border }}>
                                    {(() => {
                                      const custom = CUSTOM_HEADERS[line.department]
                                      const itemLabel = custom?.item ?? 'Item'
                                      const supplierLabel = custom?.supplier ?? 'Descrição'
                                      const extraTotal = (line.finalUnitCost ?? 0) * (line.finalQuantity ?? 1)
                                      const isEditingValor = editingExtraValorId === line.id
                                      const valorDisplay = isEditingValor ? editingExtraValorRaw : (line.finalUnitCost && line.finalUnitCost > 0 ? toEditValue(line.finalUnitCost) : '')
                                      return (
                                        <>
                                          <td data-label={itemLabel} className="p-1.5 align-middle"><input className={inputClassName} style={inputStyle} value={line.name} onChange={(e) => updateLine(line.id, { name: e.target.value })} placeholder={itemLabel} /></td>
                                          <td data-label={supplierLabel} className="p-1.5 align-middle"><input className={inputClassName} style={inputStyle} value={line.role} onChange={(e) => updateLine(line.id, { role: e.target.value })} placeholder={supplierLabel} /></td>
                                          <td data-label="Tipo" className="p-1.5 align-middle">
                                            <select className={inputClassName} style={inputStyle} value={line.type || 'cache'} onChange={(e) => updateLine(line.id, { type: e.target.value })}>
                                              <option value="cache">Cachê</option>
                                              <option value="verba">Verba</option>
                                              <option value="extra">Extra</option>
                                            </select>
                                          </td>
                                          <td data-label="Valor" className="p-1.5 align-middle">
                                            <input className={inputClassName} style={inputStyle} value={valorDisplay} placeholder="R$ 0,00"
                                              onFocus={() => { setEditingExtraValorId(line.id); setEditingExtraValorRaw(line.finalUnitCost && line.finalUnitCost > 0 ? toEditValue(line.finalUnitCost) : '') }}
                                              onChange={(e) => { const raw = e.target.value; setEditingExtraValorRaw(raw); const v = parseCurrencyInput(raw); const qty = line.finalQuantity ?? 1; updateLine(line.id, { finalUnitCost: v, finalValue: v * qty }) }}
                                              onBlur={() => { setEditingExtraValorId(null); setEditingExtraValorRaw('') }}
                                            />
                                          </td>
                                          <td data-label="Qtd" className="p-1.5 align-middle budget-cell-qty"><input type="number" className={`${inputClassName} text-center`} style={inputStyle} value={line.finalQuantity ?? ''} onChange={(e) => { const qty = parseFloat(e.target.value) || 0; const unit = line.finalUnitCost ?? 0; updateLine(line.id, { finalQuantity: qty, finalValue: unit * qty }) }} min={0} step="any" /></td>
                                          <td data-label="Total" className="p-1.5 align-middle font-mono text-[11px] text-right font-medium budget-cell-total" style={{ color: resolve.text }}>{formatCurrency(extraTotal)}</td>
                                          <td className="budget-row-remove p-1.5 align-middle"><button type="button" onClick={() => removeLine(line.id)} className="btn-danger-hover inline-flex h-7 w-7 items-center justify-center rounded border transition-colors" style={{ borderColor: resolve.border, color: resolve.muted }} title="Excluir linha" aria-label="Excluir linha"><X size={14} strokeWidth={2} /></button></td>
                                        </>
                                      )
                                    })()}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <>
                              {/* Linha principal: nome, função, jornada (diária/semana), botão FECHAR (sem+expandido) e botões de informação */}
                              <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                <div className="min-w-0 flex items-center gap-2 flex-wrap flex-1">
                                  <span className="text-xs font-medium" style={{ color: resolve.text }}>{line.name || '—'}</span>
                                  {line.role && line.role !== line.name && (
                                    <span className="text-[11px]" style={{ color: resolve.muted }}>{line.role}</span>
                                  )}
                                  {line.isLabor && line.type && (
                                    <span
                                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                                      style={{ backgroundColor: resolve.border, color: resolve.muted }}
                                      title="Jornada de pagamento"
                                    >
                                      {JORNADA_LABEL[line.type] ?? line.type}
                                    </span>
                                  )}
                                  {line.isLabor && line.type === 'sem' && showOvertimeForLineId[line.id] && (
                                    <button
                                      type="button"
                                      onClick={() => setShowOvertimeForLineId((prev) => ({ ...prev, [line.id]: false }))}
                                      className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border transition-colors"
                                      style={{ borderColor: resolve.border, color: resolve.muted }}
                                    >
                                      Fechar
                                    </button>
                                  )}
                                </div>
                                {(line.name || line.role) || line.isExtra ? (
                                  <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                    {isCastProfessional && (
                                      <button type="button" onClick={() => addExtraLine('CASTING', line.id)} className={iconBtnCls} style={{ borderColor: resolve.border, color: resolve.text }} title="Adicionar linha extra abaixo"><Plus size={17} strokeWidth={1.5} /></button>
                                    )}
                                    {(line.isLabor || isCastProfessional) && (line.name || line.role) && (
                                      <>
                                        <button type="button" title="Telefone, e-mail e endereço" className={iconBtnCls} style={{ borderColor: resolve.border, color: resolve.text }} onClick={() => setModalContact(collab ?? 'no-data')}><Info size={17} strokeWidth={1.5} /></button>
                                        <button type="button" title="Dados bancários e PIX" className={iconBtnCls} style={{ borderColor: resolve.border, color: resolve.text }} onClick={() => setModalBank(collab ?? 'no-data')}><DollarSign size={17} strokeWidth={1.5} /></button>
                                        <DriveLinkButton projectId={projectDbId ?? null} drivePath={getLineContractPath(line)} variant="contract" className={`${iconBtnCls} w-7 h-7 flex items-center justify-center rounded border transition-colors`} style={{ borderColor: resolve.border, color: resolve.text }}><PenLine size={17} strokeWidth={1.5} /></DriveLinkButton>
                                        <DriveLinkButton projectId={projectDbId ?? null} drivePath={getLineInvoicePath(line)} variant="invoice" className={`${iconBtnCls} w-7 h-7 flex items-center justify-center rounded border transition-colors`} style={{ borderColor: resolve.border, color: resolve.text }}><Receipt size={17} strokeWidth={1.5} /></DriveLinkButton>
                                      </>
                                    )}
                                    {(line.name || line.role) && (
                                      <DriveLinkButton projectId={projectDbId ?? null} drivePath={getLineFolderPath(line)} variant="folder" title="Abrir pasta no Drive" className={`${iconBtnCls} w-7 h-7 flex items-center justify-center rounded border transition-colors`} style={{ borderColor: resolve.border, color: resolve.text }}><FolderOpen size={17} strokeWidth={1.5} /></DriveLinkButton>
                                    )}
                                  </div>
                                ) : null}
                              </div>

                              {/* Uma linha de diária por dia (labor). Por semana: oculto até clicar em "Calcular hora extra das diárias" */}
                          {line.isLabor && line.type === 'sem' && !showOvertimeForLineId[line.id] && (
                            <div className="px-3 py-2 border-t flex items-center" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                              <button
                                type="button"
                                onClick={() => expandOvertimeForSemLine(line.id)}
                                className="text-[11px] font-medium uppercase tracking-wider px-3 py-1.5 rounded border transition-colors"
                                style={{ borderColor: resolve.border, color: resolve.muted }}
                              >
                                Calcular hora extra das diárias
                              </button>
                              <span className="ml-2 text-[10px]" style={{ color: resolve.muted }}>(ref.: {formatCurrency(getCachePerDay(line))}/dia)</span>
                            </div>
                          )}
                          {line.isLabor && (line.type !== 'sem' || showOvertimeForLineId[line.id]) && (
                            <div className="px-3 py-3 border-t space-y-3" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                              {diarias.map((d, diariaIdx) => (
                                <div
                                  key={diariaIdx}
                                  className={`grid grid-cols-2 sm:grid-cols-5 gap-x-1.5 gap-y-1 items-center ${diariaIdx < diarias.length - 1 ? 'border-b pb-3' : ''}`}
                                  style={{ borderColor: diariaIdx < diarias.length - 1 ? resolve.border : undefined }}
                                >
                                  <div className="self-stretch h-full min-h-0 flex items-stretch gap-1.5 min-w-0 col-span-2 sm:col-span-1">
                                    <span className="text-[10px] uppercase whitespace-nowrap truncate flex items-center font-bold" style={{ color: resolve.muted }} title="Valor da diária de referência">{formatCurrency(getCachePerDay(line))}/dia</span>
                                    {sepVertical()}
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Diária {diarias.length > 1 ? `${diariaIdx + 1} (horas)` : 'de'}</label>
                                    <select className={inputDiariaClassName} style={inputStyle} value={d.dailyHours} onChange={(e) => updateDiaria(line.id, diariaIdx, { dailyHours: Number(e.target.value) })}>
                                      {DAILY_HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h}h</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Adicional</label>
                                    <select className={inputDiariaClassName} style={inputStyle} value={d.additionalPct} onChange={(e) => updateDiaria(line.id, diariaIdx, { additionalPct: Number(e.target.value) })}>
                                      {ADDITIONAL_OPTIONS.map((p) => <option key={p} value={p}>{p}%</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase mb-0.5" style={{ color: resolve.muted }}>Horas Extra</label>
                                    <select className={inputDiariaClassName} style={inputStyle} value={d.overtimeHours} onChange={(e) => updateDiaria(line.id, diariaIdx, { overtimeHours: Number(e.target.value) })}>
                                      {OVERTIME_OPTIONS.map((h) => <option key={h} value={h}>{h}h</option>)}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                                    {diarias.length > 1 && (
                                      <button type="button" onClick={() => removeDiaria(line.id, diariaIdx)} className="btn-danger-hover h-7 w-7 flex items-center justify-center rounded border transition-colors" style={{ borderColor: resolve.border, color: resolve.muted }} title="Excluir diária" aria-label="Excluir diária"><X size={14} strokeWidth={2} /></button>
                                    )}
                                    {diariaIdx === diarias.length - 1 && (
                                      <button type="button" onClick={() => addDiaria(line.id)} className="btn-resolve-hover h-7 px-2 flex items-center justify-center gap-1 rounded border text-[10px] font-medium uppercase" style={{ borderColor: resolve.border, color: resolve.text }} title="Adicionar diária"><Plus size={12} strokeWidth={2} style={{ color: 'currentColor' }} />Diária</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                            </>
                          )}

                          {/* Linha de resumo: CACHÊ TOTAL | CACHÊ DIA 1… (ou REF. CACHÊ/DIA para sem) | DESL. | HE | Saving */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 border-t text-[10px] uppercase tracking-wider" style={{ borderColor: resolve.border, color: resolve.muted }}>
                            {line.isLabor ? (
                              <>
                                <span className="whitespace-nowrap">Cachê total <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.finalUnitCost * line.finalQuantity)}</strong></span>
                                {line.type === 'dia' && (
                                  <>
                                    {sepVertical()}
                                    {diarias.length <= 1 ? (
                                      <span className="whitespace-nowrap">Cachê/dia <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(getCachePerDay(line))}</strong></span>
                                    ) : (
                                      diarias.map((_, i) => (
                                        <Fragment key={i}>
                                          {i > 0 && sepVertical()}
                                          <span className="whitespace-nowrap">Cachê dia {i + 1} <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(getCachePerDay(line))}</strong></span>
                                        </Fragment>
                                      ))
                                    )}
                                  </>
                                )}
                                {line.finalExtraCost > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Desl. <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.finalExtraCost * line.finalQuantity)}</strong></span>
                                  </>
                                )}
                                {(line.complementaryTotal ?? 0) > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Complementares <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(line.complementaryTotal!)}</strong></span>
                                  </>
                                )}
                                {line.type === 'sem' && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Ref. cachê/dia <span className="font-mono" style={{ color: resolve.muted }}>{formatCurrency(getCachePerDay(line))}</span></span>
                                  </>
                                )}
                                {overtime > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">HE <strong className="font-mono" style={{ color: resolve.accent }}>{formatCurrency(overtime)}</strong></span>
                                  </>
                                )}
                                {saving.responsibleId === line.id && valueToPay > 0 && (
                                  <>
                                    {sepVertical()}
                                    <span className="whitespace-nowrap">Saving <strong className="font-mono" style={{ color: cinema.success }}>{formatCurrency(valueToPay)}</strong></span>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {line.isVerba && <span>Verba</span>}
                              </>
                            )}
                            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                              <span className="font-mono text-[11px] font-medium whitespace-nowrap" style={{ color: resolve.yellow }}>
                                {formatCurrency(saving.responsibleId === line.id && valueToPay > 0 ? totalNF + valueToPay : totalNF)}
                              </span>
                              <button
                                type="button"
                                className="text-[10px] font-medium uppercase px-2.5 py-0.5 rounded transition-colors whitespace-nowrap"
                                style={{ backgroundColor: line.payStatus === 'pago' ? cinema.success : cinema.danger, color: '#fff' }}
                                onClick={() => updateLine(line.id, { payStatus: line.payStatus === 'pago' ? 'pendente' : 'pago' })}
                              >
                                {line.payStatus === 'pago' ? 'PAGO ✓' : 'A PAGAR'}
                              </button>
                            </div>
                          </div>
                </div>
              )
                      })
                    })()}
                  </div>
                </div>
              )
            })
        )}
      </div>

      {/* Prestação de contas */}
      <div className={`overflow-hidden border rounded mt-1 ${isLocked ? 'locked-sheet' : ''}`} style={{ borderColor: resolve.border, borderRadius: 3 }}>
        <div className="px-3 py-2 flex justify-between items-center border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>Prestação de contas</span>
        </div>
        <div className="p-2 sm:p-3 overflow-x-auto min-w-0" style={{ backgroundColor: resolve.panel }}>
          {EXPENSE_DEPARTMENTS.map((dept) => {
            const config = expenseDepartmentConfig[dept] || {}
            const r1 = config.responsible1 ?? ''
            const r2 = config.responsible2 ?? ''
            const saldo = expenseDeptSaldo[dept] ?? 0
            const budget = expenseDeptBudget[dept] ?? 0
            return (
            <div key={dept} className="mt-4 first:mt-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 py-2 px-3 rounded border-l-2" style={{ borderColor: resolve.border, borderLeftColor: resolve.accent, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: resolve.text }}>{dept}</span>
                  <span className="text-[10px] text-left shrink-0" style={{ color: resolve.muted }}>Responsáveis:</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    {r1 || r2 ? (
                      [r1, r2].filter(Boolean).map((name, i) => (
                      <Fragment key={`${dept}-resp-${i}`}>
                        {i > 0 && sepVertical(`sep-${dept}-${i}`)}
                        <span className="text-[11px] truncate" style={{ color: resolve.text }}>{name}</span>
                      </Fragment>
                      ))
                    ) : (
                      <span className="text-[11px]" style={{ color: resolve.text }}>Nenhum</span>
                    )}
                  </div>
                  {!isLocked && (
                    <>
                      <button
                        type="button"
                        className="btn-resolve-hover text-[10px] font-medium uppercase px-2 py-0.5 rounded border shrink-0"
                        style={{ borderColor: resolve.border, color: resolve.accent }}
                        onClick={() => setExpenseResponsibleModalDept(dept)}
                      >
                        Selecionar
                      </button>
                      {projectDbId && onGenerateLink && (
                        <button
                          key={`gerar-link-${dept}`}
                          type="button"
                          className="btn-resolve-hover text-[10px] font-medium uppercase px-2 py-0.5 rounded border shrink-0"
                          style={{ borderColor: resolve.border, color: resolve.muted }}
                          onClick={() => {
                            setLinkModalLoadingDept(dept)
                            setLinkModal(null)
                            void (async () => {
                              try {
                                const result = await onGenerateLink(projectDbId, getSlugByDept(dept))
                                if ('url' in result) { setLinkCopied(false); setLinkModal({ url: result.url, department: dept }) }
                                else setLinkModal({ error: result.error })
                              } catch (e) {
                                setLinkModal({ error: 'Erro ao gerar link.' })
                              } finally {
                                setLinkModalLoadingDept(null)
                              }
                            })()
                          }}
                          disabled={linkModalLoadingDept !== null}
                        >
                          {linkModalLoadingDept === dept ? '…' : 'Gerar link'}
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`font-mono text-[11px] font-medium ${saldo < 0 ? '' : ''}`} style={{ color: saldo < 0 ? cinema.danger : resolve.text }}>
                    {formatCurrency(saldo)}
                  </span>
                  {budget > 0 && (
                    <span className="text-[10px]" style={{ color: resolve.muted }} title={`Orçado: ${formatCurrency(budget)}`}>/ {formatCurrency(budget)}</span>
                  )}
                </div>
              </div>
              <table className="budget-table-cards w-full border-collapse text-[11px] min-w-[500px] table-fixed">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '40px' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '40px' }} />
                </colgroup>
                <thead>
                  <tr className="border-b" style={{ borderColor: resolve.border, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Data</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Fornecedor</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Descrição</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Tipo</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Valor</th>
                    <th className="text-left text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>NF</th>
                    <th className="text-center text-xs uppercase font-semibold py-1.5 px-2" style={{ color: resolve.text }}>Status</th>
                    <th className="budget-th-remove" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {expenses.filter((e) => e.department === dept).map((exp) => (
                    <tr key={exp.id} className="border-b" style={{ borderColor: resolve.border }}>
                      <td className="p-1.5">
                        <input type="date" className={`${inputClassName} input-date-yellow-calendar`} style={inputStyle} value={exp.date} onChange={(e) => updateExpense(exp.id, { date: e.target.value })} />
                      </td>
                      <td className="p-1.5"><input className={inputClassName} style={inputStyle} value={exp.supplier} onChange={(e) => updateExpense(exp.id, { supplier: e.target.value })} placeholder="Fornecedor" /></td>
                      <td className="p-1.5"><input className={inputClassName} style={inputStyle} value={exp.description} onChange={(e) => updateExpense(exp.id, { description: e.target.value })} placeholder="Descrição" /></td>
                      <td className="p-1.5">
                        <select className={inputClassName} style={inputStyle} value={exp.expenseType} onChange={(e) => updateExpense(exp.id, { expenseType: e.target.value })}>
                          {EXPENSE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <input
                          className={inputClassName}
                          style={inputStyle}
                          value={expenseValueDisplay(exp)}
                          onFocus={() => handleExpenseValueFocus(exp)}
                          onChange={(e) => handleExpenseValueChange(exp.id, e.target.value)}
                          onBlur={handleExpenseValueBlur}
                          placeholder="R$ 0,00"
                        />
                      </td>
                      <td className="p-1.5">
                        <DriveLinkButton projectId={projectDbId ?? null} drivePath={`_PRODUÇÃO/PRESTAÇÃO DE CONTAS/${exp.department}`} variant="folder" title="Abrir pasta da nota fiscal" className={`${iconBtnCls} w-7 h-7 flex items-center justify-center rounded border transition-colors`} style={{ borderColor: resolve.border, color: resolve.text }} disabled={isLocked}>
                          <FolderOpen size={16} strokeWidth={1.5} />
                        </DriveLinkButton>
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          className="text-[10px] font-medium uppercase px-2 py-1 rounded"
                          style={{ backgroundColor: exp.payStatus === 'pago' ? cinema.success : cinema.danger, color: '#fff' }}
                          onClick={() => updateExpense(exp.id, { payStatus: exp.payStatus === 'pago' ? 'pendente' : 'pago' })}
                        >
                          {exp.payStatus === 'pago' ? 'PAGO ✓' : 'A PAGAR'}
                        </button>
                      </td>
                      <td className="budget-row-remove align-middle">
                        <button type="button" onClick={() => removeExpense(exp.id)} className="btn-remove-row inline-flex items-center justify-center" aria-label="Remover"><X size={16} strokeWidth={2} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="btn-resolve-hover w-full mt-2 py-2.5 border border-dashed rounded text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                style={{ borderColor: resolve.border, color: resolve.muted, borderRadius: 3 }}
                onClick={() => addExpense(dept)}
              >
                <Plus size={14} strokeWidth={2} style={{ color: 'currentColor' }} className="shrink-0" aria-hidden /> Adicionar conta
              </button>
            </div>
            )
          })}
        </div>
      </div>

      {/* Modal: Selecionar responsáveis pela prestação de contas do departamento */}
      {expenseResponsibleModalDept !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setExpenseResponsibleModalDept(null)}>
          <div className="rounded border p-4 w-full max-w-md shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: resolve.text }}>Responsáveis — {expenseResponsibleModalDept}</h3>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: resolve.muted }}>Até 2 responsáveis (clique para adicionar)</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[expenseDepartmentConfig[expenseResponsibleModalDept]?.responsible1, expenseDepartmentConfig[expenseResponsibleModalDept]?.responsible2].filter(Boolean).map((name, idx) => (
                <span key={`${expenseResponsibleModalDept}-resp-${idx}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px]" style={{ borderColor: resolve.border, color: resolve.text }}>
                  {name}
                  {!isLocked && (
                    <button type="button" onClick={() => setExpenseDeptResponsible(expenseResponsibleModalDept, (idx + 1) as 1 | 2, undefined)} className="p-0.5 rounded hover:opacity-80" style={{ color: resolve.muted }} aria-label="Remover"><X size={12} strokeWidth={2} /></button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {expenseDeptResponsibleOptions[expenseResponsibleModalDept]?.map((opt, idx) => {
                const cur = expenseDepartmentConfig[expenseResponsibleModalDept]
                const already1 = cur?.responsible1 === opt
                const already2 = cur?.responsible2 === opt
                const canAdd = !cur?.responsible1 || !cur?.responsible2
                const disabled = (already1 && already2) || (!already1 && !already2 && !canAdd)
                return (
                  <button
                    key={`${expenseResponsibleModalDept}-opt-${idx}`}
                    type="button"
                    className="text-left text-[11px] py-1.5 px-2 rounded border transition-colors"
                    style={{
                      borderColor: resolve.border,
                      color: disabled ? resolve.muted : resolve.text,
                      backgroundColor: already1 || already2 ? 'rgba(92, 124, 153, 0.15)' : 'transparent',
                    }}
                    onClick={() => {
                      if (already1) setExpenseDeptResponsible(expenseResponsibleModalDept, 1, undefined)
                      else if (already2) setExpenseDeptResponsible(expenseResponsibleModalDept, 2, undefined)
                      else if (!cur?.responsible1) setExpenseDeptResponsible(expenseResponsibleModalDept, 1, opt)
                      else if (!cur?.responsible2) setExpenseDeptResponsible(expenseResponsibleModalDept, 2, opt)
                    }}
                  >
                    {opt} {already1 ? '(Responsável 1)' : already2 ? '(Responsável 2)' : ''}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setExpenseResponsibleModalDept(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ borderColor: resolve.border, color: resolve.text }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link da prestação de contas (departamento) */}
      {linkModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setLinkModal(null)}>
          <div className="rounded border p-4 w-full max-w-lg shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: resolve.text }}>Link para prestação de contas</h3>
            {'error' in linkModal ? (
              <p className="text-sm mb-4" style={{ color: cinema.danger }}>{linkModal.error}</p>
            ) : (
              <>
                <p className="text-[11px] mb-2" style={{ color: resolve.muted }}>Envie este link ao responsável pelo departamento <strong style={{ color: resolve.text }}>{linkModal.department}</strong>. Ele poderá preencher as despesas sem acessar o sistema.</p>
                <div className="flex gap-2 mb-4">
                  <input type="text" readOnly className="flex-1 py-1.5 px-2 text-[11px] rounded border truncate" style={{ ...inputStyle }} value={linkModal.url} />
                  <button
                    type="button"
                    className="btn-resolve-hover shrink-0 px-3 py-1.5 border text-[11px] font-medium uppercase rounded"
                    style={{ borderColor: resolve.border, color: resolve.text }}
                    onClick={() => {
                      setLinkCopied(false)
                      void navigator.clipboard.writeText(linkModal.url).then(() => {
                        setLinkCopied(true)
                        setTimeout(() => setLinkCopied(false), 2000)
                      }).catch(() => {})
                    }}
                  >
                    {linkCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => setLinkModal(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ borderColor: resolve.border, color: resolve.text }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Contato (telefone, e-mail, endereço) */}
      {modalContact !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalContact(null)}>
          <div className="rounded border p-4 w-full max-w-sm shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: resolve.text }}><span>ℹ</span> Contato</h3>
            {modalContact !== 'no-data' ? (
              <div className="space-y-0 text-sm">
                <CopyableLine label="Telefone" value={modalContact.telefone ?? ''} />
                <CopyableLine label="E-mail" value={modalContact.email ?? ''} />
                <CopyableLine label="Endereço" value={modalContact.endereco ?? ''} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: resolve.muted }}>Nenhum colaborador cadastrado com este nome.</p>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setModalContact(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ borderColor: resolve.border, color: resolve.text }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dados bancários e PIX */}
      {modalBank !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalBank(null)}>
          <div className="rounded border p-4 w-full max-w-sm shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: resolve.text }}><span>$</span> Dados bancários</h3>
            {modalBank !== 'no-data' ? (
              <div className="space-y-0 text-sm">
                <CopyableLine label="Banco" value={modalBank.banco ?? ''} />
                <CopyableLine label="Agência" value={modalBank.agencia ?? ''} />
                <CopyableLine label="Conta" value={modalBank.conta ?? ''} />
                <CopyableLine label="PIX" value={modalBank.pix ?? ''} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: resolve.muted }}>Nenhum colaborador cadastrado com este nome.</p>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setModalBank(null)} className="btn-resolve-hover h-8 px-3 border text-xs font-medium uppercase rounded" style={{ borderColor: resolve.border, color: resolve.text }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
})

export default ViewFechamento
