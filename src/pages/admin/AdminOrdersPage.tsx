import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminAlert } from '@/components/admin/AdminAlert'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { listAdminOrders } from '@/services/admin/adminOrderService'
import type { AdminDateFilter, AdminOrder, AdminStatusFilter } from '@/types/admin'
import { formatArabicDate, formatTimeLabel } from '@/utils/dates'
import { formatEgp } from '@/utils/format'

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<AdminStatusFilter>('all')
  const [date, setDate] = useState<AdminDateFilter>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [refreshing, setRefreshing] = useState(false)

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl text-rose-deep">الطلبات</h2>
          <p className="mt-2 text-muted">مراجعة وإدارة طلبات العملاء.</p>
        </div>
        <Button type="button" variant="ghost" disabled={loading || refreshing} onClick={() => void load(true)}>
          {refreshing ? 'جاري التحديث...' : 'تحديث'}
        </Button>
      </header>

      <div className="mb-6 grid gap-3 rounded-3xl border border-line bg-paper p-4 shadow-soft md:grid-cols-3">
        <SelectField
          id="filter-status"
          label="الحالة"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminStatusFilter)}
        >
          <option value="all">الكل</option>
          <option value="pending_review">قيد المراجعة</option>
          <option value="confirmed">مؤكد</option>
          <option value="rejected">مرفوض</option>
          <option value="cancelled">ملغي</option>
        </SelectField>
        <SelectField
          id="filter-date"
          label="تاريخ الاستلام"
          value={date}
          onChange={(e) => setDate(e.target.value as AdminDateFilter)}
        >
          <option value="all">كل الطلبات</option>
          <option value="today">اليوم</option>
          <option value="tomorrow">غدًا</option>
          <option value="week">هذا الأسبوع</option>
        </SelectField>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
          }}
        >
          <TextField
            id="filter-search"
            label="بحث"
            placeholder="رقم الطلب / الاسم / الموبايل"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
      </div>

      {error ? (
        <div className="mb-4">
          <AdminAlert tone="error">{error}</AdminAlert>
        </div>
      ) : null}
      {loading ? <p className="text-muted">جاري تحميل الطلبات...</p> : null}
      {!loading && !error && orders.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper p-10 text-center text-muted">
          لا توجد طلبات مطابقة للبحث.
        </p>
      ) : null}

      {!loading && !error && orders.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-line bg-paper shadow-soft lg:block">
            <table className="min-w-full text-sm">
              <thead className="border-b border-line bg-ivory/80 text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">رقم الطلب</th>
                  <th className="px-4 py-3 text-start font-semibold">العميل</th>
                  <th className="px-4 py-3 text-start font-semibold">تاريخ الاستلام</th>
                  <th className="px-4 py-3 text-start font-semibold">وقت الاستلام</th>
                  <th className="px-4 py-3 text-start font-semibold">المنطقة</th>
                  <th className="px-4 py-3 text-start font-semibold">التورتة</th>
                  <th className="px-4 py-3 text-start font-semibold">المقاس</th>
                  <th className="px-4 py-3 text-start font-semibold">الأفراد</th>
                  <th className="px-4 py-3 text-start font-semibold">الإجمالي</th>
                  <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-start font-semibold">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line/70 last:border-0 hover:bg-blush/20">
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${order.id}`} className="font-semibold text-rose-deep hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{order.customerName}</p>
                      <p className="text-xs text-muted" dir="ltr">
                        {order.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3">{formatArabicDate(order.date)}</td>
                    <td className="px-4 py-3">{formatTimeLabel(order.time)}</td>
                    <td className="px-4 py-3">{order.area ?? 'استلام'}</td>
                    <td className="px-4 py-3">{order.cakeName ?? 'تصميم مخصص'}</td>
                    <td className="px-4 py-3">{order.size}</td>
                    <td className="px-4 py-3">{order.servings}</td>
                    <td className="px-4 py-3">
                      {order.totalPrice == null ? 'يُحدَّد لاحقًا' : formatEgp(order.totalPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(order.createdAt),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 lg:hidden">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="block rounded-3xl border border-line bg-paper p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-rose-deep">{order.orderNumber}</p>
                      <p className="mt-1 text-sm text-muted">{order.customerName}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-3 text-sm text-ink">
                    {formatArabicDate(order.date)} · {formatTimeLabel(order.time)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {order.cakeName ?? 'تصميم مخصص'} · {order.size} · {order.servings} فرد
                  </p>
                  <p className="mt-2 font-semibold">
                    {order.totalPrice == null ? 'يُحدَّد لاحقًا' : formatEgp(order.totalPrice)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
