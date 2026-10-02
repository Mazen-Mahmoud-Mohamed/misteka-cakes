import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AdminIconButton } from '@/components/admin/AdminButton'
import { useFocusTrap } from '@/components/admin/AdminModal'
import { AdminFullPageLoading } from '@/components/admin/AdminStates'
import {
  IconCake,
  IconClose,
  IconExternal,
  IconHome,
  IconLayers,
  IconLogout,
  IconMapPin,
  IconMenu,
  IconOrders,
  IconRuler,
  IconSparkles,
  IconTag,
  Spinner,
} from '@/components/admin/icons'
import { brand } from '@/data/brand'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { cx } from '@/utils/cx'

type NavItem = { to: string; label: string; end: boolean; icon: ReactNode }

const navGroups: Array<{ label?: string; items: NavItem[] }> = [
  {
    items: [
      { to: '/admin', label: 'الرئيسية', end: true, icon: <IconHome /> },
      { to: '/admin/orders', label: 'الطلبات', end: false, icon: <IconOrders /> },
    ],
  },
  {
    label: 'الكتالوج',
    items: [
      { to: '/admin/cakes', label: 'التورت', end: false, icon: <IconCake /> },
      { to: '/admin/categories', label: 'التصنيفات', end: false, icon: <IconTag /> },
      { to: '/admin/sizes', label: 'المقاسات والأسعار', end: false, icon: <IconRuler /> },
      { to: '/admin/fillings', label: 'الحشوات', end: false, icon: <IconLayers /> },
      { to: '/admin/extras', label: 'الإضافات', end: false, icon: <IconSparkles /> },
    ],
  },
  {
    label: 'التوصيل',
    items: [{ to: '/admin/zones', label: 'مناطق التوصيل', end: false, icon: <IconMapPin /> }],
  },
]

function currentLocation(pathname: string): { group?: string; label: string; parent?: { to: string; label: string } } {
  if (matchPath('/admin/orders/:id', pathname)) {
    return { label: 'تفاصيل الطلب', parent: { to: '/admin/orders', label: 'الطلبات' } }
  }
  for (const group of navGroups) {
    for (const item of group.items) {
      if (matchPath({ path: item.to, end: item.end }, pathname)) return { group: group.label, label: item.label }
    }
  }
  return { label: 'لوحة التحكم' }
}

function Brand() {
  return (
    <Link to="/admin" className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <img src={brand.logo} alt="" className="size-10 shrink-0 rounded-full border border-line object-cover" />
      <span className="grid min-w-0 leading-tight">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-xl text-rose-deep">{brand.nameAr}</span>
          <span className="font-latin text-sm tracking-[0.12em] text-[#8a6532]">{brand.nameEn}</span>
        </span>
        <span className="text-xs font-semibold text-muted">لوحة التحكم</span>
      </span>
    </Link>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="أقسام لوحة التحكم" className="grid gap-5">
      {navGroups.map((group, index) => (
        <div key={group.label ?? index}>
          {group.label ? (
            <p className="mb-1.5 px-3 text-[0.6875rem] font-bold tracking-wide text-muted/80">{group.label}</p>
          ) : null}
          <ul className="grid gap-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 motion-reduce:transition-none',
                      isActive
                        ? 'bg-blush/70 font-bold text-rose-deep before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-rose-deep'
                        : 'font-semibold text-ink/80 hover:bg-cream/80 hover:text-ink',
                    )
                  }
                >
                  <span className="opacity-90">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function SidebarFooter({
  email,
  onLogout,
  loggingOut,
  showIdentity,
}: {
  email?: string
  onLogout: () => void
  loggingOut: boolean
  showIdentity?: boolean
}) {
  return (
    <div className="grid gap-1 border-t border-line pt-3">
      {showIdentity && email ? (
        <p className="mb-1 truncate px-3 text-xs text-muted" dir="ltr" title={email}>
          {email}
        </p>
      ) : null}
      <a
        href="#/"
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink/80 transition-colors duration-150 hover:bg-cream/80 hover:text-ink motion-reduce:transition-none"
      >
        <IconExternal size={18} />
        عرض الموقع
        <span className="sr-only">(يفتح في نافذة جديدة)</span>
      </a>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-start text-sm font-semibold text-rose-deep transition-colors duration-150 hover:bg-blush/60 disabled:opacity-60 motion-reduce:transition-none"
      >
        {loggingOut ? <Spinner className="size-[18px]" /> : <IconLogout size={18} />}
        {loggingOut ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}
      </button>
    </div>
  )
}

export function AdminShell() {
  const { user, signOut, loading, isAdmin } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false))

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  async function onLogout() {
    setLoggingOut(true)
    await signOut()
    setLoggingOut(false)
    navigate('/admin/login', { replace: true })
  }

  if (loading) return <AdminFullPageLoading />
  if (!isAdmin) return null

  const here = currentLocation(location.pathname)
  const crumbs: Array<{ label: string; to?: string }> = [
    { label: 'لوحة التحكم' },
    ...(here.group ? [{ label: here.group }] : []),
    ...(here.parent ? [here.parent] : []),
    { label: here.label },
  ]
  const email = user?.email ?? ''
  const initial = email.trim().charAt(0).toUpperCase() || 'م'

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <a
        className="skip-link"
        href="#admin-content"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('admin-content')?.focus()
        }}
      >
        تخطّي إلى المحتوى
      </a>

      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-line bg-paper lg:flex">
        <div className="border-b border-line px-3 py-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav />
        </div>
        <div className="px-3 pb-4">
          <SidebarFooter onLogout={() => void onLogout()} loggingOut={loggingOut} />
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
          <div
            ref={drawerRef}
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة لوحة التحكم"
            tabIndex={-1}
            className="absolute inset-y-0 start-0 flex w-[min(18rem,86vw)] flex-col border-e border-line bg-paper shadow-[0_0_40px_rgba(74,52,46,0.18)] outline-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
              <Brand />
              <AdminIconButton label="إغلاق القائمة" onClick={() => setDrawerOpen(false)} className="text-muted">
                <IconClose />
              </AdminIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="px-3 pb-4">
              <SidebarFooter email={email} showIdentity onLogout={() => void onLogout()} loggingOut={loggingOut} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:ps-60">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-2 px-2 sm:px-4 lg:px-8">
            <AdminIconButton
              label="فتح القائمة"
              aria-expanded={drawerOpen}
              aria-controls="admin-drawer"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden"
            >
              <IconMenu />
            </AdminIconButton>

            <nav aria-label="المسار" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center text-sm">
                {crumbs.map((crumb, index) => {
                  const last = index === crumbs.length - 1
                  const onMobile = (c: { to?: string }, i: number) => i === crumbs.length - 1 || Boolean(c.to)
                  const separatorOnMobile = onMobile(crumb, index) && crumbs.slice(0, index).some(onMobile)
                  return (
                    <li
                      key={crumb.label}
                      className={cx(
                        'min-w-0 items-center',
                        onMobile(crumb, index) ? 'flex' : 'hidden sm:flex',
                        last ? 'shrink' : 'shrink-0',
                      )}
                    >
                      {index > 0 ? (
                        <span className={cx('px-2 text-muted/50', !separatorOnMobile && 'hidden sm:inline')} aria-hidden="true">
                          /
                        </span>
                      ) : null}
                      {last ? (
                        <span className="truncate font-bold text-ink" aria-current="page">
                          {crumb.label}
                        </span>
                      ) : crumb.to ? (
                        <Link
                          to={crumb.to}
                          className="inline-flex min-h-11 items-center font-semibold text-muted hover:text-rose-deep hover:underline"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-muted">{crumb.label}</span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>

            <div className="flex shrink-0 items-center gap-2.5 ps-2">
              <span className="hidden max-w-56 truncate text-sm text-muted md:block" dir="ltr" title={email}>
                {email}
              </span>
              <span
                className="grid size-9 place-items-center rounded-full bg-rose-deep text-sm font-bold text-ivory"
                title={email}
                aria-label={email ? `الحساب: ${email}` : 'الحساب'}
                role="img"
              >
                {initial}
              </span>
            </div>
          </div>
        </header>

        <main id="admin-content" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
