'use client'

import { useState, useEffect } from 'react'
import { resolve, cinema } from '@/lib/theme'
import { useAuth } from '@/lib/auth-context'

const STORAGE_REMEMBER_EMAIL = 'cinebuddy_remember_email'
const STORAGE_SAVED_EMAIL = 'cinebuddy_saved_email'

const inputCls = 'w-full px-3 py-2.5 text-sm rounded border focus:outline-none'
const labelCls = 'block text-xs uppercase tracking-wider mb-1.5'

function EyeIcon({ show }: { show: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {show ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  )
}

export default function LoginScreen() {
  const { login, initSignup, loading, forceFinishLoading } = useAuth()
  const [view, setView] = useState<'login' | 'cadastro'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(STORAGE_SAVED_EMAIL)
    const remember = localStorage.getItem(STORAGE_REMEMBER_EMAIL)
    if (saved && remember === 'true') {
      setEmail(saved)
      setRememberEmail(true)
    }
  }, [])

  const isInitialSetup = view === 'cadastro'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isInitialSetup) {
        const result = await initSignup(name.trim(), surname.trim(), email.trim(), password)
        if (result.error) {
          setError(result.error)
          if (result.error.includes('Já existem') || result.error.includes('tela de login')) setView('login')
        }
      } else {
        const result = await login(email.trim(), password)
        if (result.error) {
          setError(result.error)
        } else {
          if (rememberEmail && typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_REMEMBER_EMAIL, 'true')
            localStorage.setItem(STORAGE_SAVED_EMAIL, email.trim())
          } else if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_REMEMBER_EMAIL)
            localStorage.removeItem(STORAGE_SAVED_EMAIL)
          }
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleMostrarCadastro = async () => {
    setError('')
    const res = await fetch('/api/auth/check-setup', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (data.hasUsers) {
      setError('Já existem usuários cadastrados. Utilize o formulário acima para entrar.')
      return
    }
    setView('cadastro')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" style={{ backgroundColor: '#0d0d0f' }}>
        <div className="text-sm" style={{ color: resolve.muted }}>Carregando...</div>
        <button
          type="button"
          onClick={forceFinishLoading}
          className="text-xs px-3 py-1.5 rounded border"
          style={{ borderColor: '#5c7c99', color: '#5c7c99' }}
        >
          Travou? Clique para continuar
        </button>
      </div>
    )
  }

  const inputStyle = {
    backgroundColor: resolve.bg,
    borderColor: resolve.border,
    color: resolve.text,
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0d0d0f' }}>
      <div className="w-full max-w-sm rounded border p-6" style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}>
        <h1 className="text-xl font-semibold uppercase tracking-wide mb-1" style={{ color: resolve.text }}>
          CineBuddy
        </h1>
        <p className="text-xs mb-6" style={{ color: resolve.muted }}>
          {isInitialSetup ? 'Cadastro inicial (primeiro usuário será administrador)' : 'Entre com seu e-mail e senha'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isInitialSetup && (
            <>
              <div>
                <label className={labelCls} style={{ color: resolve.muted }}>Nome</label>
                <input type="text" className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <label className={labelCls} style={{ color: resolve.muted }}>Sobrenome</label>
                <input type="text" className={inputCls} style={inputStyle} value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" />
              </div>
            </>
          )}
          <div>
            <label className={labelCls} style={{ color: resolve.muted }}>E-mail</label>
            <input type="email" className={inputCls} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className={labelCls} style={{ color: resolve.muted }}>Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputCls}
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isInitialSetup ? 'new-password' : 'current-password'}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded focus:outline-none hover:opacity-80"
                style={{ color: resolve.muted }}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <EyeIcon show={!showPassword} />
              </button>
            </div>
          </div>
          {!isInitialSetup && (
            <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: resolve.muted }}>
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="rounded border"
                style={{ borderColor: resolve.border }}
              />
              Lembrar e-mail para próximos acessos
            </label>
          )}
          {error && (
            <div className="text-xs py-1" style={{ color: cinema.danger }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-medium uppercase tracking-wider rounded transition-colors"
            style={{ backgroundColor: cinema.success, color: '#fff' }}
          >
            {submitting ? 'Aguarde...' : isInitialSetup ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        {!isInitialSetup ? (
          <p className="text-xs mt-4 text-center" style={{ color: resolve.muted }}>
            Primeiro uso?{' '}
            <button type="button" onClick={handleMostrarCadastro} className="underline focus:outline-none" style={{ color: resolve.accent }}>
              Criar conta de administrador
            </button>
          </p>
        ) : (
          <p className="text-xs mt-4 text-center" style={{ color: resolve.muted }}>
            <button type="button" onClick={() => { setView('login'); setError(''); }} className="underline focus:outline-none" style={{ color: resolve.accent }}>
              Voltar ao login
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
