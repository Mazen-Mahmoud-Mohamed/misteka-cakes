import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AdminAlert, AdminToast, useFlash } from '@/components/admin/AdminAlert'
import { StatusBadge } from '@/components/admin/AdminBadge'
import { AdminButton, AdminButtonLink } from '@/components/admin/AdminButton'
import { AdminCard, AdminDetail, AdminDetailList, AdminPage, AdminPageHeader } from '@/components/admin/AdminCard'
import { AdminEmptyState, AdminErrorState, Skeleton } from '@/components/admin/AdminStates'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { AdminTextAreaField } from '@/components/admin/AdminField'
import {
  IconArrowBack,
  IconCake,
  IconExternal,
  IconFile,
  IconImage,
  IconOrders,
  IconReceipt,
  IconRefresh,
  IconTruck,
  IconUser,
  Spinner,
} from '@/components/admin/icons'
import { formatCreatedAt, formatPickupDate, orderTotalLabel } from '@/components/admin/OrderRows'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  getAdminOrder,
  getReferenceSignedUrl,
  updateOrderStatus,
} from '@/services/admin/adminOrderService'
import type { AdminOrder } from '@/types/admin'
import type { OrderStatus } from '@/types'
import { formatTimeLabel } from '@/utils/dates'
import { chargeAmountLabel } from '@/utils/format'
import { nextAdminStatuses, STATUS_LABELS } from '@/utils/orderStatus'

const DESIGN_MODE_LABELS: Record<AdminOrder['designMode'], string> = {
  catalog: 'من الكتالوج',
  similar: 'مشابه لتصميم',
  custom: 'تصميم مخصص',
}

function DetailSkeleton() {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <span className="sr-only">جاري تحميل الطلب</span>
      {[0, 1].map((col) => (
        <div key={col} className="grid content-start gap-4">
          {Array.from({ length: col ? 2 : 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-paper p-5">
              <Skeleton className="h-4 w-28" />
              <div className="mt-5 grid gap-3">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ))}
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
  const [imageLoading, setImageLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const { flash, setFlash, clearFlash } = useFlash()
  usePageTitle(order ? `الطلب ${order.orderNumber} | مستكة` : 'تفاصيل الطلب | مستكة')

  async function loadImage(path: string | null) {
    if (!path) {
      setImageUrl(null)
      setImageError('')
      return
    }
    setImageLoading(true)
    const signed = await getReferenceSignedUrl(path)
    setImageUrl(signed.url)
    setImageError(signed.error || '')
    setImageLoading(false)
  }

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
    await loadImage(result.order.referenceImage)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function openStatusDialog(next: OrderStatus) {
    setReason('')
    setReasonError('')
    setPendingStatus(next)
  }

  async function applyStatus(next: OrderStatus) {
    if (!order) return
    if (next === 'rejected' && reason.trim().length < 3) {
      setReasonError('اكتبي سبب الرفض (3 أحرف على الأقل). سيظهر السبب للعميل.')
      return
    }
    setBusy(true)
    setActionError('')
    const result = await updateOrderStatus(order.id, next, reason)
    setBusy(false)
    if (!result.ok) {
      if (result.code === 'reason_required' || result.code === 'reason_too_long') {
        setReasonError(result.message)
        return
      }
      setPendingStatus(null)
      setActionError(result.message)
      setFlash({ tone: 'error', text: result.message })
      return
    }
    setPendingStatus(null)
    setFlash({ tone: 'success', text: 'تم تحديث حالة الطلب بنجاح.' })
    await load()
  }

  const finalNote = 'هذه حالة نهائية ولا يمكن التراجع عنها من لوحة التحكم.'
  const nextStatuses = order ? nextAdminStatuses(order.status, order.serviceType) : []
  const forwardStatuses = nextStatuses.filter((s) => s !== 'rejected' && s !== 'cancelled')
  const confirmCopy = !pendingStatus
    ? null
    : pendingStatus === 'rejected'
      ? {
          title: 'رفض الطلب؟',
          body: `سيتم تغيير حالة الطلب إلى «مرفوض» وسيظهر سبب الرفض للعميل في صفحة متابعة الطلب. ${finalNote}`,
          label: 'رفض الطلب',
          danger: true,
        }
      : pendingStatus === 'cancelled'
        ? {
            title: 'إلغاء الطلب؟',
            body: `الحالة الحالية «${order ? STATUS_LABELS[order.status] : ''}». سيتم تغيير حالة الطلب إلى «ملغى». ${finalNote}`,
            label: 'إلغاء الطلب',
            danger: true,
          }
        : {
            title: `تغيير الحالة إلى «${STATUS_LABELS[pendingStatus]}»؟`,
            body:
              pendingStatus === 'delivered'
                ? `سيتم تسجيل الطلب كـ«تم التسليم». ${finalNote}`
                : `سيتم نقل الطلب من «${order ? STATUS_LABELS[order.status] : ''}» إلى «${STATUS_LABELS[pendingStatus]}»، ولا يمكن الرجوع للحالة السابقة.`,
            label: pendingStatus === 'confirmed' ? 'تأكيد الطلب' : `تغيير إلى «${STATUS_LABELS[pendingStatus]}»`,
          }

  const statusHint: Record<OrderStatus, string> = {
    pending_review: 'الطلب بانتظار مراجعتك. راجعي التفاصيل ثم أكّدي الطلب أو ارفضيه.',
    confirmed: 'الطلب مؤكد. ابدئي التجهيز عند الاستعداد، أو ألغيه عند الحاجة.',
    preparing: 'جاري تجهيز الطلب. يمكن إلغاؤه قبل بدء التصنيع فقط.',
    in_production: 'التورتة قيد التصنيع. الخطوة التالية: جاهز.',
    ready: order?.serviceType === 'delivery' ? 'الطلب جاهز. الخطوة التالية: خرج للتوصيل.' : 'الطلب جاهز للاستلام. سجّلي التسليم عند استلام العميل.',
    out_for_delivery: 'الطلب في الطريق للعميل. سجّلي التسليم عند الوصول.',
    delivered: 'تم تسليم الطلب. هذه حالة نهائية.',
    rejected: 'تم رفض الطلب. هذه حالة نهائية.',
    cancelled: order?.cancelledBy === 'customer' ? 'ألغى العميل هذا الطلب أثناء المراجعة. هذه حالة نهائية.' : 'تم إلغاء الطلب. هذه حالة نهائية.',
  }

  const notFound = !loading && error === 'الطلب غير موجود.'

  return (
    <AdminPage>
      <AdminButtonLink to="/admin/orders" size="sm" variant="ghost" className="-ms-3 mb-3" icon={<IconArrowBack size={16} />}>
        العودة إلى الطلبات
      </AdminButtonLink>

      {loading ? (
        <>
          <div className="mb-6 grid gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <DetailSkeleton />
        </>
      ) : null}

      {notFound ? (
        <AdminEmptyState
          icon={<IconOrders />}
          title="الطلب غير موجود"
          description="ربما تم إدخال رابط غير صحيح. ارجعي إلى قائمة الطلبات للبحث عنه."
          action={<AdminButtonLink to="/admin/orders">قائمة الطلبات</AdminButtonLink>}
        />
      ) : null}

      {!loading && error && !notFound ? <AdminErrorState description={error} onRetry={() => void load()} /> : null}

      {!loading && order ? (
        <>
          <AdminPageHeader
            title={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>تفاصيل الطلب</span>
                <span className="text-rose-deep tabular-nums" dir="ltr">
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.status} className="h-8 px-3 text-sm" />
              </span>
            }
            description={`أُنشئ في ${formatCreatedAt(order.createdAt)}`}
          />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <aside className="grid gap-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1" aria-label="الحالة والعميل">
              <AdminCard title="حالة الطلب" icon={<IconOrders size={18} />}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">الحالة الحالية</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-3 text-[0.8125rem] leading-6 text-muted">{statusHint[order.status]}</p>

                {order.status === 'rejected' && order.rejectionReason ? (
                  <div className="mt-3 rounded-lg border border-rose/30 bg-blush/40 px-3 py-2.5 text-sm leading-6 text-ink">
                    <span className="font-semibold text-rose-deep">سبب الرفض: </span>
                    {order.rejectionReason}
                  </div>
                ) : null}

                {actionError ? (
                  <AdminAlert tone="error" className="mt-3">
                    {actionError}
                  </AdminAlert>
                ) : null}

                {nextStatuses.length ? (
                  <div className="mt-4 grid gap-2" role="group" aria-label="الحالات التالية المتاحة">
                    <p className="text-xs font-semibold text-muted">الحالة التالية</p>
                    {forwardStatuses.map((next) => (
                      <AdminButton key={next} variant="primary" disabled={busy} onClick={() => openStatusDialog(next)}>
                        {next === 'confirmed' ? 'تأكيد الطلب' : `تغيير إلى «${STATUS_LABELS[next]}»`}
                      </AdminButton>
                    ))}
                    {nextStatuses.includes('rejected') ? (
                      <AdminButton variant="dangerOutline" disabled={busy} onClick={() => openStatusDialog('rejected')}>
                        رفض الطلب
                      </AdminButton>
                    ) : null}
                    {nextStatuses.includes('cancelled') ? (
                      <AdminButton
                        variant={order.status === 'pending_review' ? 'ghost' : 'dangerOutline'}
                        disabled={busy}
                        onClick={() => openStatusDialog('cancelled')}
                      >
                        إلغاء الطلب
                      </AdminButton>
                    ) : null}
                  </div>
                ) : null}
              </AdminCard>

              <AdminCard title="العميل" icon={<IconUser size={18} />}>
                <AdminDetailList>
                  <AdminDetail label="الاسم">{order.customerName || '—'}</AdminDetail>
                  <AdminDetail label="رقم الهاتف">
                    {order.phone ? (
                      <a
                        href={`tel:${order.phone}`}
                        dir="ltr"
                        className="-my-3 inline-flex min-h-11 items-center text-rose-deep tabular-nums hover:underline"
                      >
                        {order.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </AdminDetail>
                </AdminDetailList>
              </AdminCard>

              <AdminCard title="ملخص الطلب" icon={<IconReceipt size={18} />}>
                <AdminDetailList>
                  <AdminDetail label="رقم الطلب" ltr>
                    {order.orderNumber}
                  </AdminDetail>
                  <AdminDetail label="تاريخ الإنشاء">{formatCreatedAt(order.createdAt)}</AdminDetail>
                  <AdminDetail label="الإجمالي">
                    <span className="text-base tabular-nums">{orderTotalLabel(order)}</span>
                  </AdminDetail>
                </AdminDetailList>
              </AdminCard>
            </aside>

            <div className="grid min-w-0 gap-4 lg:col-start-1 lg:row-start-1">
              <AdminCard title="التورتة" icon={<IconCake size={18} />}>
                <AdminDetailList>
                  <AdminDetail label="التصميم">{order.cakeName ?? 'تصميم مخصص'}</AdminDetail>
                  <AdminDetail label="نوع التصميم">{DESIGN_MODE_LABELS[order.designMode] ?? '—'}</AdminDetail>
                  <AdminDetail label="المقاس">{order.size || '—'}</AdminDetail>
                  <AdminDetail label="عدد الأفراد">{`${order.servings} فرد`}</AdminDetail>
                  <AdminDetail label="الحشوة">{order.filling || '—'}</AdminDetail>
                  <AdminDetail label="الإضافات">
                    {order.extras.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {order.extras.map((extra) => (
                          <span key={extra.id || extra.name} className="rounded-md border border-line bg-ivory px-2 py-0.5 text-[0.8125rem]">
                            {extra.name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      'بدون'
                    )}
                  </AdminDetail>
                </AdminDetailList>
              </AdminCard>

              <AdminCard title="التوصيل والموعد" icon={<IconTruck size={18} />}>
                <AdminDetailList>
                  <AdminDetail label="الخدمة">{order.serviceType === 'delivery' ? 'توصيل' : 'استلام'}</AdminDetail>
                  <AdminDetail label="المنطقة">{order.area ?? 'استلام'}</AdminDetail>
                  <AdminDetail label="تفاصيل العنوان">{order.addressNotes || 'غير متوفرة'}</AdminDetail>
                  <AdminDetail label="تاريخ الاستلام">{formatPickupDate(order.date)}</AdminDetail>
                  <AdminDetail label="وقت الاستلام">{formatTimeLabel(order.time)}</AdminDetail>
                </AdminDetailList>
              </AdminCard>

              <AdminCard title="التصميم والملاحظات" icon={<IconFile size={18} />}>
                <p className="text-sm leading-7 whitespace-pre-wrap text-ink">
                  {order.notes || <span className="text-muted">لا توجد ملاحظات.</span>}
                </p>
              </AdminCard>

              <AdminCard
                title="الصورة المرجعية"
                description={order.referenceImage ? 'ملف خاص يُعرض برابط مؤقت لمدة دقيقتين.' : undefined}
                icon={<IconImage size={18} />}
                actions={
                  order.referenceImage ? (
                    <AdminButton
                      size="sm"
                      variant="ghost"
                      icon={<IconRefresh size={16} />}
                      loading={imageLoading}
                      onClick={() => void loadImage(order.referenceImage)}
                    >
                      تحديث الرابط
                    </AdminButton>
                  ) : null
                }
              >
                {!order.referenceImage ? (
                  <p className="text-sm text-muted">لا توجد صورة مرجعية محفوظة لهذا الطلب.</p>
                ) : imageLoading && !imageUrl ? (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted">
                    <Spinner /> جاري تجهيز عرض الصورة...
                  </p>
                ) : imageError ? (
                  <AdminAlert tone="error">{imageError}</AdminAlert>
                ) : imageUrl ? (
                  <div className="grid gap-3">
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-line bg-ivory"
                    >
                      <img
                        src={imageUrl}
                        alt="الصورة المرجعية للطلب"
                        className="mx-auto max-h-96 w-auto object-contain"
                        onError={() => setImageError('انتهت صلاحية رابط الصورة. اضغطي «تحديث الرابط».')}
                      />
                    </a>
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold text-rose-deep hover:underline"
                    >
                      <IconExternal size={16} />
                      فتح الصورة في نافذة جديدة
                    </a>
                  </div>
                ) : null}
              </AdminCard>

              <AdminCard title="تفصيل السعر" description="لقطة الأسعار وقت إرسال الطلب." icon={<IconReceipt size={18} />}>
                {order.priceLines.length === 0 ? (
                  <p className="text-sm text-muted">لا توجد بنود سعر محفوظة.</p>
                ) : (
                  <ul className="divide-y divide-line/70">
                    {order.priceLines.map((line) => (
                      <li key={line.id} className="flex items-start justify-between gap-4 py-2.5 first:pt-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{line.label}</p>
                          {line.note ? <p className="text-xs leading-6 text-muted">{line.note}</p> : null}
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                          {chargeAmountLabel(line.status, line.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3">
                  <p className="text-sm font-bold text-ink">الإجمالي</p>
                  <p className="text-base font-bold text-rose-deep tabular-nums">{orderTotalLabel(order)}</p>
                </div>
                {order.pendingCharges.length ? (
                  <p className="mt-2 text-[0.8125rem] leading-6 text-muted">بنود معلّقة: {order.pendingCharges.join('، ')}</p>
                ) : null}
              </AdminCard>
            </div>
          </div>
        </>
      ) : null}

      {confirmCopy && pendingStatus ? (
        <ConfirmDialog
          open
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.label}
          cancelLabel="تراجع"
          danger={Boolean(confirmCopy.danger)}
          busy={busy}
          onCancel={() => setPendingStatus(null)}
          onConfirm={() => void applyStatus(pendingStatus)}
        >
          {pendingStatus === 'rejected' ? (
            <AdminTextAreaField
              id="rejection-reason"
              label="سبب الرفض"
              hint="سيظهر هذا السبب للعميل كما هو."
              required
              rows={3}
              maxLength={500}
              value={reason}
              error={reasonError || undefined}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError('')
              }}
            />
          ) : null}
        </ConfirmDialog>
      ) : null}

      <AdminToast flash={flash} onClose={clearFlash} />
    </AdminPage>
  )
}
