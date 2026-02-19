'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function PrestacaoContasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('PrestacaoContas error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
      <h1 className="text-lg font-semibold" style={{ color: '#c94a4a' }}>Algo deu errado</h1>
      <p className="text-sm text-center max-w-sm opacity-90">{error.message || 'Erro ao carregar a página.'}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded text-sm font-medium border transition-colors"
          style={{ borderColor: '#5c7c99', color: '#5c7c99' }}
        >
          Tentar de novo
        </button>
        <Link href="/" className="px-4 py-2 rounded text-sm font-medium underline" style={{ color: '#f5c518' }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
