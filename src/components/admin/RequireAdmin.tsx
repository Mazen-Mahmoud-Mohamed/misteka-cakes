import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/providers/AdminAuthProvider'

export function RequireAdmin() {
  const { loading, isAdmin } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory text-muted">
        جاري التحقق من الجلسة...
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
