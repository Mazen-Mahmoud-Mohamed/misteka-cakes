import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'

export function AdminLoginPage() {
  const { signIn, isAdmin, loading } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && isAdmin) {
    const from = (location.state as { from?: string } | null)?.from || '/admin'
    return <Navigate to={from} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isSupabaseConfigured()) {
      setError('إعدادات الاتصال غير مكتملة.')
      return
    }
    setSubmitting(true)
    setError('')
    const result = await signIn(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4 py-10">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-8 shadow-soft"
      >
        <p className="font-latin text-sm tracking-[0.2em] text-gold uppercase">Misteka Cakes</p>
        <h1 className="mt-2 font-display text-4xl text-rose-deep">دخول الإدارة</h1>
        <p className="mt-3 text-sm leading-7 text-muted">للموظفين المصرح لهم فقط. لا يوجد تسجيل عام.</p>

        <div className="mt-8 grid gap-4">
          <TextField
            id="admin-email"
            label="البريد الإلكتروني"
            type="email"
            autoComplete="username"
            dir="ltr"
            className="text-start"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            id="admin-password"
            label="كلمة المرور"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className="text-start"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-deep">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-6 w-full" disabled={submitting || loading}>
          {submitting ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
        </Button>
      </form>
    </div>
  )
}
