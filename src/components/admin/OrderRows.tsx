import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/admin/AdminBadge'
import { adminButtonClass } from '@/components/admin/AdminButton'
import { AdminList, AdminTable, Td, Th, Tr } from '@/components/admin/AdminTable'
import { IconChevronForward } from '@/components/admin/icons'
import type { AdminOrder } from '@/types/admin'
import { formatTimeLabel, parseISODate } from '@/utils/dates'
import { formatEgp } from '@/utils/format'

export function formatPickupDate(value: string): string {
  const date = parseISODate(value)
  if (!date) return value
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' }).format(date)
}

export function formatCreatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function orderTotalLabel(order: AdminOrder): string {
  return order.totalPrice == null ? 'يُحدَّد لاحقًا' : formatEgp(order.totalPrice)
}

function serviceLabel(order: AdminOrder): string {
  return order.serviceType === 'delivery' ? `توصيل · ${order.area ?? '—'}` : 'استلام'
}

function OrderLink({ order }: { order: AdminOrder }) {
  return (
    <Link
      to={`/admin/orders/${order.id}`}
      className="font-bold text-rose-deep tabular-nums hover:underline"
      dir="ltr"
    >
      {order.orderNumber}
    </Link>
  )
}

function ViewLink({ order }: { order: AdminOrder }) {
  return (
    <Link
      to={`/admin/orders/${order.id}`}
      className={adminButtonClass('secondary', 'sm')}
      aria-label={`عرض الطلب ${order.orderNumber}`}
    >
      عرض
      <IconChevronForward size={16} />
    </Link>
  )
}

/** Desktop orders table. `compact` drops the cake/service columns for the dashboard. */
export function OrdersTable({ orders, compact, className }: { orders: AdminOrder[]; compact?: boolean; className?: string }) {
  return (
    <AdminTable
      caption="قائمة الطلبات"
      className={className}
      head={
        <>
          <Th>رقم الطلب</Th>
          <Th>العميل</Th>
          <Th>موعد الاستلام</Th>
          {compact ? null : <Th className="hidden xl:table-cell">التورتة</Th>}
          <Th>الحالة</Th>
          <Th className="text-end">الإجمالي</Th>
          <Th>
            <span className="sr-only">إجراء</span>
          </Th>
        </>
      }
    >
      {orders.map((order) => (
        <Tr key={order.id}>
          <Td>
            <OrderLink order={order} />
            {compact ? null : <p className="mt-0.5 text-xs text-muted">{formatCreatedAt(order.createdAt)}</p>}
          </Td>
          <Td>
            <p className="font-semibold">{order.customerName}</p>
            <p className="text-xs text-muted" dir="ltr">
              <span className="inline-block">{order.phone}</span>
            </p>
          </Td>
          <Td>
            <p className="font-semibold whitespace-nowrap">{formatPickupDate(order.date)}</p>
            <p className="text-xs text-muted">
              {formatTimeLabel(order.time)}
              {compact ? null : ` · ${serviceLabel(order)}`}
            </p>
          </Td>
          {compact ? null : (
            <Td className="hidden xl:table-cell">
              <p className="font-semibold">{order.cakeName ?? 'تصميم مخصص'}</p>
              <p className="text-xs text-muted">
                {order.size} · {order.servings} فرد
              </p>
            </Td>
          )}
          <Td>
            <StatusBadge status={order.status} />
          </Td>
          <Td className="text-end font-bold whitespace-nowrap tabular-nums">{orderTotalLabel(order)}</Td>
          <Td className="w-px text-end">
            <ViewLink order={order} />
          </Td>
        </Tr>
      ))}
    </AdminTable>
  )
}

/** Stacked order cards for small screens. */
export function OrdersCardList({ orders, compact, className }: { orders: AdminOrder[]; compact?: boolean; className?: string }) {
  return (
    <AdminList label="قائمة الطلبات" className={className}>
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            to={`/admin/orders/${order.id}`}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-ivory/70 motion-reduce:transition-none"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <span className="font-bold text-rose-deep tabular-nums" dir="ltr">
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-ink">{order.customerName}</p>
              <p className="mt-0.5 text-[0.8125rem] text-muted">
                {formatPickupDate(order.date)} · {formatTimeLabel(order.time)}
              </p>
              {compact ? null : (
                <p className="mt-0.5 truncate text-[0.8125rem] text-muted">
                  {order.cakeName ?? 'تصميم مخصص'} · {order.size} · {order.servings} فرد
                </p>
              )}
              <p className="mt-1.5 text-sm font-bold text-ink tabular-nums">{orderTotalLabel(order)}</p>
            </div>
            <IconChevronForward size={18} className="text-muted" />
          </Link>
        </li>
      ))}
    </AdminList>
  )
}
