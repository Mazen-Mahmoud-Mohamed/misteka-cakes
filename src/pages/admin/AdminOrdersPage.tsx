import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader, adminSurfaceClass } from '@/components/admin/AdminCard'
import { AdminSelect, adminControlClass } from '@/components/admin/AdminField'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import { IconClose, IconOrders, IconRefresh, IconSearch } from '@/components/admin/icons'
import { OrdersCardList, OrdersTable } from '@/components/admin/OrderRows'
import { usePageTitle } from '@/hooks/usePageTitle'
import { listAdminOrders } from '@/services/admin/adminOrderService'
import type { AdminDateFilter, AdminOrder, AdminStatusFilter } from '@/types/admin'
import { STATUS_LABELS } from '@/types/admin'
import { cx } from '@/utils/cx'

const STATUS_OPTIONS: AdminStatusFilter[] = ['all', 'pending_review', 'confirmed', 'rejected', 'cancelled']
const DATE_OPTIONS: Array<{ value: AdminDateFilter; label: string }> = [
  { value: 'all', label: 'كل المواعيد' },
  { value: 'today', label: 'اليوم' },
  { value: 'tomorrow', label: 'غدًا' },
  { value: 'week', label: 'هذا الأسبوع' },
]

function readStatus(value: string | null): AdminStatusFilter {
  return STATUS_OPTIONS.includes(value as AdminStatusFilter) ? (value as AdminStatusFilter) : 'all'
}

function readDate(value: string | null): AdminDateFilter {
  return DATE_OPTIONS.some((o) => o.value === value) ? (value as AdminDateFilter) : 'all'
}

function countLabel(n: number): string {
  if (n === 1) return 'طلب واحد'
  if (n === 2) return 'طلبان'
  if (n >= 3 && n <= 10) return `${n} طلبات`
  return `${n} طلب`
}

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = readStatus(params.get('status'))
  const date = readDate(params.get('date'))
  const search = (params.get('q') ?? '').trim()

  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState(search)
  const [refreshing, setRefreshing] = useState(false)
  usePageTitle('الطلبات | مستكة')

  function setFilter(key: 'status' | 'date' | 'q', value: string) {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const result = await listAdminOrders({ status, date, search })
    if (result.error) {
      setError(result.error)
      setOrders([])
    } else {
      setError('')
      setOrders(result.orders)
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, date, search])

  const filtered = status !== 'all' || date !== 'all' || Boolean(search)

  function clearFilters() {
    setSearchInput('')
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="الطلبات"
        description="مراجعة طلبات العملاء وتأكيدها أو رفضها."
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

      <div className={cx(adminSurfaceClass, 'mb-4 grid gap-3 p-3 sm:p-4')}>
        <div role="group" aria-label="تصفية حسب الحالة" className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((option) => {
            const active = status === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter('status', option)}
                className={cx(
                  'inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-2.5 text-sm font-semibold sm:px-3 transition-colors duration-150 motion-reduce:transition-none',
                  active
                    ? 'border-rose-deep bg-rose-deep text-ivory'
                    : 'border-line bg-paper text-ink/80 hover:border-rose/40 hover:text-ink',
                )}
              >
                {option === 'all' ? 'الكل' : STATUS_LABELS[option]}
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setFilter('q', searchInput.trim())
            }}
          >
            <label htmlFor="filter-search" className="sr-only">
              بحث في الطلبات
            </label>
            <div className="relative min-w-0 flex-1">
              <IconSearch size={18} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted" />
              <input
                id="filter-search"
                type="search"
                enterKeyHint="search"
                placeholder="رقم الطلب أو الاسم أو الهاتف"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={cx(adminControlClass, 'min-h-11 ps-10')}
              />
            </div>
            <AdminButton type="submit" variant="primary">
              بحث
            </AdminButton>
          </form>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-date" className="shrink-0 text-sm font-semibold text-muted">
              الاستلام
            </label>
            <div className="min-w-0 flex-1">
              <AdminSelect id="filter-date" value={date} onChange={(e) => setFilter('date', e.target.value)}>
                {DATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </AdminSelect>
            </div>
          </div>
        </div>
      </div>

      {!loading && !error ? (
        <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {orders.length ? countLabel(orders.length) : 'لا توجد نتائج'}
            {search ? (
              <>
                {' '}
                لعبارة «<span className="font-semibold text-ink">{search}</span>»
              </>
            ) : null}
          </p>
          {filtered ? (
            <AdminButton size="sm" variant="ghost" icon={<IconClose size={16} />} onClick={clearFilters}>
              مسح التصفية
            </AdminButton>
          ) : null}
        </div>
      ) : null}

      {loading ? <AdminListSkeleton rows={6} label="جاري تحميل الطلبات" /> : null}

      {!loading && error ? (
        <AdminErrorState description={error} onRetry={() => void load(true)} retrying={refreshing} />
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        filtered ? (
          <AdminEmptyState
            icon={<IconSearch />}
            title="لا توجد طلبات مطابقة"
            description="جرّبي تغيير الحالة أو موعد الاستلام أو عبارة البحث."
            action={<AdminButton onClick={clearFilters}>مسح التصفية</AdminButton>}
          />
        ) : (
          <AdminEmptyState
            icon={<IconOrders />}
            title="لا توجد طلبات"
            description="ستظهر الطلبات هنا فور إرسالها من الموقع."
          />
        )
      ) : null}

      {!loading && !error && orders.length > 0 ? (
        <>
          <OrdersTable orders={orders} className="hidden md:block" />
          <OrdersCardList orders={orders} className="md:hidden" />
        </>
      ) : null}
    </AdminPage>
  )
}
