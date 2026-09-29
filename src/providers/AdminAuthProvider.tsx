import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { checkIsAdmin, getSession, onAuthStateChange, signInAdmin, signOutAdmin } from '@/services/admin/authService'

interface AdminAuthContextValue {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  async function hydrate(next: Session | null) {
    setSession(next)
    setUser(next?.user ?? null)
    if (!next) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    const admin = await checkIsAdmin()
    setIsAdmin(admin)
    if (!admin) {
      await signOutAdmin()
      setSession(null)
      setUser(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    getSession().then((s) => {
      if (!active) return
      void hydrate(s)
    })
    const { data } = onAuthStateChange((s) => {
      if (!active) return
      void hydrate(s)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    setLoading(true)
    const result = await signInAdmin(email, password)
    if (result.ok) {
      const s = await getSession()
      await hydrate(s)
    } else {
      setLoading(false)
    }
    return result
  }

  async function signOut() {
    await signOutAdmin()
    setSession(null)
    setUser(null)
    setIsAdmin(false)
  }

  async function refresh() {
    setLoading(true)
    const s = await getSession()
    await hydrate(s)
  }

  return (
    <AdminAuthContext.Provider value={{ session, user, isAdmin, loading, signIn, signOut, refresh }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
