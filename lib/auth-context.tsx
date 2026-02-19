'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getMyProfile } from '@/lib/services/profiles'
import type { Profile } from '@/lib/services/profiles'

const STORAGE_HAS_USERS = 'cinebuddy_has_users'

function readHasUsersFromStorage(): boolean | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(STORAGE_HAS_USERS)
  return v === 'true' ? true : null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  hasUsers: boolean | null
  /** Para ambientes onde getSession trava (ex: navegador embutido do Cursor) */
  forceFinishLoading: () => void
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  initSignup: (name: string, surname: string, email: string, password: string) => Promise<{ error?: string }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasUsers, setHasUsers] = useState<boolean | null>(readHasUsersFromStorage)

  const refreshProfile = useCallback(async () => {
    const p = await getMyProfile()
    setProfile(p)
  }, [])

  useEffect(() => {
    let cancelled = false
    /** Fallback curto: se getSession demorar, mostra o botao "Travou? Clique para continuar" apos 500ms */
    const fallbackShort = setTimeout(() => {
      if (cancelled) return
      setLoading(false)
    }, 500)

    /** Fallback máximo: garante que nunca ficamos travados mais que 3s (rede/Supabase lento) */
    const fallbackMax = setTimeout(() => {
      if (cancelled) return
      setLoading(false)
    }, 3000)

    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 4000)
    )
    Promise.race([sessionPromise, timeoutPromise])
      .then(({ data: { session: s } }) => {
        if (cancelled) return
        clearTimeout(fallbackShort)
        clearTimeout(fallbackMax)
        setSession(s ?? null)
        if (s) getMyProfile().then((p) => !cancelled && setProfile(p))
        setLoading(false)
      })
      .catch(async (err) => {
        if (cancelled) return
        clearTimeout(fallbackShort)
        clearTimeout(fallbackMax)
        const msg = err?.message ?? ''
        const isInvalidRefresh = /refresh token|invalid.*token|token.*not found/i.test(msg)
        const is403 = err?.status === 403 || /403|forbidden/i.test(msg)
        if (isInvalidRefresh) {
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
        }
        // 403 = sem sessão ou auth desabilitado para anônimo; não logar para não poluir o console
        if (!isInvalidRefresh && !is403) console.error('Auth getSession:', err)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return
      setSession(s)
      if (s) getMyProfile().then(setProfile)
      else setProfile(null)
    })

    return () => {
      cancelled = true
      clearTimeout(fallbackShort)
      clearTimeout(fallbackMax)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (loading || session) return
    if (hasUsers !== null) return
    fetch('/api/auth/check-setup', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const ok = !!data.hasUsers
        if (ok) {
          setHasUsers(true)
          if (typeof window !== 'undefined') localStorage.setItem(STORAGE_HAS_USERS, 'true')
        } else if (typeof window === 'undefined' || !localStorage.getItem(STORAGE_HAS_USERS)) {
          setHasUsers(false)
        }
      })
      .catch(() => { if (typeof window === 'undefined' || !localStorage.getItem(STORAGE_HAS_USERS)) setHasUsers(null) })
  }, [loading, session, hasUsers])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await refreshProfile()
    return {}
  }, [refreshProfile])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // 403 ou rede: limpa estado local mesmo assim para não travar na tela
    }
    setSession(null)
    setProfile(null)
    // Nao zera hasUsers: uma vez que existem usuarios, a tela inicial deve ser sempre login
  }, [])

  const setHasUsersTrue = useCallback(() => {
    setHasUsers(true)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_HAS_USERS, 'true')
  }, [])

  const initSignup = useCallback(async (name: string, surname: string, email: string, password: string) => {
    const res = await fetch('/api/auth/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, surname, email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.error && (data.error.includes('J\u00e1 existem') || data.error.includes('tela de login'))) setHasUsersTrue()
      return { error: data.error || 'Falha no cadastro.' }
    }
    const result = await login(email, password)
    if (!result.error) setHasUsersTrue()
    return result
  }, [login, setHasUsersTrue])

  const forceFinishLoading = useCallback(() => setLoading(false), [])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    hasUsers,
    forceFinishLoading,
    login,
    logout,
    initSignup,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useIsAdmin() {
  const { profile } = useAuth()
  return profile?.role === 'admin'
}
