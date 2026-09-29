import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

export interface AdminAuthState {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  error: string | null
}

export async function signInAdmin(email: string, password: string): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabase()
  if (!supabase) {
    return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }
  }

  const trimmed = email.trim()
  if (!trimmed || !password) {
    return { ok: false, message: 'أدخلي البريد وكلمة المرور.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  })

  if (error || !data.session) {
    return { ok: false, message: 'بيانات الدخول غير صحيحة.' }
  }

  const admin = await checkIsAdmin()
  if (!admin) {
    await supabase.auth.signOut()
    return { ok: false, message: 'هذا الحساب غير مصرح له بإدارة المستيكا.' }
  }

  return { ok: true, message: '' }
}

export async function signOutAdmin(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false

  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const supabase = getSupabase()
  if (!supabase) {
    callback(null)
    return { data: { subscription: { unsubscribe: () => undefined } } }
  }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
