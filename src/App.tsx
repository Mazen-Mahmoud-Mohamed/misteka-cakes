import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { RequireAdmin } from '@/components/admin/RequireAdmin'
import { CustomerThemeEffects } from '@/components/background/CustomerThemeEffects'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AdminAuthProvider } from '@/providers/AdminAuthProvider'
import { CatalogProvider } from '@/providers/CatalogProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { AdminHomePage } from '@/pages/admin/AdminHomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage'
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage'
import { AdminCakesPage } from '@/pages/admin/AdminCakesPage'
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage'
import { AdminSizesPage } from '@/pages/admin/AdminSizesPage'
import { AdminFillingsPage } from '@/pages/admin/AdminFillingsPage'
import { AdminExtrasPage } from '@/pages/admin/AdminExtrasPage'
import { AdminZonesPage } from '@/pages/admin/AdminZonesPage'
import { AdminReviewsPage } from '@/pages/admin/AdminReviewsPage'
import { AdminThemePage } from '@/pages/admin/AdminThemePage'
import { CatalogPage } from '@/pages/CatalogPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OrderPage } from '@/pages/OrderPage'
import { PricingPage } from '@/pages/PricingPage'
import { TrackOrderPage } from '@/pages/TrackOrderPage'

function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null
    if (state?.scrollTo) return
    window.scrollTo(0, 0)
  }, [location.pathname, location.state])

  return null
}

function CustomerLayout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <CustomerThemeEffects />
      <div className="relative z-10 flex min-h-screen flex-col">
        <a
          className="skip-link"
          href="#content"
          onClick={(event) => {
            event.preventDefault()
            document.getElementById('content')?.focus()
          }}
        >
          تخطّي إلى المحتوى
        </a>
        <SiteHeader />
        <main id="content" tabIndex={-1} className="flex-1 outline-none">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/order" element={<OrderPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}

function AdminRoutes() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<AdminHomePage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailPage />} />
            <Route path="cakes" element={<AdminCakesPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="sizes" element={<AdminSizesPage />} />
            <Route path="fillings" element={<AdminFillingsPage />} />
            <Route path="extras" element={<AdminExtrasPage />} />
            <Route path="zones" element={<AdminZonesPage />} />
            <Route path="theme" element={<AdminThemePage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
          </Route>
        </Route>
        <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </AdminAuthProvider>
  )
}

function AppRoutes() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  if (isAdmin) return <AdminRoutes />
  return (
    <CatalogProvider>
      <ThemeProvider>
        <CustomerLayout />
      </ThemeProvider>
    </CatalogProvider>
  )
}

export function App() {
  return (
    <HashRouter>
      <ScrollManager />
      <AppRoutes />
    </HashRouter>
  )
}
