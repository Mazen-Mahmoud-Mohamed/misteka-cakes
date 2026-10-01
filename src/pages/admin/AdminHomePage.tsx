import { useCallback, useEffect, useState } from 'react'
import { AdminButton, AdminButtonLink } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminStatCard } from '@/components/admin/AdminStatCard'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton, Skeleton } from '@/components/admin/AdminStates'
import {
  IconBan,
  IconCalendar,
  IconCheckCircle,
  IconChevronForward,
  IconClock,
  IconOrders,
  IconRefresh,
  IconXCircle,
} from '@/components/admin/icons'
import { OrdersCardList, OrdersTable } from '@/components/admin/OrderRows'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getAdminOrderStats, listAdminOrders } from '@/services/admin/adminOrderService'
import type { AdminOrder, AdminOrderStats } from '@/types/admin'

function share(part: number, total: number): string {
  if (!total) return 'لا توجد طلبات بعد'
  return `${Math.round((part / total) * 100)}% من الإجمالي`
}

function StatsSkeleton() {
  return (
    <div role="status" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <span className="sr-only">جاري تحميل الإحصاءات</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex min-h-[7.5rem] flex-col rounded-xl border border-line bg-paper p-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
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
  usePageTitle('لوحة التحكم | مستكة')

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
    <AdminPage>
      <AdminPageHeader
        title="الرئيسية"
        description="نظرة سريعة على طلبات مستكة وما يحتاج إلى مراجعة."
        actions={
          <AdminButton
            icon={<IconRefresh size={18} />}
            loading={refreshing}
            disabled={loading}
            onClick={() => void load(true)}
          >
            {refreshing ? 'جاري التحديث...' : 'تحديث'}
          </AdminButton>
        }
      />

      {loading ? (
        <>
          <StatsSkeleton />
          <div className="mt-8">
            <Skeleton className="mb-3 h-5 w-32" />
            <AdminListSkeleton rows={5} label="جاري تحميل أحدث الطلبات" />
          </div>
        </>
      ) : null}

      {!loading && error ? (
        <AdminErrorState description={error} onRetry={() => void load(true)} retrying={refreshing} />
      ) : null}

      {!loading && !error && stats ? (
        <>
          {stats.pendingReview > 0 ? (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gold/50 bg-gold-soft/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                <IconClock size={20} className="text-[#7a5622]" />
                {stats.pendingReview === 1
                  ? 'يوجد طلب واحد قيد المراجعة بانتظار قرارك.'
                  : `يوجد ${stats.pendingReview} طلبات قيد المراجعة بانتظار قرارك.`}
              </p>
              <AdminButtonLink
                to="/admin/orders?status=pending_review"
                size="sm"
                variant="primary"
                className="self-start sm:self-auto"
              >
                مراجعة الطلبات
                <IconChevronForward size={16} />
              </AdminButtonLink>
            </div>
          ) : null}

          <section aria-label="إحصاءات الطلبات" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <AdminStatCard
              label="إجمالي الطلبات"
              value={stats.total}
              hint="كل الطلبات المسجّلة"
              icon={<IconOrders size={18} />}
              tone="brand"
              to="/admin/orders"
            />
            <AdminStatCard
              label="قيد المراجعة"
              value={stats.pendingReview}
              hint={stats.pendingReview ? 'تحتاج إلى قرار' : 'لا يوجد ما يحتاج مراجعة'}
              icon={<IconClock size={18} />}
              tone="pending"
              highlight={stats.pendingReview > 0}
              to="/admin/orders?status=pending_review"
            />
            <AdminStatCard
              label="مؤكدة"
              value={stats.confirmed}
              hint={share(stats.confirmed, stats.total)}
              icon={<IconCheckCircle size={18} />}
              tone="success"
              to="/admin/orders?status=confirmed"
            />
            <AdminStatCard
              label="مرفوضة"
              value={stats.rejected}
              hint={share(stats.rejected, stats.total)}
              icon={<IconXCircle size={18} />}
              tone="danger"
              to="/admin/orders?status=rejected"
            />
            <AdminStatCard
              label="ملغاة"
              value={stats.cancelled}
              hint={share(stats.cancelled, stats.total)}
              icon={<IconBan size={18} />}
              tone="neutral"
              to="/admin/orders?status=cancelled"
            />
            <AdminStatCard
              label="طلبات اليوم"
              value={stats.today}
              hint="موعد استلامها اليوم"
              icon={<IconCalendar size={18} />}
              tone="default"
              to="/admin/orders?date=today"
            />
          </section>

          <section className="mt-8" aria-labelledby="recent-orders-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="recent-orders-title" className="text-base font-bold text-ink">
                أحدث الطلبات
              </h2>
              {recent.length ? (
                <AdminButtonLink to="/admin/orders" size="sm" variant="ghost">
                  عرض كل الطلبات
                  <IconChevronForward size={16} />
                </AdminButtonLink>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <AdminEmptyState
                icon={<IconOrders />}
                title="لا توجد طلبات"
                description="ستظهر هنا أحدث الطلبات فور وصولها من الموقع."
              />
            ) : (
              <>
                <OrdersTable orders={recent} compact className="hidden md:block" />
                <OrdersCardList orders={recent} compact className="md:hidden" />
              </>
            )}
          </section>
        </>
      ) : null}
    </AdminPage>
  )
}
