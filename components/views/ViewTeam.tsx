'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import PageLayout from '@/components/PageLayout'
import { resolve, cinema } from '@/lib/theme'
import { formatCurrency } from '@/lib/utils'
import type { BudgetLinesByPhase, VerbaLinesByPhase, BudgetRow } from '@/lib/types'

interface TeamMember {
  name: string
  role: string
  totalCost: number
}

interface DeptTeam {
  department: string
  members: TeamMember[]
  deptTotal: number
}

export interface ViewTeamProps {
  getBudgetData: () => {
    budgetLines: BudgetLinesByPhase
    verbaLines: VerbaLinesByPhase
  } | null
}

function extractTeamByDept(budgetLines: BudgetLinesByPhase): DeptTeam[] {
  // Agrupa profissionais por departamento → nome+função → soma totalCost
  const deptMap = new Map<string, Map<string, TeamMember>>()

  for (const phase of ['pre', 'prod', 'pos'] as const) {
    const depts = budgetLines[phase]
    if (!depts) continue
    for (const [dept, rows] of Object.entries(depts)) {
      for (const row of rows as BudgetRow[]) {
        if (row.type !== 'labor') continue
        if (!row.itemName?.trim()) continue

        if (!deptMap.has(dept)) deptMap.set(dept, new Map())
        const membersMap = deptMap.get(dept)!
        const key = `${row.itemName.trim().toLowerCase()}__${row.roleFunction?.trim().toLowerCase() ?? ''}`
        const existing = membersMap.get(key)
        if (existing) {
          existing.totalCost += row.totalCost ?? 0
        } else {
          membersMap.set(key, {
            name: row.itemName.trim(),
            role: row.roleFunction?.trim() ?? '',
            totalCost: row.totalCost ?? 0,
          })
        }
      }
    }
  }

  // Converter Map para array, ordenar por departamento
  const result: DeptTeam[] = []
  for (const [dept, membersMap] of deptMap) {
    const members = Array.from(membersMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const deptTotal = members.reduce((sum, m) => sum + m.totalCost, 0)
    if (members.length > 0) {
      result.push({ department: dept, members, deptTotal })
    }
  }

  return result
}

export default function ViewTeam({ getBudgetData }: ViewTeamProps) {
  const [teamData, setTeamData] = useState<DeptTeam[]>([])
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const refresh = useCallback(() => {
    const data = getBudgetData()
    if (data) {
      const teams = extractTeamByDept(data.budgetLines)
      setTeamData(teams)
    } else {
      setTeamData([])
    }
    setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
  }, [getBudgetData])

  // Atualiza ao montar
  useEffect(() => {
    refresh()
  }, [refresh])

  const grandTotal = useMemo(() => teamData.reduce((sum, d) => sum + d.deptTotal, 0), [teamData])
  const totalMembers = useMemo(() => teamData.reduce((sum, d) => sum + d.members.length, 0), [teamData])

  return (
    <PageLayout title="Equipe" contentLayout="single">
      {/* Toolbar */}
      <div
        className="rounded border mb-4 flex items-center justify-between px-3 py-2"
        style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase font-medium tracking-wider" style={{ color: resolve.muted }}>
            {totalMembers} profissional(is) em {teamData.length} departamento(s)
          </span>
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: resolve.muted }}>
              Atualizado: {lastUpdate}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          className="h-7 px-3 text-[11px] font-medium uppercase rounded transition-colors"
          style={{ backgroundColor: resolve.accent, color: resolve.bg }}
        >
          Atualizar
        </button>
      </div>

      {/* Resumo total */}
      {teamData.length > 0 && (
        <div
          className="rounded border mb-4 px-4 py-3 flex items-center justify-between"
          style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}
        >
          <span className="text-sm font-medium" style={{ color: resolve.text }}>Total Mão de Obra (Equipe)</span>
          <span className="text-sm font-mono font-semibold" style={{ color: cinema.success }}>{formatCurrency(grandTotal)}</span>
        </div>
      )}

      {/* Sem dados */}
      {teamData.length === 0 && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>EQUIPE</span>
          </div>
          <div className="p-8 text-center" style={{ color: resolve.muted }}>
            <p className="text-sm">Nenhum profissional encontrado no orçamento.</p>
            <p className="text-[11px] mt-2">Adicione linhas de mão de obra nas páginas de Orçamento para ver a equipe aqui.</p>
          </div>
        </div>
      )}

      {/* Departamentos */}
      {teamData.map((dept) => (
        <div
          key={dept.department}
          className="rounded border overflow-hidden mb-3"
          style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}
        >
          {/* Header do departamento */}
          <div
            className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider flex items-center justify-between"
            style={{ borderColor: resolve.border, color: resolve.muted, backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <span>{dept.department}</span>
            <span className="font-mono text-[13px] font-medium" style={{ color: resolve.yellow }}>{formatCurrency(dept.deptTotal)}</span>
          </div>

          {/* Tabela */}
          <div className="p-2 sm:p-3 overflow-x-auto">
            <table className="w-full text-[11px] border-collapse" style={{ color: resolve.text }}>
              <thead>
                <tr>
                  <th className="text-left text-[11px] uppercase pb-2 pr-3" style={{ color: resolve.muted }}>Nome</th>
                  <th className="text-left text-[11px] uppercase pb-2 pr-3" style={{ color: resolve.muted }}>Função</th>
                  <th className="text-right text-[11px] uppercase pb-2" style={{ color: resolve.muted }}>Cachê Total</th>
                </tr>
              </thead>
              <tbody>
                {dept.members.map((member, idx) => (
                  <tr key={`${member.name}-${member.role}-${idx}`} style={{ borderColor: resolve.border }}>
                    <td
                      className="py-1.5 pr-3 border-b"
                      style={{ borderColor: resolve.border, fontWeight: 500 }}
                    >
                      {member.name}
                    </td>
                    <td
                      className="py-1.5 pr-3 border-b"
                      style={{ borderColor: resolve.border, color: resolve.muted }}
                    >
                      {member.role || '—'}
                    </td>
                    <td
                      className="py-1.5 border-b text-right font-mono text-[11px]"
                      style={{ borderColor: resolve.border }}
                    >
                      {formatCurrency(member.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </PageLayout>
  )
}
