import type { Viewport } from 'next'
import Link from 'next/link'

export const viewport: Viewport = {
  themeColor: '#1a1a1e',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-sm opacity-80">O endereço não existe ou foi movido.</p>
      <Link href="/" className="text-sm underline" style={{ color: '#f5c518' }}>
        Voltar ao início
      </Link>
    </div>
  )
}
