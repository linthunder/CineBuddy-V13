'use client'

import { useCallback, useEffect, useState } from 'react'
import PageLayout from '@/components/PageLayout'
import CalendarWidget from '@/components/CalendarWidget'
import ProjectsEvolutionChart from '@/components/ProjectsEvolutionChart'
import { resolve } from '@/lib/theme'
import { listAccessibleProjects } from '@/lib/services/projects'

interface ProjectSummary {
  id: string
  nome: string
  job_id?: string
  status?: { initial?: string; final?: string; closing?: string }
}

export default function ViewHome() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])

  const loadProjects = useCallback(async () => {
    const data = await listAccessibleProjects()
    setProjects(
      data.map((p) => ({
        id: p.id,
        nome: p.nome,
        job_id: (p as { job_id?: string }).job_id,
        status: (p as { status?: ProjectSummary['status'] }).status,
      }))
    )
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const projectsForHome = projects.map((p) => ({ id: p.id, nome: p.nome, job_id: p.job_id }))

  return (
    <PageLayout title="Mural de Controle" contentLayout="single">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-w-0">
        {/* Coluna esquerda: calendário (3/5 em lg) */}
        <div className="lg:col-span-3 min-w-0">
          <div
            className="rounded-lg p-4 h-full"
            style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}
          >
            <p className="text-[11px] uppercase tracking-wider mb-4" style={{ color: resolve.muted }}>
              Calendário
            </p>
            <CalendarWidget mode="home" projectsForHome={projectsForHome} onRefresh={loadProjects} />
          </div>
        </div>

        {/* Coluna direita: gráfico de evolução (2/5 em lg) */}
        <div className="lg:col-span-2 min-w-0">
          <ProjectsEvolutionChart projects={projects} />
        </div>
      </div>
    </PageLayout>
  )
}
