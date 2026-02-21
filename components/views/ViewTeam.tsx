'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'
import type { BudgetLinesByPhase, VerbaLinesByPhase, BudgetRow } from '@/lib/types'
import { listCollaborators, type Collaborator } from '@/lib/services/collaborators'
import { Info, DollarSign, PenLine, Receipt, FolderOpen } from 'lucide-react'
import DriveLinkButton from '@/components/DriveLinkButton'
import { memberFolderName, EQUIPE_DRIVE_PATH, CASTING_DRIVE_PATH } from '@/lib/drive-folder-structure'

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
  projectDbId?: string | null
}

function extractTeamByDept(budgetLines: BudgetLinesByPhase): DeptTeam[] {
  const deptMap = new Map<string, Map<string, TeamMember>>()

  for (const phase of ['pre', 'prod', 'pos'] as const) {
    const depts = budgetLines[phase]
    if (!depts) continue
    for (const [dept, rows] of Object.entries(depts)) {
      for (const row of rows as BudgetRow[]) {
        const isLabor = row.type === 'labor'
        const isCasting = dept === 'CASTING' && (row.itemName?.trim() || row.roleFunction?.trim())
        if (!isLabor && !isCasting) continue
        if (!row.itemName?.trim() && !row.roleFunction?.trim()) continue

        if (!deptMap.has(dept)) deptMap.set(dept, new Map())
        const membersMap = deptMap.get(dept)!
        const key = `${(row.itemName ?? '').trim().toLowerCase()}__${(row.roleFunction ?? '').trim().toLowerCase()}`
        const existing = membersMap.get(key)
        const cost = 'totalCost' in row ? (row.totalCost ?? 0) : 0
        if (existing) {
          existing.totalCost += cost
        } else {
          membersMap.set(key, {
            name: (row.itemName ?? '').trim() || 'Sem nome',
            role: (row.roleFunction ?? '').trim() ?? '',
            totalCost: cost,
          })
        }
      }
    }
  }

  const result: DeptTeam[] = []
  for (const [dept, membersMap] of deptMap) {
    const members = Array.from(membersMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const deptTotal = members.reduce((sum, m) => sum + m.totalCost, 0)
    if (members.length > 0) {
      result.push({ department: dept, members, deptTotal })
    }
  }
  const castingFirst = (a: DeptTeam, b: DeptTeam) => {
    if (a.department === 'CASTING') return -1
    if (b.department === 'CASTING') return 1
    return 0
  }
  return result.sort(castingFirst)
}

/** Encontra colaborador pelo nome (case-insensitive). */
function findCollaboratorByName(collaborators: Collaborator[], memberName: string): Collaborator | undefined {
  const normalized = memberName.trim().toLowerCase()
  return collaborators.find((c) => c.nome?.trim().toLowerCase() === normalized)
}

const iconBtnCls = 'team-info-btn flex items-center justify-center rounded transition-colors text-xs font-medium'

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
      <button
        type="button"
        onClick={copy}
        title="Copiar"
        className="team-info-btn flex-shrink-0 h-7 px-2 rounded border text-[10px] font-medium uppercase"
      >
        Copiar
      </button>
    </div>
  )
}

export default function ViewTeam({ getBudgetData, projectDbId }: ViewTeamProps) {
  const [teamData, setTeamData] = useState<DeptTeam[]>([])
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [modalContact, setModalContact] = useState<Collaborator | 'no-data' | null>(null)
  const [modalBank, setModalBank] = useState<Collaborator | 'no-data' | null>(null)

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

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    listCollaborators().then(setCollaborators).catch(() => setCollaborators([]))
  }, [])

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
          className="btn-resolve-hover h-7 px-3 text-[11px] font-medium uppercase rounded transition-colors border"
          style={{ backgroundColor: resolve.accent, color: resolve.bg, borderColor: resolve.accent }}
        >
          Atualizar
        </button>
      </div>

      {/* Sem dados */}
      {teamData.length === 0 && (
        <div className="rounded border overflow-hidden" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
          <div className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider" style={{ borderColor: resolve.border, color: resolve.muted }}>
            <span>EQUIPE</span>
          </div>
          <div className="p-8 text-center" style={{ color: resolve.muted }}>
            <p className="text-sm">Nenhum profissional ou elenco encontrado no orçamento.</p>
            <p className="text-[11px] mt-2">Adicione linhas de mão de obra ou casting nas páginas de Orçamento para ver a equipe aqui.</p>
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
          <div
            className="px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wider"
            style={{ borderColor: resolve.border, color: resolve.muted, backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            {dept.department}
          </div>

          <div className="p-2 sm:p-3 overflow-x-auto min-w-0">
            <table className="team-equipe-table w-full text-[11px] border-collapse table-fixed" style={{ color: resolve.text }}>
              <colgroup>
                <col style={{ width: '38%' }} />
                <col style={{ width: '32%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left text-[11px] uppercase pb-2 pr-3" style={{ color: resolve.muted }}>Nome</th>
                  <th className="text-left text-[11px] uppercase pb-2 pr-3" style={{ color: resolve.muted }}>Função</th>
                  <th className="text-center text-[11px] uppercase pb-2 pr-2" style={{ color: resolve.muted }}>Informações</th>
                </tr>
              </thead>
              <tbody>
                {dept.members.map((member, idx) => {
                  const collab = findCollaboratorByName(collaborators, member.name)
                  return (
                    <tr key={`${member.name}-${member.role}-${idx}`} style={{ borderColor: resolve.border }}>
                      <td className="py-1.5 pr-3 border-b truncate" style={{ borderColor: resolve.border, fontWeight: 500 }} title={member.name}>
                        {member.name}
                      </td>
                      <td className="py-1.5 pr-3 border-b truncate" style={{ borderColor: resolve.border, color: resolve.muted }} title={member.role || '—'}>
                        {member.role || '—'}
                      </td>
                      <td className="py-1.5 px-1 border-b align-middle" style={{ borderColor: resolve.border }}>
                        <div className="flex items-center justify-center gap-0.5 flex-wrap">
                          <button
                            type="button"
                            title="Telefone, e-mail e endereço"
                            className={iconBtnCls}
                            onClick={() => setModalContact(collab ?? 'no-data')}
                            style={{ width: 26, height: 26, minWidth: 26, minHeight: 26, color: resolve.muted }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = resolve.yellow }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}
                          >
                            <Info size={17} strokeWidth={1.5} aria-hidden />
                          </button>
                          <button
                            type="button"
                            title="Dados bancários e PIX"
                            className={iconBtnCls}
                            onClick={() => setModalBank(collab ?? 'no-data')}
                            style={{ width: 26, height: 26, minWidth: 26, minHeight: 26, color: resolve.muted }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = resolve.yellow }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = resolve.muted }}
                          >
                            <DollarSign size={17} strokeWidth={1.5} aria-hidden />
                          </button>
                          <DriveLinkButton
                            projectId={projectDbId ?? null}
                            drivePath={`${dept.department === 'CASTING' ? CASTING_DRIVE_PATH : EQUIPE_DRIVE_PATH}/${memberFolderName({ name: member.name, role: member.role })}/CONTRATO`}
                            variant="contract"
                            title="Contrato"
                            className={iconBtnCls}
                            style={{ width: 26, height: 26, minWidth: 26, minHeight: 26, color: resolve.muted }}
                          >
                            <PenLine size={17} strokeWidth={1.5} aria-hidden />
                          </DriveLinkButton>
                          <DriveLinkButton
                            projectId={projectDbId ?? null}
                            drivePath={`${dept.department === 'CASTING' ? CASTING_DRIVE_PATH : EQUIPE_DRIVE_PATH}/${memberFolderName({ name: member.name, role: member.role })}/NOTA FISCAL`}
                            variant="invoice"
                            title="Nota fiscal"
                            className={iconBtnCls}
                            style={{ width: 26, height: 26, minWidth: 26, minHeight: 26, color: resolve.muted }}
                          >
                            <Receipt size={17} strokeWidth={1.5} aria-hidden />
                          </DriveLinkButton>
                          <DriveLinkButton
                            projectId={projectDbId ?? null}
                            drivePath={`${dept.department === 'CASTING' ? CASTING_DRIVE_PATH : EQUIPE_DRIVE_PATH}/${memberFolderName({ name: member.name, role: member.role })}`}
                            variant="folder"
                            title="Abrir pasta no Drive"
                            className={iconBtnCls}
                            style={{ width: 26, height: 26, minWidth: 26, minHeight: 26, color: resolve.muted }}
                          >
                            <FolderOpen size={17} strokeWidth={1.5} aria-hidden />
                          </DriveLinkButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal: Contato (telefone, e-mail, endereço) */}
      {modalContact !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setModalContact(null)}
        >
          <div
            className="rounded border p-4 w-full max-w-sm shadow-lg"
            style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: resolve.text }}>
              <span>ℹ</span> Contato
            </h3>
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setModalBank(null)}
        >
          <div
            className="rounded border p-4 w-full max-w-sm shadow-lg"
            style={{ backgroundColor: resolve.panel, borderColor: resolve.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: resolve.text }}>
              <span>$</span> Dados bancários
            </h3>
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
}
