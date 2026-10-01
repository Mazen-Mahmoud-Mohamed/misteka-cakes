import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminFieldShell, AdminTextField, adminControlClass } from '@/components/admin/AdminField'
import { IconEye, IconEyeOff } from '@/components/admin/icons'
import { brand } from '@/data/brand'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cx } from '@/utils/cx'

export function AdminLoginPage() {
  const { signIn, isAdmin, loading } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  usePageTitle('دخول الإدارة | مستكة')

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
      setError(
        result.message.includes('غير مصرح') ? 'هذا الحساب غير مصرّح له بالدخول إلى لوحة تحكم مستكة.' : result.message,
      )
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-4 py-10">
      <div className="w-full max-w-[25rem]">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={brand.logo} alt={brand.logoAlt} className="size-16 rounded-full border border-line object-cover" />
          <p className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl text-rose-deep">{brand.nameAr}</span>
            <span className="font-latin text-base tracking-[0.12em] text-[#8a6532]">{brand.nameEn}</span>
          </p>
        </div>

        <form
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="rounded-xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(74,52,46,0.04)] sm:p-7"
          aria-labelledby="admin-login-title"
        >
          <h1 id="admin-login-title" className="text-xl font-bold text-ink">
            دخول لوحة التحكم
          </h1>
          <p className="mt-1 text-sm leading-7 text-muted">للحسابات المصرّح لها فقط.</p>

          {error ? (
            <AdminAlert tone="error" className="mt-5">
              {error}
            </AdminAlert>
          ) : null}

          <div className="mt-5 grid gap-4">
            <AdminTextField
              id="admin-email"
              label="البريد الإلكتروني"
              type="email"
              inputMode="email"
              autoComplete="username"
              dir="ltr"
              className="text-start"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <AdminFieldShell id="admin-password" label="كلمة المرور">
              <div className="relative" dir="ltr">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={cx(adminControlClass, 'min-h-11 pe-12 text-start')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 end-0 grid w-11 cursor-pointer place-items-center rounded-e-lg text-muted hover:text-ink"
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </AdminFieldShell>
          </div>

          <AdminButton type="submit" variant="primary" className="mt-6 w-full" loading={submitting} disabled={loading}>
            {submitting ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </AdminButton>
        </form>

        <p className="mt-5 text-center text-sm">
          <a href="#/" className="font-semibold text-muted hover:text-rose-deep hover:underline">
            العودة إلى الموقع
          </a>
        </p>
      </div>
    </div>
  )
}
