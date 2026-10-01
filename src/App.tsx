import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { RequireAdmin } from '@/components/admin/RequireAdmin'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AdminAuthProvider } from '@/providers/AdminAuthProvider'
import { CatalogProvider } from '@/providers/CatalogProvider'
import { AdminHomePage } from '@/pages/admin/AdminHomePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage'
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage'
import { AdminCakesPage } from '@/pages/admin/AdminCakesPage'
import { AdminSizesPage } from '@/pages/admin/AdminSizesPage'
import { AdminFillingsPage } from '@/pages/admin/AdminFillingsPage'
import { AdminExtrasPage } from '@/pages/admin/AdminExtrasPage'
import { AdminZonesPage } from '@/pages/admin/AdminZonesPage'
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
    <div className="flex min-h-screen flex-col">
      <a className="skip-link" href="#content">
        تخطّي إلى المحتوى
      </a>
      <SiteHeader />
      <main id="content" className="flex-1">
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
  )
}

function AdminRoutes() {
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
            <Route path="sizes" element={<AdminSizesPage />} />
            <Route path="fillings" element={<AdminFillingsPage />} />
            <Route path="extras" element={<AdminExtrasPage />} />
            <Route path="zones" element={<AdminZonesPage />} />
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
      <CustomerLayout />
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
