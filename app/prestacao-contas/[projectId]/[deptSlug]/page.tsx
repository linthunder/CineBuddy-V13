'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import PrestacaoContasDeptView from '@/components/prestacao-contas/PrestacaoContasDeptView'
import { getDeptBySlug, type ExpenseDepartment, type ExpenseLine } from '@/lib/prestacao-contas'

function normalizeExpense(e: Partial<ExpenseLine> & { id: string; department: ExpenseDepartment }): ExpenseLine {
  return {
    id: e.id,
    department: e.department,
    name: e.name ?? '',
    description: e.description ?? '',
    value: typeof e.value === 'number' ? e.value : 0,
    invoiceNumber: e.invoiceNumber ?? '',
    payStatus: e.payStatus === 'pago' ? 'pago' : 'pendente',
    date: e.date ?? '',
    supplier: e.supplier ?? '',
    expenseType: (e.expenseType === 'outros' ? 'Outros' : e.expenseType) ?? 'Outros',
  }
}

function PrestacaoContasContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = (params?.projectId as string) ?? ''
  const deptSlug = (params?.deptSlug as string) ?? ''
  const token = searchParams?.get?.('token') ?? ''
  const [projectName, setProjectName] = useState('')
  const [department, setDepartment] = useState('')
  const [responsible1, setResponsible1] = useState('')
  const [responsible2, setResponsible2] = useState('')
  const [verba, setVerba] = useState(0)
  const [saldo, setSaldo] = useState(0)
  const [expenses, setExpenses] = useState<ExpenseLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)


  useEffect(() => {
    if (!projectId || !deptSlug) {
      setLoading(false)
      setError('URL incompleta. Use o link enviado pelo responsável.')
      return
    }
    const dept = getDeptBySlug(deptSlug)
    if (!dept) {
      setError('Departamento inválido na URL.')
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    fetch(`/api/prestacao-contas/data?projectId=${encodeURIComponent(projectId)}&deptSlug=${encodeURIComponent(deptSlug)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Projeto não encontrado.' : 'Erro ao carregar.')
        return res.json()
      })
      .then((data) => {
        setProjectName(data.projectName ?? '')
        setDepartment(data.department ?? '')
        setResponsible1(data.responsible1 ?? '')
        setResponsible2(data.responsible2 ?? '')
        setVerba(Number(data.verba) || 0)
        setSaldo(Number(data.saldo) ?? 0)
        const list = Array.isArray(data.expenses) ? data.expenses : []
        setExpenses(list.map((e: Partial<ExpenseLine> & { id: string; department: ExpenseDepartment }) => normalizeExpense(e)))
      })
      .catch((err) => setError(err.message ?? 'Erro ao carregar dados.'))
      .finally(() => setLoading(false))
  }, [projectId, deptSlug])

  const dept = getDeptBySlug(deptSlug)
  const invalidDept = deptSlug && !dept

  const updateExpense = useCallback((id: string, updates: Partial<ExpenseLine>) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }, [])

  const addExpense = useCallback(() => {
    if (!dept) return
    setExpenses((prev) => [
      ...prev,
      normalizeExpense({
        id: `exp-${Date.now()}`,
        department: dept,
        name: '',
        description: '',
        value: 0,
        invoiceNumber: '',
        payStatus: 'pendente',
        date: '',
        supplier: '',
        expenseType: 'Outros',
      }),
    ])
  }, [dept])

  const removeExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const handleSave = useCallback(() => {
    if (!token || !projectId || !deptSlug) {
      setSaveError('Link inválido ou expirado. Não é possível salvar.')
      return
    }
    setSaveError(null)
    setSaveSuccess(false)
    setSaving(true)
    fetch('/api/prestacao-contas/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, projectId, deptSlug, expenses }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { error?: string }
        if (!res.ok) throw new Error(data?.error ?? 'Erro ao salvar.')
        return data
      })
      .then(() => {
        setSaveSuccess(true)
        setSaveError(null)
      })
      .catch((err) => setSaveError(err.message ?? 'Erro ao salvar.'))
      .finally(() => setSaving(false))
  }, [token, projectId, deptSlug, expenses])

  if (invalidDept) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
        <p className="text-sm" style={{ color: '#c94a4a' }}>Departamento inválido na URL.</p>
        <p className="text-xs opacity-80">Verifique se o link está correto.</p>
        <Link href="/" className="text-sm underline mt-2" style={{ color: '#f5c518' }}>Voltar ao início</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
        <p className="text-sm">Carregando…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
        <p className="text-sm" style={{ color: '#c94a4a' }}>{error}</p>
        <Link href="/" className="text-sm underline" style={{ color: '#f5c518' }}>Voltar ao início</Link>
      </div>
    )
  }

  return (
    <PrestacaoContasDeptView
      projectId={projectId}
      projectName={projectName}
      department={department}
      responsible1={responsible1}
      responsible2={responsible2}
      verba={verba}
      saldo={saldo}
      expenses={expenses}
      onUpdate={updateExpense}
      onAdd={addExpense}
      onRemove={removeExpense}
      onSave={handleSave}
      saving={saving}
      canEdit={!!token}
      saveSuccess={saveSuccess}
      saveError={saveError}
    />
  )
}

export default function PrestacaoContasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
          <p className="text-sm">Carregando…</p>
        </div>
      }
    >
      <PrestacaoContasContent />
    </Suspense>
  )
}
