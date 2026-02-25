'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { resolve, cinema } from '@/lib/theme'

interface ProjectWithStatus {
  id: string
  job_id?: string
  nome: string
  status?: { initial?: string; final?: string; closing?: string }
}

interface ProjectsEvolutionChartProps {
  projects: ProjectWithStatus[]
}

/** Categoriza o projeto pela etapa mais avançada atingida */
function getProjectStage(status: ProjectWithStatus['status']): string {
  const s = status ?? {}
  if (s.closing === 'locked') return 'Fechamento concluído'
  if (s.final === 'locked') return 'Orç. realizado fechado'
  if (s.initial === 'locked') return 'Orç. previsto fechado'
  return 'Orçamento em aberto'
}

const STAGE_ORDER = [
  'Orçamento em aberto',
  'Orç. previsto fechado',
  'Orç. realizado fechado',
  'Fechamento concluído',
]

const STAGE_COLORS: Record<string, string> = {
  'Orçamento em aberto': resolve.muted,
  'Orç. previsto fechado': resolve.accent,
  'Orç. realizado fechado': resolve.purple,
  'Fechamento concluído': cinema.success,
}

function getStageOrderIndex(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage)
  return i >= 0 ? i : 0
}

function ChartContainer({
  children,
  className = '',
  height,
}: {
  children: React.ReactNode
  className?: string
  height: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = el.offsetWidth
      if (w > 0) setWidth((prev) => (prev === w ? prev : w))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}>
      {width > 0 && height > 0 ? (
        <ResponsiveContainer width={width} height={height}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}

export default function ProjectsEvolutionChart({ projects }: ProjectsEvolutionChartProps) {
  const counts = STAGE_ORDER.reduce(
    (acc, stage) => {
      acc[stage] = 0
      return acc
    },
    {} as Record<string, number>
  )

  const projectRows = projects
    .map((p) => {
      const stage = getProjectStage(p.status)
      counts[stage] = (counts[stage] ?? 0) + 1
      const displayName = p.job_id ? `${p.job_id} – ${p.nome}` : p.nome
      return {
        id: p.id,
        name: displayName,
        stage,
        value: 1,
        fill: STAGE_COLORS[stage] ?? resolve.muted,
      }
    })
    .sort((a, b) => {
      const orderDiff = getStageOrderIndex(a.stage) - getStageOrderIndex(b.stage)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })

  const total = projects.length
  const rowHeight = 28
  const chartHeight = Math.max(120, Math.min(400, projectRows.length * rowHeight + 24))

  return (
    <div
      className="rounded-lg overflow-hidden flex flex-col min-h-[200px]"
      style={{
        backgroundColor: resolve.panel,
        border: `1px solid ${resolve.border}`,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: resolve.border, backgroundColor: '#18181c' }}
      >
        <h4 className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: resolve.muted }}>
          Projetos
        </h4>
        <p className="text-[10px] mt-1" style={{ color: resolve.text }}>
          {total} {total === 1 ? 'projeto' : 'projetos'} — separado por projeto
        </p>
      </div>
      <div className="flex-1 p-4 min-h-[120px] overflow-auto">
        {total === 0 ? (
          <div
            className="flex items-center justify-center h-24 rounded"
            style={{ color: resolve.muted, fontSize: '0.8rem' }}
          >
            Nenhum projeto para exibir
          </div>
        ) : (
          <ChartContainer className="w-full" height={chartHeight}>
            <BarChart
              data={projectRows}
              layout="vertical"
              margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
            >
              <XAxis type="number" domain={[0, 1]} hide />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fill: resolve.text, fontSize: 10 }}
                axisLine={{ stroke: resolve.border }}
                tickLine={{ stroke: resolve.border }}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: resolve.panel,
                  border: `1px solid ${resolve.border}`,
                  borderRadius: 6,
                  color: resolve.text,
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0]?.payload as { name: string; stage: string } | undefined
                  if (!p) return null
                  return (
                    <div className="px-3 py-2 text-xs">
                      <div className="font-medium" style={{ color: resolve.yellow }}>{p.name}</div>
                      <div style={{ color: resolve.muted }}>{p.stage}</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="value" name="Etapa" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                {projectRows.map((entry, i) => (
                  <Cell key={entry.id} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </div>
      <div
        className="px-4 py-2 border-t flex flex-wrap gap-3"
        style={{ borderColor: resolve.border, backgroundColor: '#151518' }}
      >
        {STAGE_ORDER.map((stageName) => (
          <span key={stageName} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: STAGE_COLORS[stageName] }}
            />
            <span className="text-[10px]" style={{ color: resolve.muted }}>
              {stageName}: <strong style={{ color: resolve.text }}>{counts[stageName] ?? 0}</strong>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
