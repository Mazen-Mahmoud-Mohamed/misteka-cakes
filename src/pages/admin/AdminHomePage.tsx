import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/Button'
import { getAdminOrderStats, listAdminOrders } from '@/services/admin/adminOrderService'
import type { AdminOrder, AdminOrderStats } from '@/types/admin'
import { formatArabicDate, formatTimeLabel } from '@/utils/dates'
import { formatEgp } from '@/utils/format'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl text-rose-deep">{value}</p>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-3xl border border-line bg-paper" />
      ))}
    </div>
  )
}

export function AdminHomePage() {
  const [stats, setStats] = useState<AdminOrderStats | null>(null)
  const [recent, setRecent] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const [statsRes, recentRes] = await Promise.all([
      getAdminOrderStats(),
      listAdminOrders({ limit: 8 }),
    ])
    if (statsRes.error || recentRes.error) {
      setError(statsRes.error || recentRes.error || 'حدث خطأ.')
      setStats(null)
      setRecent([])
    } else {
      setError('')
      setStats(statsRes.stats)
      setRecent(recentRes.orders)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl text-rose-deep">الرئيسية</h2>
          <p className="mt-2 text-muted">نظرة سريعة على طلبات مستيكا.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={loading || refreshing}
          onClick={() => void load(true)}
        >
          {refreshing ? 'جاري التحديث...' : 'تحديث'}
        </Button>
      </header>

      {error ? <div className="mb-4"><AdminAlert tone="error">{error}</AdminAlert></div> : null}

      {loading ? <StatSkeleton /> : null}

      {!loading && !error && stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="إجمالي الطلبات" value={stats.total} />
            <StatCard label="الطلبات قيد المراجعة" value={stats.pendingReview} />
            <StatCard label="الطلبات المؤكدة" value={stats.confirmed} />
            <StatCard label="الطلبات المرفوضة" value={stats.rejected} />
            <StatCard label="الطلبات الملغاة" value={stats.cancelled} />
            <StatCard label="طلبات اليوم (موعد الاستلام)" value={stats.today} />
          </div>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl text-rose-deep">أحدث الطلبات</h3>
              <Link to="/admin/orders" className="text-sm font-semibold text-rose-deep hover:underline">
                عرض الكل
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-muted">
                لا توجد طلبات حتى الآن.
              </p>
            ) : (
              <ul className="grid gap-3">
                {recent.map((order) => (
                  <li key={order.id}>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="flex flex-col gap-2 rounded-3xl border border-line bg-paper px-5 py-4 shadow-soft transition hover:border-gold sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-ink">{order.orderNumber}</p>
                        <p className="mt-1 text-sm text-muted">
                          {order.customerName} · {formatArabicDate(order.date)} · {formatTimeLabel(order.time)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {order.totalPrice == null ? 'يُحدَّد لاحقًا' : formatEgp(order.totalPrice)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
