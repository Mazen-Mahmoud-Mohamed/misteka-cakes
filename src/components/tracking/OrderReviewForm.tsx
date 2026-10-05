import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import {
  submitCustomerReview,
  validateCustomerReviewFields,
  validateReviewImage,
} from '@/services/reviewService'
import { cx } from '@/utils/cx'

type Props = {
  phone: string
  orderNumber: string
  /** Only render when real order status is delivered — caller enforces. */
  enabled: boolean
}

export function OrderReviewForm({ phone, orderNumber, enabled }: Props) {
  const formId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fieldError, setFieldError] = useState('')
  const [imageError, setImageError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setSubmitted(false)
    setSubmitError('')
    setFieldError('')
    setImageError('')
    setDisplayName('')
    setReviewText('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [orderNumber])

  if (!enabled) return null

  if (submitted) {
    return (
      <section className="rounded-3xl border border-sage/45 bg-sage/10 p-5 sm:p-7" role="status">
        <h2 className="font-display text-2xl text-rose-deep">تم إرسال رأيك للمراجعة ❤️</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          شكرًا لمشاركتك. سنراجع رأيك قبل نشره على الموقع.
        </p>
      </section>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError('')
    setFieldError('')
    setImageError('')

    const invalid = validateCustomerReviewFields(displayName, reviewText)
    if (invalid) {
      setFieldError(invalid)
      return
    }

    if (file) {
      const imgErr = validateReviewImage(file)
      if (imgErr) {
        setImageError(imgErr)
        return
      }
    }

    setBusy(true)
    const result = await submitCustomerReview({
      phone,
      orderNumber,
      displayName,
      reviewText,
      image: file,
    })
    setBusy(false)

    if (!result.ok) {
      // Text may already be pending if image attach failed after RPC success.
      if (result.code === 'upload_failed' || result.message.includes('تم حفظ النص')) {
        setSubmitted(true)
        setSubmitError(result.message)
        return
      }
      setSubmitError(result.message)
      return
    }

    setSubmitted(true)
  }

  function onFileChange(next: FileList | null) {
    setImageError('')
    const chosen = next?.[0] ?? null
    if (!chosen) {
      setFile(null)
      return
    }
    const err = validateReviewImage(chosen)
    if (err) {
      setFile(null)
      setImageError(err)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFile(chosen)
  }

  return (
    <section className="rounded-3xl border border-line/80 bg-paper p-5 sm:p-7">
      <h2 className="font-display text-2xl text-rose-deep">شاركنا رأيك ❤️</h2>
      <p className="mt-2 text-sm leading-7 text-muted">
        رأيك يساعدنا — وبعد المراجعة قد يظهر في صفحة آراء العملاء.
      </p>

      <form id={formId} className="mt-5 grid gap-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <TextField
          id={`${formId}-name`}
          label="الاسم للعرض"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          autoComplete="nickname"
          required
          disabled={busy}
        />
        <TextAreaField
          id={`${formId}-text`}
          label="رأيك"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          maxLength={1200}
          rows={4}
          required
          disabled={busy}
        />

        <div className="grid gap-2">
          <label htmlFor={`${formId}-photo`} className="font-semibold text-ink">
            صورة اختيارية
          </label>
          <input
            ref={fileRef}
            id={`${formId}-photo`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => onFileChange(e.target.files)}
            className={cx(
              'block w-full text-sm text-muted file:me-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-blush file:px-4 file:py-2 file:text-sm file:font-semibold file:text-rose-deep',
            )}
          />
          <p className="text-xs leading-6 text-muted">صورة واحدة بحد أقصى 5 ميجابايت (JPG أو PNG أو WEBP).</p>
          {imageError ? (
            <p role="alert" className="text-sm leading-6 text-rose-deep">
              {imageError}
            </p>
          ) : null}
          {file ? (
            <p className="text-sm text-ink">
              تم اختيار: <span className="font-semibold">{file.name}</span>
            </p>
          ) : null}
        </div>

        {fieldError ? (
          <p role="alert" className="rounded-2xl border border-rose/35 bg-blush/50 px-4 py-3 text-sm leading-6 text-rose-deep">
            {fieldError}
          </p>
        ) : null}
        {submitError ? (
          <p role="alert" className="rounded-2xl border border-rose/35 bg-blush/50 px-4 py-3 text-sm leading-6 text-rose-deep">
            {submitError}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'جارٍ الإرسال...' : 'إرسال الرأي'}
          </Button>
        </div>
      </form>
    </section>
  )
}
