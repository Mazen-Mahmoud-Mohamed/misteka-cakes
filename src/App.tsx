import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
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

export function App() {
  return (
    <HashRouter>
      <ScrollManager />
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
    </HashRouter>
  )
}
