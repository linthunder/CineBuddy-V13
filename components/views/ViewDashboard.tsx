'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import PageLayout from '@/components/PageLayout'
import { DEPARTMENTS, LABOR_DEPTS, PEOPLE_DEPTS } from '@/lib/constants'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency } from '@/lib/utils'
import { computeRowTotal, computeVerbaRowTotal } from '@/lib/budgetUtils'
import type { BudgetLinesByPhase, VerbaLinesByPhase, MiniTablesData, ProjectStatus } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

/** Só renderiza o gráfico quando o container tem width/height > 0 para evitar aviso do Recharts (width/height 0). */
function ChartContainer({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (w > 0 && h > 0) setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={style}>
      {size.w > 0 && size.h > 0 ? (
        <ResponsiveContainer width={size.w} height={size.h}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
 * TYPES
 * ══════════════════════════════════════════════════════════ */
type StageId = 'initial' | 'final' | 'closing'

/** Uma diária de gravação (compatível com ViewFechamento) */
export interface DashboardDiariaEntry {
  dailyHours: number
  additionalPct: number
  overtimeHours: number
}

/** Shape esperada de uma linha do fechamento (subset do tipo interno de ViewFechamento) */
export interface DashboardClosingLine {
  department: string
  phase: string
  name: string
  role: string
  isLabor: boolean
  isVerba: boolean
  finalValue: number
  finalUnitCost: number
  /** dia | sem | flat: para HE, sem = unitCost/5 por dia */
  type?: string
  /** Novo formato: uma entrada por dia de gravação */
  diarias?: DashboardDiariaEntry[]
  /** @deprecated legado; usado se diarias não existir */
  dailyHours?: number
  additionalPct?: number
  overtimeHours?: number
  payStatus: 'pendente' | 'pago'
}

export interface DashboardExpense {
  name: string
  value: number
  payStatus: 'pendente' | 'pago'
}

export interface DashboardBudgetStage {
  budgetLines: BudgetLinesByPhase
  verbaLines: VerbaLinesByPhase
  miniTables: MiniTablesData
  jobValue: number
  taxRate: number
}

export interface DashboardClosingStage {
  closingLines: DashboardClosingLine[]
  expenses: DashboardExpense[]
  jobValue: number
}

export interface DashboardAllData {
  initial: DashboardBudgetStage | null
  final: DashboardBudgetStage | null
  closing: DashboardClosingStage | null
}

interface ViewDashboardProps {
  getData: () => DashboardAllData
  projectStatus: ProjectStatus
}

/* ── Dados processados ── */
interface DeptData {
  name: string
  laborCost: number
  materialCost: number
  verbaCost: number
  totalCost: number
  headcount: number
}

interface ProcessedData {
  totalCost: number
  jobValue: number
  taxRate: number
  taxValue: number
  profit: number
  margin: number
  departments: DeptData[]
  phases: { name: string; key: string; cost: number }[]
  topCosts: { name: string; department: string; cost: number }[]
  totalHeadcount: number
  extras: { contingencia: number; crt: number; bvagencia: number; expenseTotal: number }
  paidTotal: number
  pendingTotal: number
}

/* ══════════════════════════════════════════════════════════
 * CONSTANTS
 * ══════════════════════════════════════════════════════════ */
const STAGE_LABELS: Record<StageId, string> = {
  initial: 'Orçamento Inicial',
  final: 'Orçamento Final',
  closing: 'Fechamento',
}

const CHART_COLORS = [
  '#f5c518', '#5c7c99', '#6b5b95', '#2d8a5e', '#c94a4a',
  '#b8a035', '#6b8fad', '#8b7ab5', '#4a9d7c', '#d47a7a',
  '#e8e8ec', '#8e8e93',
]

const PHASE_COLORS: Record<string, string> = {
  pre: '#5c7c99',
  prod: '#f5c518',
  pos: '#6b5b95',
}

/* ══════════════════════════════════════════════════════════
 * PROCESSING FUNCTIONS
 * ══════════════════════════════════════════════════════════ */
function calcClosingOvertime(line: DashboardClosingLine): number {
  if (!line.isLabor) return 0
  const unitPerDay = line.type === 'sem' ? line.finalUnitCost / 5 : line.finalUnitCost
  if (line.diarias?.length) {
    let total = 0
    for (const d of line.diarias) {
      if (d.dailyHours <= 0) continue
      const hourlyRate = unitPerDay / d.dailyHours
      total += hourlyRate * (1 + d.additionalPct / 100) * d.overtimeHours
    }
    return total
  }
  const dailyHours = line.dailyHours ?? 8
  if (dailyHours <= 0) return 0
  const hourlyRate = unitPerDay / dailyHours
  const additionalRate = hourlyRate * ((line.additionalPct ?? 0) / 100)
  return (hourlyRate + additionalRate) * (line.overtimeHours ?? 0)
}

function processBudgetStage(data: DashboardBudgetStage): ProcessedData {
  const deptMap: Record<string, { labor: number; material: number; verba: number; headcount: number }> = {}
  const phaseMap: Record<string, number> = { pre: 0, prod: 0, pos: 0 }
  const allItems: { name: string; department: string; cost: number }[] = []
  let totalCost = 0

  for (const phase of ['pre', 'prod', 'pos'] as const) {
    const depts = DEPARTMENTS[phase]
    for (const dept of depts) {
      if (!deptMap[dept]) deptMap[dept] = { labor: 0, material: 0, verba: 0, headcount: 0 }
      const isLabor = LABOR_DEPTS.includes(dept as never)
      const rows = data.budgetLines[phase]?.[dept] ?? []

      for (const row of rows) {
        const cost = computeRowTotal(row)
        if (cost <= 0 && !row.itemName && !row.roleFunction) continue
        if (isLabor) {
          deptMap[dept].labor += cost
          if (row.itemName || row.roleFunction) deptMap[dept].headcount++
        } else if (dept === 'CASTING') {
          deptMap[dept].material += cost
          deptMap[dept].headcount += Math.max(0, ('quantity' in row ? row.quantity : 0) || 0) || 1
        } else if (PEOPLE_DEPTS.includes(dept as never) && row.type === 'people') {
          deptMap[dept].material += cost
          deptMap[dept].headcount++
        } else {
          deptMap[dept].material += cost
        }
        phaseMap[phase] += cost
        totalCost += cost
        if (cost > 0) allItems.push({ name: row.itemName || row.roleFunction || dept, department: dept, cost })
      }

      const verbaRows = data.verbaLines[phase]?.[dept] ?? []
      for (const v of verbaRows) {
        const cost = computeVerbaRowTotal(v)
        if (cost <= 0) continue
        deptMap[dept].verba += cost
        phaseMap[phase] += cost
        totalCost += cost
        if (cost > 0) allItems.push({ name: v.itemName || 'Verba', department: dept, cost })
      }
    }
  }

  const extras = data.miniTables.contingencia + data.miniTables.crt + data.miniTables.bvagencia
  totalCost += extras

  const taxValue = data.jobValue * (data.taxRate / 100)
  const profit = data.jobValue - totalCost - taxValue
  const margin = data.jobValue > 0 ? (profit / data.jobValue) * 100 : 0
  const totalHeadcount = Object.values(deptMap).reduce((s, d) => s + d.headcount, 0)

  allItems.sort((a, b) => b.cost - a.cost)

  const departments = Object.entries(deptMap)
    .map(([name, d]) => ({ name, laborCost: d.labor, materialCost: d.material, verbaCost: d.verba, totalCost: d.labor + d.material + d.verba, headcount: d.headcount }))
    .filter(d => d.totalCost > 0 || d.headcount > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  return {
    totalCost, jobValue: data.jobValue, taxRate: data.taxRate, taxValue, profit, margin,
    departments,
    phases: [
      { name: 'Pré-produção', key: 'pre', cost: phaseMap.pre },
      { name: 'Produção', key: 'prod', cost: phaseMap.prod },
      { name: 'Pós-produção', key: 'pos', cost: phaseMap.pos },
    ],
    topCosts: allItems.slice(0, 10),
    totalHeadcount,
    extras: { ...data.miniTables, expenseTotal: 0 },
    paidTotal: 0,
    pendingTotal: 0,
  }
}

function processClosingStage(data: DashboardClosingStage): ProcessedData {
  const deptMap: Record<string, { labor: number; material: number; verba: number; headcount: number }> = {}
  const phaseMap: Record<string, number> = { pre: 0, prod: 0, pos: 0 }
  const allItems: { name: string; department: string; cost: number }[] = []
  let totalCost = 0
  let paidTotal = 0
  let pendingTotal = 0

  for (const line of data.closingLines) {
    const overtime = calcClosingOvertime(line)
    const cost = line.finalValue + overtime
    if (!deptMap[line.department]) deptMap[line.department] = { labor: 0, material: 0, verba: 0, headcount: 0 }

    if (line.isLabor) {
      deptMap[line.department].labor += cost
      if (line.name || line.role) deptMap[line.department].headcount++
    } else if (line.isVerba) {
      deptMap[line.department].verba += cost
    } else {
      deptMap[line.department].material += cost
    }

    if (line.phase in phaseMap) phaseMap[line.phase] += cost
    totalCost += cost
    if (cost > 0) allItems.push({ name: line.name || line.role || line.department, department: line.department, cost })

    if (line.payStatus === 'pago') paidTotal += cost
    else pendingTotal += cost
  }

  const expenseTotal = data.expenses.reduce((s, e) => s + e.value, 0)
  totalCost += expenseTotal
  for (const exp of data.expenses) {
    if (exp.payStatus === 'pago') paidTotal += exp.value
    else pendingTotal += exp.value
    if (exp.value > 0) allItems.push({ name: exp.name || 'Despesa', department: 'PRESTAÇÃO DE CONTAS', cost: exp.value })
  }

  const profit = data.jobValue - totalCost
  const margin = data.jobValue > 0 ? (profit / data.jobValue) * 100 : 0
  const totalHeadcount = Object.values(deptMap).reduce((s, d) => s + d.headcount, 0)

  allItems.sort((a, b) => b.cost - a.cost)

  const departments = Object.entries(deptMap)
    .map(([name, d]) => ({ name, laborCost: d.labor, materialCost: d.material, verbaCost: d.verba, totalCost: d.labor + d.material + d.verba, headcount: d.headcount }))
    .filter(d => d.totalCost > 0 || d.headcount > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  return {
    totalCost, jobValue: data.jobValue, taxRate: 0, taxValue: 0, profit, margin,
    departments,
    phases: [
      { name: 'Pré-produção', key: 'pre', cost: phaseMap.pre },
      { name: 'Produção', key: 'prod', cost: phaseMap.prod },
      { name: 'Pós-produção', key: 'pos', cost: phaseMap.pos },
    ],
    topCosts: allItems.slice(0, 10),
    totalHeadcount,
    extras: { contingencia: 0, crt: 0, bvagencia: 0, expenseTotal },
    paidTotal,
    pendingTotal,
  }
}

function processStage(stageId: StageId, allData: DashboardAllData): ProcessedData | null {
  if (stageId === 'initial' && allData.initial) return processBudgetStage(allData.initial)
  if (stageId === 'final' && allData.final) return processBudgetStage(allData.final)
  if (stageId === 'closing' && allData.closing) return processClosingStage(allData.closing)
  return null
}

/* ══════════════════════════════════════════════════════════
 * SUB-COMPONENTS
 * ══════════════════════════════════════════════════════════ */

/* ── KPI Card ── */
function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="p-3 rounded border flex flex-col items-center justify-center text-center" style={{ backgroundColor: resolve.panel, borderColor: resolve.border, borderRadius: 3 }}>
      <span className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: resolve.muted }}>{label}</span>
      <span className="text-base sm:text-lg font-semibold font-mono" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] mt-0.5" style={{ color: resolve.muted }}>{sub}</span>}
    </div>
  )
}

/* ── Section Card ── */
function SectionCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded border overflow-hidden ${className}`} style={{ borderColor: resolve.border, borderRadius: 3 }}>
      <div className="px-4 py-2 border-b" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
        <h3 className="text-[11px] font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>{title}</h3>
      </div>
      <div className="p-4" style={{ backgroundColor: resolve.panel }}>
        {children}
      </div>
    </div>
  )
}

/* ── Custom Tooltip (recharts) ── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border p-2 text-xs shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
      {label && <p className="mb-1 font-medium" style={{ color: resolve.text }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  )
}

/* ── Horizontal bar item (CSS) ── */
function HBarItem({ label, value, pct, color, secondaryLabel }: { label: string; value: string; pct: number; color: string; secondaryLabel?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="w-28 sm:w-36 text-right text-[11px] truncate flex-shrink-0" style={{ color: resolve.text }}>{label}</span>
      <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ backgroundColor: resolve.bg }}>
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: color, minWidth: pct > 0 ? 4 : 0 }}
        />
      </div>
      <span className="w-24 text-right text-[11px] font-mono flex-shrink-0" style={{ color: resolve.text }}>{value}</span>
      {secondaryLabel && <span className="w-8 text-right text-[10px] flex-shrink-0" style={{ color: resolve.muted }}>{secondaryLabel}</span>}
    </div>
  )
}

/* ── Stage Selector ── */
function StageSelector({ value, onChange, availableStages, label }: {
  value: StageId; onChange: (v: StageId) => void; availableStages: { id: StageId; available: boolean }[]; label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: resolve.muted }}>{label}</span>}
      <select
        className="px-3 py-1.5 rounded border text-sm font-medium"
        style={{ backgroundColor: resolve.bg, borderColor: resolve.border, color: resolve.text }}
        value={value}
        onChange={(e) => onChange(e.target.value as StageId)}
      >
        {availableStages.map((s) => (
          <option key={s.id} value={s.id} disabled={!s.available}>
            {STAGE_LABELS[s.id]}{!s.available ? ' (indisponível)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
 * INDIVIDUAL ANALYSIS
 * ══════════════════════════════════════════════════════════ */
function IndividualAnalysis({ data, stageLabel }: { data: ProcessedData; stageLabel: string }) {
  const maxDeptCost = Math.max(...data.departments.map(d => d.totalCost), 1)
  const maxHeadcount = Math.max(...data.departments.map(d => d.headcount), 1)
  const totalPhaseCost = data.phases.reduce((s, p) => s + p.cost, 0)

  // Donut chart data
  const donutData = data.phases.filter(p => p.cost > 0).map(p => ({
    name: p.name,
    value: p.cost,
    color: PHASE_COLORS[p.key] || resolve.muted,
  }))

  // Departamento com equipe
  const deptsWithHeadcount = data.departments.filter(d => d.headcount > 0).sort((a, b) => b.headcount - a.headcount)

  // Destaques
  const topDept = data.departments[0]
  const topHeadcountDept = deptsWithHeadcount[0]
  const equipCost = data.departments.find(d => d.name === 'EQUIPAMENTOS')?.totalCost ?? 0
  const castingCost = data.departments.find(d => d.name === 'CASTING')?.totalCost ?? 0
  const cateringCost = data.departments.find(d => d.name === 'CATERING')?.totalCost ?? 0
  const locationCost = data.departments.find(d => d.name === 'LOCAÇÕES')?.totalCost ?? 0
  const transportCost = data.departments.find(d => d.name === 'TRANSPORTE')?.totalCost ?? 0

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <KpiCard label="Valor Job" value={formatCurrency(data.jobValue)} color={resolve.text} />
        <KpiCard label="Custo Total" value={formatCurrency(data.totalCost)} color={resolve.yellow} />
        <KpiCard label="Lucro Líquido" value={formatCurrency(data.profit)} color={data.profit >= 0 ? cinema.success : cinema.danger} />
        <KpiCard label="Margem" value={`${data.margin.toFixed(1)}%`} color={data.margin >= 20 ? cinema.success : data.margin >= 10 ? resolve.accent : cinema.danger} />
        <KpiCard label="Equipe Total" value={`${data.totalHeadcount}`} color={resolve.accent} sub={`${deptsWithHeadcount.length} departamentos`} />
      </div>

      {/* ── Custo por Departamento (barra horizontal) ── */}
      <SectionCard title={`Custo por Departamento — ${stageLabel}`}>
        {data.departments.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: resolve.muted }}>Nenhum dado disponível.</p>
        ) : (
          <div>
            {data.departments.map((d, i) => (
              <HBarItem
                key={`dept-cost-${i}`}
                label={d.name}
                value={formatCurrency(d.totalCost)}
                pct={(d.totalCost / maxDeptCost) * 100}
                color={CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Grid: Distribuição por Fase + Equipe por Departamento ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut chart - Distribuição por fase */}
        <SectionCard title="Distribuição por Fase">
          {totalPhaseCost <= 0 ? (
            <p className="text-xs text-center py-4" style={{ color: resolve.muted }}>Nenhum dado disponível.</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ChartContainer className="w-full min-w-0" style={{ height: 220, minHeight: 220 }}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      stroke={resolve.panel}
                      strokeWidth={2}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(value: string) => <span style={{ color: resolve.text, fontSize: 11 }}>{value}</span>}
                      iconSize={10}
                    />
                  </PieChart>
                </ChartContainer>
              <div className="w-full space-y-1.5">
                {data.phases.map((p) => {
                  const pct = totalPhaseCost > 0 ? (p.cost / totalPhaseCost) * 100 : 0
                  return (
                    <div key={p.key} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PHASE_COLORS[p.key] }} />
                        <span style={{ color: resolve.text }}>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono" style={{ color: resolve.text }}>{formatCurrency(p.cost)}</span>
                        <span style={{ color: resolve.muted }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Equipe por departamento */}
        <SectionCard title="Equipe por Departamento">
          {deptsWithHeadcount.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: resolve.muted }}>Nenhuma equipe registrada.</p>
          ) : (
            <div>
              {deptsWithHeadcount.map((d, i) => (
                <HBarItem
                  key={`dept-hc-${i}`}
                  label={d.name}
                  value={`${d.headcount}`}
                  pct={(d.headcount / maxHeadcount) * 100}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                  secondaryLabel="pess."
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Grid: Top Custos + Destaques ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 maiores custos */}
        <SectionCard title="Top 10 — Maiores Custos Individuais">
          {data.topCosts.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: resolve.muted }}>Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-1">
              {data.topCosts.map((item, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b" style={{ borderColor: i < data.topCosts.length - 1 ? resolve.border : 'transparent' }}>
                  <span className="w-5 text-center text-[10px] font-bold" style={{ color: resolve.muted }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block" style={{ color: resolve.text }}>{item.name}</span>
                    <span className="text-[10px]" style={{ color: resolve.muted }}>{item.department}</span>
                  </div>
                  <span className="font-mono text-xs font-medium flex-shrink-0" style={{ color: resolve.yellow }}>{formatCurrency(item.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Destaques da produção */}
        <SectionCard title="Destaques da Produção">
          <div className="space-y-2.5">
            {topDept && (
              <HighlightRow icon="📊" label="Departamento mais caro" value={topDept.name} sub={formatCurrency(topDept.totalCost)} />
            )}
            {topHeadcountDept && (
              <HighlightRow icon="👥" label="Maior equipe" value={topHeadcountDept.name} sub={`${topHeadcountDept.headcount} pessoas`} />
            )}
            {equipCost > 0 && <HighlightRow icon="🎥" label="Equipamentos" value={formatCurrency(equipCost)} />}
            {castingCost > 0 && <HighlightRow icon="🎭" label="Casting" value={formatCurrency(castingCost)} />}
            {cateringCost > 0 && <HighlightRow icon="🍿" label="Catering" value={formatCurrency(cateringCost)} />}
            {locationCost > 0 && <HighlightRow icon="📍" label="Locações" value={formatCurrency(locationCost)} />}
            {transportCost > 0 && <HighlightRow icon="🚛" label="Transporte" value={formatCurrency(transportCost)} />}
            {data.extras.contingencia > 0 && <HighlightRow icon="📑" label="Contingência" value={formatCurrency(data.extras.contingencia)} />}
            {data.extras.crt > 0 && <HighlightRow icon="📑" label="CRT" value={formatCurrency(data.extras.crt)} />}
            {data.extras.bvagencia > 0 && <HighlightRow icon="📑" label="BV Agência" value={formatCurrency(data.extras.bvagencia)} />}
            {data.extras.expenseTotal > 0 && <HighlightRow icon="💳" label="Prestação de Contas" value={formatCurrency(data.extras.expenseTotal)} />}
            {data.paidTotal > 0 && <HighlightRow icon="✅" label="Total Pago" value={formatCurrency(data.paidTotal)} color={cinema.success} />}
            {data.pendingTotal > 0 && <HighlightRow icon="⏳" label="Total Pendente" value={formatCurrency(data.pendingTotal)} color={cinema.danger} />}
            {data.taxValue > 0 && <HighlightRow icon="🏛️" label={`Impostos (${data.taxRate}%)`} value={formatCurrency(data.taxValue)} />}
          </div>
        </SectionCard>
      </div>

      {/* ── Composição por departamento: Equipe vs Materiais vs Verbas (recharts stacked bar) ── */}
      {data.departments.length > 0 && (
        <SectionCard title="Composição do Custo por Departamento — Equipe vs Materiais vs Verbas">
          <ChartContainer className="min-w-0" style={{ height: Math.max(data.departments.length * 36, 200), minHeight: 200 }}>
              <BarChart data={data.departments} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fill: resolve.muted, fontSize: 10 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  axisLine={{ stroke: resolve.border }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: resolve.text, fontSize: 10 }}
                  width={130}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CompositionTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="laborCost" name="Equipe" stackId="stack" fill={resolve.accent} radius={[0, 0, 0, 0]} />
                <Bar dataKey="materialCost" name="Materiais" stackId="stack" fill={resolve.yellow} radius={[0, 0, 0, 0]} />
                <Bar dataKey="verbaCost" name="Verbas" stackId="stack" fill={resolve.purple} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ChartContainer>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px]">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: resolve.accent }} /><span style={{ color: resolve.text }}>Equipe</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: resolve.yellow }} /><span style={{ color: resolve.text }}>Materiais</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: resolve.purple }} /><span style={{ color: resolve.text }}>Verbas</span></div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

/* ── Highlight row (destaques) ── */
function HighlightRow({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b" style={{ borderColor: resolve.border }}>
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] uppercase tracking-wide" style={{ color: resolve.muted }}>{label}</span>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-xs font-semibold font-mono" style={{ color: color || resolve.text }}>{value}</span>
        {sub && <span className="block text-[10px]" style={{ color: resolve.muted }}>{sub}</span>}
      </div>
    </div>
  )
}

/* ── Composition tooltip ── */
function CompositionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded border p-2 text-xs shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
      <p className="mb-1 font-medium" style={{ color: resolve.text }}>{label}</p>
      {payload.map((p, i) => p.value > 0 && (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {formatCurrency(p.value)}</p>
      ))}
      <p className="mt-1 pt-1 border-t font-medium font-mono" style={{ borderColor: resolve.border, color: resolve.text }}>Total: {formatCurrency(total)}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
 * COMPARISON ANALYSIS
 * ══════════════════════════════════════════════════════════ */
function ComparisonAnalysis({ leftData, rightData, leftLabel, rightLabel }: {
  leftData: ProcessedData; rightData: ProcessedData; leftLabel: string; rightLabel: string
}) {
  const costDiff = rightData.totalCost - leftData.totalCost
  const costDiffPct = leftData.totalCost > 0 ? (costDiff / leftData.totalCost) * 100 : 0
  const profitDiff = rightData.profit - leftData.profit
  const profitDiffPct = leftData.profit !== 0 ? (profitDiff / Math.abs(leftData.profit)) * 100 : 0

  // Merge departments for comparison
  const allDeptNames = new Set([...leftData.departments.map(d => d.name), ...rightData.departments.map(d => d.name)])
  const comparisonDepts = Array.from(allDeptNames).map(name => {
    const left = leftData.departments.find(d => d.name === name)
    const right = rightData.departments.find(d => d.name === name)
    return {
      name,
      leftCost: left?.totalCost ?? 0,
      rightCost: right?.totalCost ?? 0,
      diff: (right?.totalCost ?? 0) - (left?.totalCost ?? 0),
      leftHeadcount: left?.headcount ?? 0,
      rightHeadcount: right?.headcount ?? 0,
    }
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  const maxCostInComparison = Math.max(...comparisonDepts.map(d => Math.max(d.leftCost, d.rightCost)), 1)

  // Recharts data for grouped bar chart
  const barChartData = comparisonDepts.filter(d => d.leftCost > 0 || d.rightCost > 0).map(d => ({
    name: d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name,
    fullName: d.name,
    [leftLabel]: d.leftCost,
    [rightLabel]: d.rightCost,
  }))

  return (
    <div className="space-y-4">
      {/* ── Resumo comparativo ── */}
      <div className="rounded border overflow-hidden" style={{ borderColor: resolve.purple, borderRadius: 3 }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
          {/* Left stage */}
          <div className="p-4 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center text-center" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
            <span className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: resolve.muted }}>{leftLabel}</span>
            <span className="text-lg font-semibold font-mono" style={{ color: leftData.profit >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(leftData.profit)}</span>
            <span className="text-[10px] mt-0.5" style={{ color: resolve.muted }}>Custo: {formatCurrency(leftData.totalCost)}</span>
          </div>
          {/* Difference — Lucro */}
          <div className="p-4 border-b sm:border-b-0 sm:border-r flex flex-col items-center justify-center text-center" style={{ borderColor: resolve.border, backgroundColor: 'rgba(26,26,30,0.8)' }}>
            <span className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: resolve.muted }}>Diferença de Lucro</span>
            <span className="text-lg font-bold font-mono" style={{ color: profitDiff >= 0 ? cinema.success : cinema.danger }}>
              {profitDiff >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(profitDiff))}
            </span>
            <span className="text-[10px] mt-0.5 font-medium" style={{ color: profitDiff >= 0 ? cinema.success : cinema.danger }}>
              {profitDiff >= 0 ? 'Lucro maior' : 'Lucro menor'} {Math.abs(profitDiffPct).toFixed(1)}%
            </span>
            {costDiff !== 0 && (
              <span className="text-[10px] mt-1" style={{ color: resolve.muted }}>
                Custo {costDiff > 0 ? '+' : ''}{formatCurrency(costDiff)} ({costDiff <= 0 ? 'economizou' : 'a mais'})
              </span>
            )}
          </div>
          {/* Right stage */}
          <div className="p-4 flex flex-col items-center justify-center text-center" style={{ backgroundColor: resolve.panel }}>
            <span className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: resolve.muted }}>{rightLabel}</span>
            <span className="text-lg font-semibold font-mono" style={{ color: rightData.profit >= 0 ? cinema.success : cinema.danger }}>{formatCurrency(rightData.profit)}</span>
            <span className="text-[10px] mt-0.5" style={{ color: resolve.muted }}>Custo: {formatCurrency(rightData.totalCost)}</span>
          </div>
        </div>
      </div>

      {/* ── KPIs lado a lado ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard label={`Equipe — ${leftLabel.split(' ').pop()}`} value={`${leftData.totalHeadcount}`} color={resolve.accent} />
        <KpiCard label={`Equipe — ${rightLabel.split(' ').pop()}`} value={`${rightData.totalHeadcount}`} color={resolve.yellow} />
        <KpiCard label={`Margem — ${leftLabel.split(' ').pop()}`} value={`${leftData.margin.toFixed(1)}%`} color={leftData.margin >= 20 ? cinema.success : cinema.danger} />
        <KpiCard label={`Margem — ${rightLabel.split(' ').pop()}`} value={`${rightData.margin.toFixed(1)}%`} color={rightData.margin >= 20 ? cinema.success : cinema.danger} />
      </div>

      {/* ── Gráfico comparativo de barras agrupadas ── */}
      {barChartData.length > 0 && (
        <SectionCard title={`Comparativo por Departamento — ${leftLabel} vs ${rightLabel}`}>
          <ChartContainer className="min-w-0" style={{ height: Math.max(barChartData.length * 48, 200), minHeight: 200 }}>
              <BarChart data={barChartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fill: resolve.muted, fontSize: 10 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  axisLine={{ stroke: resolve.border }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: resolve.text, fontSize: 10 }}
                  width={130}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ComparisonTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey={leftLabel} fill={resolve.accent} radius={[0, 2, 2, 0]} barSize={14} />
                <Bar dataKey={rightLabel} fill={resolve.yellow} radius={[0, 2, 2, 0]} barSize={14} />
              </BarChart>
            </ChartContainer>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px]">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: resolve.accent }} /><span style={{ color: resolve.text }}>{leftLabel}</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: resolve.yellow }} /><span style={{ color: resolve.text }}>{rightLabel}</span></div>
          </div>
        </SectionCard>
      )}

      {/* ── Tabela de diferenças detalhada ── */}
      <SectionCard title="Diferenças Detalhadas por Departamento">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full border-collapse text-xs min-w-[500px]">
            <thead>
              <tr className="border-b" style={{ borderColor: resolve.border }}>
                <th className="text-left py-2 px-2 font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>Departamento</th>
                <th className="text-right py-2 px-2 font-medium uppercase tracking-wider" style={{ color: resolve.accent }}>{leftLabel}</th>
                <th className="text-right py-2 px-2 font-medium uppercase tracking-wider" style={{ color: resolve.yellow }}>{rightLabel}</th>
                <th className="text-right py-2 px-2 font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>Diferença</th>
                <th className="text-center py-2 px-2 font-medium uppercase tracking-wider" style={{ color: resolve.muted }}>Pessoas</th>
              </tr>
            </thead>
            <tbody>
              {comparisonDepts.filter(d => d.leftCost > 0 || d.rightCost > 0).map((d, i) => (
                <tr key={`comp-${i}`} className="border-b" style={{ borderColor: resolve.border }}>
                  <td className="py-2 px-2 font-medium" style={{ color: resolve.text }}>{d.name}</td>
                  <td className="py-2 px-2 text-right font-mono" style={{ color: resolve.accent }}>{formatCurrency(d.leftCost)}</td>
                  <td className="py-2 px-2 text-right font-mono" style={{ color: resolve.yellow }}>{formatCurrency(d.rightCost)}</td>
                  <td className="py-2 px-2 text-right font-mono font-medium" style={{ color: d.diff <= 0 ? cinema.success : cinema.danger }}>
                    {d.diff <= 0 ? '↓' : '↑'} {formatCurrency(Math.abs(d.diff))}
                  </td>
                  <td className="py-2 px-2 text-center" style={{ color: resolve.muted }}>
                    {d.leftHeadcount > 0 || d.rightHeadcount > 0 ? `${d.leftHeadcount} → ${d.rightHeadcount}` : '—'}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <td className="py-2.5 px-2 font-bold uppercase" style={{ color: resolve.text }}>Total</td>
                <td className="py-2.5 px-2 text-right font-mono font-bold" style={{ color: resolve.accent }}>{formatCurrency(leftData.totalCost)}</td>
                <td className="py-2.5 px-2 text-right font-mono font-bold" style={{ color: resolve.yellow }}>{formatCurrency(rightData.totalCost)}</td>
                <td className="py-2.5 px-2 text-right font-mono font-bold" style={{ color: costDiff <= 0 ? cinema.success : cinema.danger }}>
                  {costDiff <= 0 ? '↓' : '↑'} {formatCurrency(Math.abs(costDiff))}
                </td>
                <td className="py-2.5 px-2 text-center font-medium" style={{ color: resolve.muted }}>
                  {leftData.totalHeadcount} → {rightData.totalHeadcount}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Fases lado a lado ── */}
      <SectionCard title="Distribuição por Fase — Comparativo">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider font-medium mb-2 text-center" style={{ color: resolve.accent }}>{leftLabel}</h4>
            {leftData.phases.map((p) => {
              const total = leftData.phases.reduce((s, ph) => s + ph.cost, 0)
              const pct = total > 0 ? (p.cost / total) * 100 : 0
              return (
                <div key={p.key} className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: PHASE_COLORS[p.key] }} />
                  <span className="text-[11px] flex-1" style={{ color: resolve.text }}>{p.name}</span>
                  <span className="font-mono text-[11px]" style={{ color: resolve.text }}>{formatCurrency(p.cost)}</span>
                  <span className="text-[10px] w-10 text-right" style={{ color: resolve.muted }}>{pct.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
          {/* Right */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider font-medium mb-2 text-center" style={{ color: resolve.yellow }}>{rightLabel}</h4>
            {rightData.phases.map((p) => {
              const total = rightData.phases.reduce((s, ph) => s + ph.cost, 0)
              const pct = total > 0 ? (p.cost / total) * 100 : 0
              return (
                <div key={p.key} className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: PHASE_COLORS[p.key] }} />
                  <span className="text-[11px] flex-1" style={{ color: resolve.text }}>{p.name}</span>
                  <span className="font-mono text-[11px]" style={{ color: resolve.text }}>{formatCurrency(p.cost)}</span>
                  <span className="text-[10px] w-10 text-right" style={{ color: resolve.muted }}>{pct.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

/* ── Comparison Tooltip ── */
function ComparisonTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  // Retrieve full name from data
  const fullName = (payload[0] as unknown as { payload?: { fullName?: string } })?.payload?.fullName ?? label
  const diff = (payload[1]?.value ?? 0) - (payload[0]?.value ?? 0)
  return (
    <div className="rounded border p-2 text-xs shadow-lg" style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}>
      <p className="mb-1 font-medium" style={{ color: resolve.text }}>{fullName}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {formatCurrency(p.value)}</p>
      ))}
      <p className="mt-1 pt-1 border-t font-mono" style={{ borderColor: resolve.border, color: diff <= 0 ? cinema.success : cinema.danger }}>
        Dif: {diff <= 0 ? '↓' : '↑'} {formatCurrency(Math.abs(diff))}
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ══════════════════════════════════════════════════════════ */
export default function ViewDashboard({ getData, projectStatus }: ViewDashboardProps) {
  const [mode, setMode] = useState<'individual' | 'comparison'>('individual')
  const [selectedStage, setSelectedStage] = useState<StageId>('initial')
  const [leftStage, setLeftStage] = useState<StageId>('initial')
  const [rightStage, setRightStage] = useState<StageId>('final')
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch data from refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawData = useMemo(() => getData(), [getData, refreshKey])

  // Available stages
  const availableStages = useMemo(() => [
    { id: 'initial' as StageId, available: !!rawData.initial },
    { id: 'final' as StageId, available: !!rawData.final && projectStatus.initial === 'locked' },
    { id: 'closing' as StageId, available: !!rawData.closing && projectStatus.final === 'locked' },
  ], [rawData, projectStatus])

  // Process data
  const individualData = useMemo(() => processStage(selectedStage, rawData), [rawData, selectedStage])
  const leftData = useMemo(() => processStage(leftStage, rawData), [rawData, leftStage])
  const rightData = useMemo(() => processStage(rightStage, rawData), [rawData, rightStage])

  const hasAnyData = availableStages.some(s => s.available)

  // Empty state
  if (!hasAnyData) {
    return (
      <PageLayout title="Dashboard">
        <div className="rounded border p-8 text-center" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <p className="text-sm mb-1" style={{ color: resolve.muted }}>Nenhum dado disponível para exibir.</p>
          <p className="text-xs" style={{ color: resolve.muted }}>Preencha o Orçamento Inicial e finalize-o para visualizar o dashboard.</p>
        </div>
      </PageLayout>
    )
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-xs font-medium uppercase tracking-wider rounded-t border-b-2 transition-colors cursor-pointer ${active ? '' : 'hover:opacity-80'}`

  return (
    <PageLayout title="Dashboard">
      {/* ── Mode tabs + refresh ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0.5">
          <button
            type="button"
            className={tabCls(mode === 'individual')}
            style={{
              backgroundColor: mode === 'individual' ? resolve.panel : 'transparent',
              borderColor: mode === 'individual' ? resolve.yellow : 'transparent',
              color: mode === 'individual' ? resolve.yellow : resolve.muted,
            }}
            onClick={() => setMode('individual')}
          >
            Análise Individual
          </button>
          <button
            type="button"
            className={tabCls(mode === 'comparison')}
            style={{
              backgroundColor: mode === 'comparison' ? resolve.panel : 'transparent',
              borderColor: mode === 'comparison' ? resolve.purple : 'transparent',
              color: mode === 'comparison' ? resolve.purpleLight : resolve.muted,
            }}
            onClick={() => setMode('comparison')}
          >
            Comparativo
          </button>
        </div>
        <button
          type="button"
          className="btn-resolve-hover flex items-center gap-1.5 px-3 py-1.5 border rounded text-[11px] font-medium uppercase tracking-wider"
          style={{ borderColor: resolve.border, color: resolve.muted, borderRadius: 3 }}
          onClick={() => setRefreshKey(k => k + 1)}
        >
          ↻ Atualizar
        </button>
      </div>

      {/* ══════════ INDIVIDUAL MODE ══════════ */}
      {mode === 'individual' && (
        <div>
          {/* Stage selector */}
          <div className="mb-4">
            <StageSelector
              value={selectedStage}
              onChange={setSelectedStage}
              availableStages={availableStages}
              label="Analisar:"
            />
          </div>

          {individualData ? (
            <IndividualAnalysis data={individualData} stageLabel={STAGE_LABELS[selectedStage]} />
          ) : (
            <div className="rounded border p-8 text-center" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
              <p className="text-sm" style={{ color: resolve.muted }}>
                Dados de <strong>{STAGE_LABELS[selectedStage]}</strong> não disponíveis.
                {selectedStage === 'final' && ' Finalize o Orçamento Inicial primeiro.'}
                {selectedStage === 'closing' && ' Finalize o Orçamento Final primeiro.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ COMPARISON MODE ══════════ */}
      {mode === 'comparison' && (
        <div>
          {/* Stage selectors */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <StageSelector value={leftStage} onChange={setLeftStage} availableStages={availableStages} label="Coluna A:" />
            <span className="text-sm font-bold" style={{ color: resolve.muted }}>VS</span>
            <StageSelector value={rightStage} onChange={setRightStage} availableStages={availableStages} label="Coluna B:" />
          </div>

          {leftData && rightData ? (
            <ComparisonAnalysis
              leftData={leftData}
              rightData={rightData}
              leftLabel={STAGE_LABELS[leftStage]}
              rightLabel={STAGE_LABELS[rightStage]}
            />
          ) : (
            <div className="rounded border p-8 text-center" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
              <p className="text-sm" style={{ color: resolve.muted }}>
                Selecione duas fases disponíveis para comparar.
                {!leftData && <span className="block mt-1">⚠ {STAGE_LABELS[leftStage]} não disponível.</span>}
                {!rightData && <span className="block mt-1">⚠ {STAGE_LABELS[rightStage]} não disponível.</span>}
              </p>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}
