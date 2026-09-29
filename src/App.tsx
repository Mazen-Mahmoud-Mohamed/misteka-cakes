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
import { CatalogPage } from '@/pages/CatalogPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OrderPage } from '@/pages/OrderPage'

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
          <Route path="/order" element={<OrderPage />} />
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
