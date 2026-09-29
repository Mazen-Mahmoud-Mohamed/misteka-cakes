import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { Button } from '@/components/ui/Button'
import { cx } from '@/utils/cx'

const nav = [
  { to: '/admin', label: 'الرئيسية', end: true },
  { to: '/admin/orders', label: 'الطلبات', end: false },
  { to: '/admin/cakes', label: 'التورت', end: false },
  { to: '/admin/sizes', label: 'المقاسات والأسعار', end: false },
  { to: '/admin/fillings', label: 'الحشوات', end: false },
  { to: '/admin/extras', label: 'الإضافات', end: false },
  { to: '/admin/zones', label: 'مناطق التوصيل', end: false },
]

export function AdminShell() {
  const { user, signOut, loading, isAdmin } = useAdminAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory text-muted">
        جاري التحقق من الجلسة...
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-cream/40 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-line bg-paper lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:border-b-0 lg:border-e">
        <div className="px-5 py-6">
          <p className="font-latin text-sm tracking-[0.2em] text-gold uppercase">Misteka Cakes</p>
          <h1 className="mt-1 font-display text-3xl text-rose-deep">لوحة التحكم</h1>
          <p className="mt-2 truncate text-sm text-muted" dir="ltr">
            {user?.email}
          </p>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:grid lg:gap-1 lg:overflow-visible lg:px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition whitespace-nowrap',
                  isActive ? 'bg-blush text-rose-deep' : 'text-muted hover:bg-ivory hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <Button type="button" variant="ghost" className="w-full" onClick={() => void onLogout()}>
            تسجيل الخروج
          </Button>
        </div>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
