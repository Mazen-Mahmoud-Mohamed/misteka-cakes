import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BasicInfoStep } from '@/components/order/BasicInfoStep'
import { CakeDetailsStep } from '@/components/order/CakeDetailsStep'
import { FillingsStep } from '@/components/order/FillingsStep'
import { OrderSummaryCard } from '@/components/order/OrderSummaryCard'
import { ProductConfigStep } from '@/components/order/ProductConfigStep'
import { SummaryStep } from '@/components/order/SummaryStep'
import { Button } from '@/components/ui/Button'
import { useOrderDraft } from '@/hooks/useOrderDraft'
import { REFERENCE_IMAGE } from '@/lib/constants'
import { checkAvailability } from '@/services/availabilityService'
import { buildOrder, quoteDraft, submitOrder, toSummaryView, type SummaryView } from '@/services/orderService'
import { getProduct } from '@/services/catalogService'
import { isCakeOrdering } from '@/types/products'
import type { AvailabilityResult, Order, OrderDraft, PriceLine } from '@/types'
import { isBookableDate } from '@/utils/dates'
import { cx } from '@/utils/cx'
import { formatEgp, formatOrderText } from '@/utils/format'
import { validateBasicInfo, validateCake, validateCustomer, validateFilling, type FieldErrors } from '@/utils/validation'

const CAKE_STEP_TITLES = ['بيانات الموعد', 'تفاصيل التورتة', 'الحشوة', 'الملخص']
const PRODUCT_STEP_TITLES = ['بيانات الموعد', 'تفاصيل المنتج', 'الملخص']

function getConfiguredProductFlow(draft: OrderDraft) {
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const isConfigured = Boolean(product && !isCakeOrdering(product) && !draft.cakeId && !draft.offerId)
  return { product, isConfigured }
}

interface DoneState {
  message: string
  order: Order
  view: SummaryView
  preview: string | null
  lines: PriceLine[]
}

export function OrderWizard({ initial }: { initial: Partial<OrderDraft> }) {
  const { draft, step, update: updateDraft, setStep, reset } = useOrderDraft(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [referenceError, setReferenceError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState<DoneState | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!draft.date || !draft.time || !isBookableDate(draft.date)) {
      setAvailability(null)
      setChecking(false)
      return
    }
    let cancelled = false
    setChecking(true)
    checkAvailability({ date: draft.date, time: draft.time }).then((result) => {
      if (cancelled) return
      setAvailability(result)
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [draft.date, draft.time])

  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  function update(patch: Partial<OrderDraft>) {
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
    updateDraft(patch)
  }

  function onReference(next: File | null) {
    if (!next) {
      setFile(null)
      setReferenceError('')
      return
    }
    if (!REFERENCE_IMAGE.accept.some((type) => type === next.type)) {
      setReferenceError(REFERENCE_IMAGE.badType)
      return
    }
    if (next.size > REFERENCE_IMAGE.maxBytes) {
      setReferenceError(REFERENCE_IMAGE.tooLarge)
      return
    }
    setReferenceError('')
    setFile(next)
  }

  function currentErrors(): FieldErrors {
    const { isConfigured } = getConfiguredProductFlow(draft)
    const titles = isConfigured ? PRODUCT_STEP_TITLES : CAKE_STEP_TITLES
    const last = titles.length - 1
    if (step === 0) return validateBasicInfo(draft, availability, checking)
    if (isConfigured) {
      if (step === 1) return validateCake(draft)
      if (step === last) return validateCustomer(draft)
      return {}
    }
    if (step === 1) {
      const next = validateCake(draft)
      if (referenceError) next.reference = referenceError
      return next
    }
    if (step === 2) return validateFilling(draft)
    return validateCustomer(draft)
  }

  function goNext() {
    const nextErrors = currentErrors()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setErrors({})
    const { isConfigured } = getConfiguredProductFlow(draft)
    const max = (isConfigured ? PRODUCT_STEP_TITLES : CAKE_STEP_TITLES).length - 1
    setStep((value) => {
      if (!isConfigured) {
        const product = draft.productId ? getProduct(draft.productId) : undefined
        const skipFilling = Boolean(product && !isCakeOrdering(product) && !draft.cakeId)
        if (value === 1 && skipFilling) return 3
      }
      return Math.min(value + 1, max)
    })
  }

  function goBack() {
    setErrors({})
    const { isConfigured } = getConfiguredProductFlow(draft)
    setStep((value) => {
      if (!isConfigured) {
        const product = draft.productId ? getProduct(draft.productId) : undefined
        const skipFilling = Boolean(product && !isCakeOrdering(product) && !draft.cakeId)
        if (value === 3 && skipFilling) return 1
      }
      return Math.max(value - 1, 0)
    })
  }

  async function confirm() {
    const nextErrors = validateCustomer(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (!availability || availability.status !== 'clear') {
      setSubmitError('لا يمكن إرسال الطلب قبل التحقق من الموعد.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    const view = toSummaryView(draft)
    const built = buildOrder(draft, availability.source, file ? 'session-only' : 'none')
    const result = await submitOrder(built.order, file)
    setSubmitting(false)

    if (!result.ok || !result.order) {
      setSubmitError(result.message)
      if (result.conflict) {
        setAvailability({ status: 'conflict', source: availability.source, message: result.message })
        setStep(0)
      }
      return
    }

    const keptPreview = file ? URL.createObjectURL(file) : null
    const serverView: SummaryView = {
      ...view,
      lines: result.order.priceLines?.length ? result.order.priceLines : view.lines,
      estimatedTotal: result.order.totalPrice,
      pendingCharges: result.order.pendingCharges ?? view.pendingCharges,
    }
    setDone({
      message: result.message,
      order: result.order,
      view: serverView,
      preview: keptPreview,
      lines: serverView.lines,
    })
    reset()
    setFile(null)
  }

  function closeDone() {
    if (done?.preview) URL.revokeObjectURL(done.preview)
    setDone(null)
    setCopied(false)
  }

  async function copySummary() {
    if (!done) return
    const text = formatOrderText(done.order, done.lines)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const estimate = quoteDraft(draft)
  const { isConfigured } = getConfiguredProductFlow(draft)
  const stepTitles = isConfigured ? PRODUCT_STEP_TITLES : CAKE_STEP_TITLES
  const summaryStep = stepTitles.length - 1

  if (done) {
    return (
      <div className="grid gap-6">
        <header>
          <p className="text-sm font-semibold text-rose">رقم الطلب {done.order.orderNumber}</p>
          <h2 className="mt-2 font-display text-4xl text-rose-deep">طلبك قيد المراجعة</h2>
          <p className="mt-3 leading-8 text-muted">{done.message}</p>
        </header>
        {done.preview ? (
          <img src={done.preview} alt="الصورة المرجعية المرفقة في هذه الجلسة" className="max-h-56 rounded-2xl object-contain" />
        ) : null}
        <OrderSummaryCard summary={done.view} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => void copySummary()}>
            {copied ? 'تم النسخ' : 'نسخي الملخص'}
          </Button>
          <Button type="button" variant="secondary" onClick={closeDone}>
            طلب جديد
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="scroll-mt-28"
      onSubmit={(event) => {
        event.preventDefault()
        if (step === summaryStep) void confirm()
        else goNext()
      }}
    >
      <ol className="mb-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${stepTitles.length}, minmax(0, 1fr))` }} aria-label="خطوات الطلب">
        {stepTitles.map((title, index) => (
          <li key={title} className="grid gap-2">
            <span className={cx('h-1 rounded-full', index <= step ? 'bg-rose' : 'bg-line')} />
            <span className={cx('text-xs leading-snug sm:text-sm', index === step ? 'font-semibold text-rose-deep' : 'text-muted')}>
              {title}
            </span>
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-4xl text-rose-deep outline-none">
        {stepTitles[step]}
      </h2>
      <p className="mt-2 mb-6 text-sm text-muted">
        الخطوة {step + 1} من {stepTitles.length}
      </p>

      {step === 0 ? (
        <BasicInfoStep draft={draft} errors={errors} onChange={update} availability={availability} checking={checking} />
      ) : null}
      {isConfigured && step === 1 ? <ProductConfigStep draft={draft} errors={errors} onChange={update} /> : null}
      {!isConfigured && step === 1 ? (
        <CakeDetailsStep
          draft={draft}
          errors={errors}
          onChange={update}
          referencePreview={preview}
          referenceError={referenceError}
          onReference={onReference}
        />
      ) : null}
      {!isConfigured && step === 2 ? <FillingsStep draft={draft} errors={errors} onChange={update} /> : null}
      {step === summaryStep ? <SummaryStep draft={draft} errors={errors} onChange={update} /> : null}

      {submitError ? (
        <p role="alert" className="mt-4 text-sm text-rose-deep">
          {submitError}
        </p>
      ) : null}

      <div className="h-28 sm:hidden" aria-hidden="true" />
      <div className="sticky bottom-0 z-20 mt-6 border-t border-line bg-ivory/95 py-3 backdrop-blur sm:static">
        {(draft.sizeId || draft.priceTierId || draft.productId) ? (
          <p className="mb-3 text-sm text-muted">
            التقدير الحالي:{' '}
            <span className="font-semibold text-ink">
              {estimate.estimatedTotal == null ? 'يُحدَّد لاحقًا' : formatEgp(estimate.estimatedTotal)}
              {estimate.pendingCharges.length ? '، وبه بنود تُحدَّد لاحقًا' : ''}
            </span>
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step === 0 ? (
            <Link to="/catalog" className="inline-flex min-h-12 items-center justify-center rounded-full px-4 font-semibold text-rose-deep">
              تصفحي منتجاتنا
            </Link>
          ) : (
            <Button type="button" variant="ghost" onClick={goBack}>
              السابق
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {step === summaryStep ? (submitting ? 'جارٍ الإرسال' : 'إرسال للمراجعة') : 'التالي'}
          </Button>
        </div>
      </div>
    </form>
  )
}

