import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Container } from '@/components/layout/Container'
import { OrderReviewForm } from '@/components/tracking/OrderReviewForm'
import { OrderTimeline } from '@/components/tracking/OrderTimeline'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { socialLinks } from '@/data/socialLinks'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  cancelTrackedOrder,
  getTrackedOrder,
  lookupOrdersByPhone,
  normalizeTrackingPhone,
  type TrackedOrder,
  type TrackedOrderSummary,
} from '@/services/trackingService'
import type { DesignMode, OrderStatus } from '@/types'
import { formatArabicDate, formatTimeLabel } from '@/utils/dates'
import { formatEgp } from '@/utils/format'
import { STATUS_LABELS } from '@/utils/orderStatus'
import { isEgyptianMobile } from '@/utils/phone'
import { cx } from '@/utils/cx'

const DESIGN_MODE_LABELS: Record<DesignMode, string> = {
  catalog: 'من الكتالوج',
  similar: 'مشابه لتصميم',
  custom: 'تصميم مخصص',
}

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_review: 'border-gold/50 bg-gold-soft/35 text-[#7a5622]',
  confirmed: 'border-line bg-ivory text-ink',
  preparing: 'border-line bg-ivory text-ink',
  in_production: 'border-line bg-ivory text-ink',
  ready: 'border-line bg-ivory text-ink',
  out_for_delivery: 'border-line bg-ivory text-ink',
  delivered: 'border-sage/45 bg-sage/12 text-sage-deep',
  rejected: 'border-rose/35 bg-blush/70 text-rose-deep',
  cancelled: 'border-line bg-cream/70 text-muted',
}

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-bold whitespace-nowrap',
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function formatCreated(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function cakeLabel(order: { cakeName: string | null; designMode: DesignMode }): string {
  return order.cakeName ?? DESIGN_MODE_LABELS[order.designMode] ?? 'تصميم مخصص'
}

function totalLabel(order: TrackedOrder): string {
  if (order.totalPrice == null) return 'يُحدَّد بعد المراجعة'
  return order.pendingCharges.length ? `${formatEgp(order.totalPrice)} + بنود تُحدَّد لاحقًا` : formatEgp(order.totalPrice)
}

function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-3xl border border-line/80 bg-paper p-5 sm:p-7', className)}>
      {title ? <h2 className="mb-4 font-display text-2xl text-rose-deep">{title}</h2> : null}
      {children}
    </section>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line/70 py-3 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-[0.9375rem] font-semibold break-words text-ink">{children}</dd>
    </div>
  )
}

function Message({
  tone = 'neutral',
  title,
  children,
  role,
}: {
  tone?: 'neutral' | 'error' | 'success'
  title: string
  children?: ReactNode
  role?: 'alert' | 'status'
}) {
  return (
    <div
      role={role}
      className={cx(
        'rounded-2xl border px-5 py-4 text-sm leading-7',
        tone === 'error' && 'border-rose/35 bg-blush/50 text-ink',
        tone === 'success' && 'border-sage/45 bg-sage/10 text-ink',
        tone === 'neutral' && 'border-dashed border-line bg-paper text-ink',
      )}
    >
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="mt-1 text-muted">{children}</div> : null}
    </div>
  )
}

function CancelDialog({
  open,
  orderNumber,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  orderNumber: string
  busy: boolean
  error: string
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="cancel-title"
      aria-describedby="cancel-body"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-paper p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="grid gap-4 p-6">
        <h2 id="cancel-title" className="font-display text-2xl text-rose-deep">
          إلغاء الطلب؟
        </h2>
        <p id="cancel-body" className="text-sm leading-7 text-muted">
          سيتم إلغاء الطلب <span dir="ltr" className="font-semibold text-ink tabular-nums">{orderNumber}</span> نهائيًا وإتاحة
          موعده لعملاء آخرين. لا يمكن إعادة فتح الطلب بعد الإلغاء، وستحتاجين إلى طلب جديد.
        </p>
        {error ? (
          <p role="alert" className="rounded-2xl border border-rose/35 bg-blush/50 px-4 py-3 text-sm leading-6 text-rose-deep">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            تراجع
          </Button>
          <Button disabled={busy} onClick={onConfirm} aria-busy={busy}>
            {busy ? 'جارٍ الإلغاء...' : 'نعم، ألغي الطلب'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

function OrderDetails({
  order,
  phone,
  onBack,
  onChanged,
}: {
  order: TrackedOrder
  phone: string
  onBack: () => void
  onChanged: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [justCancelled, setJustCancelled] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  async function confirmCancel() {
    setBusy(true)
    setCancelError('')
    const result = await cancelTrackedOrder(phone, order.orderNumber)
    setBusy(false)
    if (!result.ok) {
      setCancelError(result.message)
      if (result.code === 'not_cancellable') await onChanged()
      return
    }
    setConfirming(false)
    setJustCancelled(true)
    await onChanged()
  }

  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 justify-self-start rounded-full px-3 -ms-3 text-sm font-semibold text-rose-deep hover:bg-blush"
      >
        <span aria-hidden="true">→</span> العودة إلى طلباتي
      </button>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">رقم الطلب</p>
            <h2 ref={headingRef} tabIndex={-1} dir="ltr" className="text-end font-display text-3xl text-rose-deep tabular-nums outline-none">
              {order.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-muted">تاريخ الطلب: {formatCreated(order.createdAt)}</p>
          </div>
          <StatusPill status={order.status} />
        </div>

        <div className="mt-5 grid gap-3" aria-live="polite">
          {justCancelled && order.status === 'cancelled' ? (
            <Message tone="success" title="تم إلغاء الطلب بنجاح." role="status">
              تم إلغاء طلبك ولن يتم تنفيذه. يسعدنا استقبال طلب جديد في أي وقت.
            </Message>
          ) : null}
          {order.status === 'rejected' ? (
            <Message tone="error" title="تم رفض الطلب">
              {order.rejectionReason ? <>السبب: {order.rejectionReason}</> : 'تواصلي معنا عبر واتساب لمعرفة التفاصيل.'}
            </Message>
          ) : null}
          {order.status === 'cancelled' && !justCancelled ? (
            <Message title="تم إلغاء الطلب">
              {order.cancelledBy === 'customer' ? 'تم إلغاء هذا الطلب بناءً على طلبك.' : 'تم إلغاء هذا الطلب. تواصلي معنا عبر واتساب لأي استفسار.'}
            </Message>
          ) : null}
          {order.status === 'delivered' ? (
            <Message tone="success" title="تم تسليم الطلب">
              نتمنى أن تكون التورتة قد أسعدتكم. شكرًا لاختياركم مستكة.
            </Message>
          ) : null}
          {order.status === 'pending_review' ? (
            <Message title="طلبك قيد المراجعة">
              سنراجع التفاصيل ونتواصل معكِ لتأكيد الطلب. يمكنك إلغاء الطلب طالما أنه قيد المراجعة فقط.
            </Message>
          ) : null}
        </div>
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-5">
          <Panel title="التورتة">
            <dl>
              <DetailRow label="التصميم">{cakeLabel(order)}</DetailRow>
              <DetailRow label="نوع التصميم">{DESIGN_MODE_LABELS[order.designMode] ?? '—'}</DetailRow>
              <DetailRow label="المقاس">{order.size || '—'}</DetailRow>
              <DetailRow label="عدد الأفراد">{`${order.servings} فرد`}</DetailRow>
              <DetailRow label="الحشوة">{order.filling || '—'}</DetailRow>
              <DetailRow label="الإضافات">{order.extras.length ? order.extras.join('، ') : 'بدون'}</DetailRow>
            </dl>
          </Panel>

          <Panel title="الاستلام">
            <dl>
              <DetailRow label="الخدمة">{order.serviceType === 'delivery' ? 'توصيل' : 'استلام من المحل'}</DetailRow>
              {order.serviceType === 'delivery' ? <DetailRow label="منطقة التوصيل">{order.area ?? '—'}</DetailRow> : null}
              <DetailRow label="التاريخ">{formatArabicDate(order.date)}</DetailRow>
              <DetailRow label="الوقت">{formatTimeLabel(order.time)}</DetailRow>
              <DetailRow label="الإجمالي الحالي">
                <span className="tabular-nums">{totalLabel(order)}</span>
              </DetailRow>
            </dl>
            {order.serviceType === 'delivery' ? (
              <p className="mt-3 text-xs leading-6 text-muted">التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.</p>
            ) : null}
          </Panel>
        </div>

        <Panel title="مراحل الطلب" className="order-first lg:sticky lg:top-24 lg:order-none">
          <OrderTimeline status={order.status} serviceType={order.serviceType} events={order.events} />
        </Panel>
      </div>

      {order.status === 'delivered' ? (
        <OrderReviewForm phone={phone} orderNumber={order.orderNumber} enabled />
      ) : null}

      {order.canCancel ? (
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-7 text-muted">تريدين إلغاء الطلب؟ الإلغاء متاح فقط قبل تأكيد الطلب، ولا يمكن التراجع عنه.</p>
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() => {
                setCancelError('')
                setConfirming(true)
              }}
            >
              إلغاء الطلب
            </Button>
          </div>
        </Panel>
      ) : !['cancelled', 'rejected', 'delivered'].includes(order.status) ? (
        <p className="text-sm leading-7 text-muted">
          لا يمكن تعديل الطلب أو إلغاؤه بعد تأكيده. لأي استفسار{' '}
          <a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-rose-deep underline-offset-4 hover:underline">
            تواصلي معنا عبر واتساب
          </a>
          .
        </p>
      ) : null}

      <CancelDialog
        open={confirming}
        orderNumber={order.orderNumber}
        busy={busy}
        error={cancelError}
        onConfirm={() => void confirmCancel()}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

function OrdersList({
  orders,
  onOpen,
  openingNumber,
}: {
  orders: TrackedOrderSummary[]
  onOpen: (orderNumber: string) => void
  openingNumber: string
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted" role="status">
        {orders.length === 1 ? 'وجدنا طلبًا واحدًا بهذا الرقم.' : `وجدنا ${orders.length} طلبات بهذا الرقم.`}
      </p>
      <ul className="grid gap-3">
        {orders.map((order) => (
          <li key={order.orderNumber}>
            <button
              type="button"
              onClick={() => onOpen(order.orderNumber)}
              disabled={Boolean(openingNumber)}
              aria-label={`عرض تفاصيل الطلب ${order.orderNumber}`}
              className="grid w-full cursor-pointer gap-2 rounded-3xl border border-line/80 bg-paper p-5 text-start transition duration-200 hover:border-rose/40 disabled:cursor-wait motion-reduce:transition-none"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span dir="ltr" className="font-display text-xl text-rose-deep tabular-nums">
                  {order.orderNumber}
                </span>
                <StatusPill status={order.status} />
              </span>
              <span className="text-[0.9375rem] font-semibold text-ink">
                {cakeLabel(order)}
                {order.size ? ` · ${order.size}` : ''}
              </span>
              <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
                <span>طُلب في {formatCreated(order.createdAt)}</span>
                <span>الموعد: {formatArabicDate(order.date)}</span>
              </span>
              <span className="text-sm font-semibold text-rose-deep">
                {openingNumber === order.orderNumber ? 'جارٍ فتح التفاصيل...' : 'عرض التفاصيل ←'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

type View =
  | { name: 'idle' }
  | { name: 'loading' }
  | { name: 'list'; orders: TrackedOrderSummary[] }
  | { name: 'empty' }
  | { name: 'error'; message: string }
  | { name: 'details'; order: TrackedOrder; orders: TrackedOrderSummary[] }

export function TrackOrderPage() {
  usePageTitle('متابعة الطلب | مستكة')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [view, setView] = useState<View>({ name: 'idle' })
  const [opening, setOpening] = useState('')
  const [detailError, setDetailError] = useState('')

  async function search(targetPhone: string) {
    setView({ name: 'loading' })
    setDetailError('')
    const result = await lookupOrdersByPhone(targetPhone)
    if (!result.ok) {
      setView({ name: 'error', message: result.message })
      return []
    }
    setView(result.orders.length ? { name: 'list', orders: result.orders } : { name: 'empty' })
    return result.orders
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizeTrackingPhone(phoneInput)
    if (!isEgyptianMobile(normalized)) {
      setPhoneError('اكتبي رقم الموبايل المصري الذي استخدمتِه في الطلب (11 رقمًا يبدأ بـ 01).')
      return
    }
    setPhoneError('')
    setPhone(normalized)
    await search(normalized)
  }

  async function openOrder(orderNumber: string, orders: TrackedOrderSummary[]) {
    setOpening(orderNumber)
    setDetailError('')
    const result = await getTrackedOrder(phone, orderNumber)
    setOpening('')
    if (!result.ok) {
      setDetailError(result.message)
      return
    }
    setView({ name: 'details', order: result.order, orders })
    window.scrollTo({ top: 0 })
  }

  async function refreshDetails(orderNumber: string) {
    const [listResult, detailResult] = await Promise.all([
      lookupOrdersByPhone(phone),
      getTrackedOrder(phone, orderNumber),
    ])
    if (detailResult.ok) {
      setView({ name: 'details', order: detailResult.order, orders: listResult.ok ? listResult.orders : [] })
    }
  }

  const currentOrders = view.name === 'list' ? view.orders : view.name === 'details' ? view.orders : []

  return (
    <section className="bg-cream/60 py-14 sm:py-20">
      <Container className="max-w-4xl">
        <SectionHeading
          as="h1"
          eyebrow="متابعة الطلب"
          title="اعرفي حالة طلبك"
          subtitle="اكتبي رقم الموبايل الذي استخدمتِه عند الطلب لعرض طلباتك وحالة كل طلب."
        />

        {view.name !== 'details' ? (
          <Panel className="mx-auto mt-8 max-w-2xl">
            <form onSubmit={(e) => void onSubmit(e)} noValidate className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextField
                id="track-phone"
                label="رقم الموبايل"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                className="text-end"
                value={phoneInput}
                error={phoneError || undefined}
                onChange={(e) => {
                  setPhoneInput(e.target.value)
                  if (phoneError) setPhoneError('')
                }}
              />
              <Button type="submit" disabled={view.name === 'loading'} className={cx(phoneError && 'sm:mb-8')}>
                {view.name === 'loading' ? 'جارٍ البحث...' : 'عرض طلباتي'}
              </Button>
            </form>
            <p className="mt-3 text-xs leading-6 text-muted">
              نعرض فقط الطلبات المسجّلة بهذا الرقم، ولا نعرض الاسم أو العنوان أو الملاحظات.
            </p>
          </Panel>
        ) : null}

        <div className="mx-auto mt-6 max-w-2xl" aria-live="polite">
          {view.name === 'loading' ? (
            <div role="status" className="grid gap-3">
              <span className="sr-only">جارٍ البحث عن طلباتك</span>
              {[0, 1].map((i) => (
                <div key={i} className="grid gap-3 rounded-3xl border border-line/80 bg-paper p-5" aria-hidden="true">
                  <div className="h-5 w-32 animate-pulse rounded bg-line/55 motion-reduce:animate-none" />
                  <div className="h-4 w-48 animate-pulse rounded bg-line/45 motion-reduce:animate-none" />
                  <div className="h-3.5 w-40 animate-pulse rounded bg-line/40 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          ) : null}

          {view.name === 'empty' ? (
            <Message title="لا توجد طلبات بهذا الرقم" role="status">
              تأكدي من كتابة نفس الرقم الذي استخدمتِه في الطلب. إذا كنتِ متأكدة من الرقم{' '}
              <a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-rose-deep hover:underline">
                تواصلي معنا عبر واتساب
              </a>
              .
              <div className="mt-3">
                <ButtonLink to="/order" variant="secondary">
                  اطلبي تورتة جديدة
                </ButtonLink>
              </div>
            </Message>
          ) : null}

          {view.name === 'error' ? (
            <div className="grid gap-3">
              <Message tone="error" title="تعذّر عرض الطلبات" role="alert">
                {view.message}
              </Message>
              <Button variant="secondary" className="justify-self-start" onClick={() => void search(phone)}>
                إعادة المحاولة
              </Button>
            </div>
          ) : null}

          {detailError ? (
            <div className="mb-3">
              <Message tone="error" title="تعذّر فتح الطلب" role="alert">
                {detailError}
              </Message>
            </div>
          ) : null}

          {view.name === 'list' ? (
            <OrdersList orders={view.orders} openingNumber={opening} onOpen={(n) => void openOrder(n, view.orders)} />
          ) : null}
        </div>

        {view.name === 'details' ? (
          <div className="mt-8">
            <OrderDetails
              key={view.order.orderNumber}
              order={view.order}
              phone={phone}
              onBack={() => setView(currentOrders.length ? { name: 'list', orders: currentOrders } : { name: 'empty' })}
              onChanged={() => refreshDetails(view.order.orderNumber)}
            />
          </div>
        ) : null}
      </Container>
    </section>
  )
}
