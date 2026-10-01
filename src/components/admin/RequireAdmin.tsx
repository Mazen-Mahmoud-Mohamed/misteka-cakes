import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AdminFullPageLoading } from '@/components/admin/AdminStates'
import { useAdminAuth } from '@/providers/AdminAuthProvider'

export function RequireAdmin() {
  const { loading, isAdmin } = useAdminAuth()
  const location = useLocation()

  if (loading) return <AdminFullPageLoading />

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
