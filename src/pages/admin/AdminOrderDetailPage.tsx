import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/Button'
import {
  getAdminOrder,
  getReferenceSignedUrl,
  updateOrderStatus,
} from '@/services/admin/adminOrderService'
import type { AdminOrder } from '@/types/admin'
import type { OrderStatus } from '@/types'
import { formatArabicDate, formatTimeLabel } from '@/utils/dates'
import { chargeAmountLabel, formatEgp } from '@/utils/format'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h3 className="font-display text-2xl text-rose-deep">{title}</h3>
      <div className="mt-4 grid gap-3 text-sm leading-7">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value || '—'}</dd>
    </div>
  )
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState('')
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null)

  async function load() {
    setLoading(true)
    const result = await getAdminOrder(id)
    if (result.error || !result.order) {
      setError(result.error || 'الطلب غير موجود.')
      setOrder(null)
      setLoading(false)
      return
    }
    setOrder(result.order)
    setError('')
    setLoading(false)

    if (result.order.referenceImage) {
      const signed = await getReferenceSignedUrl(result.order.referenceImage)
      setImageUrl(signed.url)
      setImageError(signed.error || '')
    } else {
      setImageUrl(null)
      setImageError('')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function applyStatus(next: OrderStatus) {
    if (!order) return
    setBusy(true)
    setActionError('')
    const result = await updateOrderStatus(order.id, next)
    setBusy(false)
    setPendingStatus(null)
    if (!result.ok) {
      setActionError(result.message)
      return
    }
    await load()
  }

  const confirmCopy =
    pendingStatus === 'confirmed'
      ? { title: 'تأكيد الطلب', body: 'هل أنت متأكد من تأكيد هذا الطلب؟', label: 'تأكيد الطلب' }
      : pendingStatus === 'rejected'
        ? { title: 'رفض الطلب', body: 'هل أنت متأكد من رفض هذا الطلب؟', label: 'رفض الطلب', danger: true }
        : pendingStatus === 'cancelled'
          ? { title: 'إلغاء الطلب', body: 'هل أنت متأكد من إلغاء هذا الطلب المؤكد؟', label: 'إلغاء الطلب', danger: true }
          : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/admin/orders" className="text-sm font-semibold text-rose-deep hover:underline">
        ← العودة للطلبات
      </Link>

      {loading ? <p className="mt-6 text-muted">جاري تحميل الطلب...</p> : null}
      {error ? (
        <p role="alert" className="mt-6 text-rose-deep">
          {error}
        </p>
      ) : null}

      {!loading && order ? (
        <>
          <header className="mt-4 mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gold">{order.orderNumber}</p>
              <h2 className="mt-1 font-display text-4xl text-rose-deep">تفاصيل الطلب</h2>
              <p className="mt-2 text-sm text-muted">
                أُنشئ{' '}
                {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(order.createdAt),
                )}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </header>

          <div className="grid gap-4">
            <Section title="بيانات العميل">
              <dl className="grid gap-3">
                <Row label="الاسم" value={order.customerName} />
                <Row label="رقم الهاتف" value={order.phone} />
                <Row label="الخدمة" value={order.serviceType === 'delivery' ? 'توصيل' : 'استلام'} />
                <Row label="المنطقة" value={order.area ?? 'استلام'} />
                <Row label="تفاصيل التوصيل" value={order.addressNotes || 'غير متوفرة'} />
              </dl>
            </Section>

            <Section title="موعد الاستلام">
              <dl className="grid gap-3">
                <Row label="التاريخ" value={formatArabicDate(order.date)} />
                <Row label="الوقت" value={formatTimeLabel(order.time)} />
              </dl>
            </Section>

            <Section title="تفاصيل التورتة">
              <dl className="grid gap-3">
                <Row label="التورتة" value={order.cakeName ?? 'تصميم مخصص'} />
                <Row label="المقاس" value={order.size} />
                <Row label="عدد الأفراد" value={`${order.servings} فرد`} />
                <Row label="الحشوة" value={order.filling || '—'} />
                <Row
                  label="الإضافات"
                  value={order.extras.length ? order.extras.map((e) => e.name).join('، ') : 'بدون'}
                />
                <Row
                  label="وضع التصميم"
                  value={
                    order.designMode === 'catalog'
                      ? 'من الكتالوج'
                      : order.designMode === 'similar'
                        ? 'مشابه'
                        : 'مخصص'
                  }
                />
              </dl>
            </Section>

            <Section title="التصميم والملاحظات">
              <p className="whitespace-pre-wrap text-ink">{order.notes || 'لا توجد ملاحظات.'}</p>
            </Section>

            <Section title="الصورة المرجعية">
              {!order.referenceImage ? (
                <p className="text-muted">لا توجد صورة مرجعية محفوظة لهذا الطلب.</p>
              ) : imageError ? (
                <p className="text-rose-deep">{imageError}</p>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="الصورة المرجعية للطلب"
                  className="max-h-80 rounded-2xl border border-line object-contain"
                />
              ) : (
                <p className="text-muted">جاري تجهيز عرض الصورة...</p>
              )}
              {order.referenceImage ? (
                <p className="mt-2 text-xs text-muted" dir="ltr">
                  مسار خاص (غير عام)
                </p>
              ) : null}
            </Section>

            <Section title="تفصيل السعر (لقطة الطلب)">
              {order.priceLines.length === 0 ? (
                <p className="text-muted">لا توجد بنود سعر محفوظة.</p>
              ) : (
                <ul className="grid gap-2">
                  {order.priceLines.map((line) => (
                    <li key={line.id} className="flex items-start justify-between gap-4 border-b border-line/60 py-2">
                      <div>
                        <p className="font-semibold">{line.label}</p>
                        {line.note ? <p className="text-xs text-muted">{line.note}</p> : null}
                      </div>
                      <p className="shrink-0 font-semibold">{chargeAmountLabel(line.status, line.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-gold/40 pt-4">
                <p className="font-display text-xl text-rose-deep">الإجمالي</p>
                <p className="font-semibold text-ink">
                  {order.totalPrice == null ? 'يُحدَّد لاحقًا' : formatEgp(order.totalPrice)}
                </p>
              </div>
              {order.pendingCharges.length ? (
                <p className="mt-2 text-sm text-muted">بنود معلّقة: {order.pendingCharges.join('، ')}</p>
              ) : null}
            </Section>
          </div>

          {actionError ? (
            <p role="alert" className="mt-6 text-rose-deep">
              {actionError}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {order.status === 'pending_review' ? (
              <>
                <Button type="button" disabled={busy} onClick={() => setPendingStatus('confirmed')}>
                  تأكيد الطلب
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setPendingStatus('rejected')}>
                  رفض الطلب
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setPendingStatus('cancelled')}>
                  إلغاء الطلب
                </Button>
              </>
            ) : null}
            {order.status === 'confirmed' ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setPendingStatus('cancelled')}>
                إلغاء الطلب المؤكد
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {confirmCopy && pendingStatus ? (
        <ConfirmDialog
          open
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.label}
          danger={Boolean(confirmCopy.danger)}
          busy={busy}
          onCancel={() => setPendingStatus(null)}
          onConfirm={() => void applyStatus(pendingStatus)}
        />
      ) : null}
    </div>
  )
}
