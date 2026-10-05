import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminAlert, AdminToast, useFlash } from '@/components/admin/AdminAlert'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader, AdminCard, adminSurfaceClass } from '@/components/admin/AdminCard'
import { AdminSelectField, AdminTextAreaField, AdminTextField } from '@/components/admin/AdminField'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import { IconCheck, IconClose, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  createAdminTestimonial,
  getPendingReviewImageUrl,
  listAdminReviews,
  publishReview,
  rejectReview,
  deleteReview,
} from '@/services/admin/adminReviewService'
import { publicTestimonialImageUrl, validateReviewImage } from '@/services/reviewService'
import {
  ADMIN_TESTIMONIAL_SOURCES,
  reviewSourceLabel,
  reviewStatusLabel,
  type AdminReview,
  type AdminTestimonialSource,
  type ReviewStatusFilter,
} from '@/types/reviews'
import { cx } from '@/utils/cx'

const FILTERS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: 'pending', label: 'في انتظار المراجعة' },
  { value: 'published', label: 'منشورة' },
  { value: 'rejected', label: 'مرفوضة' },
  { value: 'all', label: 'الكل' },
]

function readFilter(value: string | null): ReviewStatusFilter {
  if (value === 'pending' || value === 'published' || value === 'rejected' || value === 'all') return value
  return 'pending'
}

function PendingImage({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    // Private pending path → signed URL; public path → public URL.
    if (path.includes('/')) {
      void getPendingReviewImageUrl(path).then((signed) => {
        if (!cancelled) setUrl(signed)
      })
    } else {
      setUrl(publicTestimonialImageUrl(path))
    }
    return () => {
      cancelled = true
    }
  }, [path])

  if (!path) return null
  if (!url) {
    return <p className="text-xs text-muted">جارٍ تحميل الصورة...</p>
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-ivory">
      <img src={url} alt="صورة الرأي" className="max-h-56 w-full object-contain" />
    </div>
  )
}

function ReviewCard({
  review,
  busyId,
  onPublish,
  onReject,
  onDelete,
}: {
  review: AdminReview
  busyId: string | null
  onPublish: (id: string) => void
  onReject: (id: string) => void
  onDelete: (id: string) => void
}) {
  const busy = busyId === review.id
  return (
    <article className={cx(adminSurfaceClass, 'grid gap-4 p-4 sm:p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-xl text-rose-deep">{review.displayName}</h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            {reviewSourceLabel(review.source)} · {reviewStatusLabel(review.status)}
          </p>
        </div>
        {review.orderNumber ? (
          <p className="rounded-lg border border-line bg-ivory px-2.5 py-1 text-xs font-semibold tabular-nums text-ink" dir="ltr">
            {review.orderNumber}
          </p>
        ) : null}
      </div>

      <p className="text-sm leading-7 text-ink whitespace-pre-wrap">{review.reviewText}</p>

      <PendingImage path={review.imagePath} />

      {review.status === 'pending' ? (
        <div className="flex flex-wrap gap-2">
          <AdminButton
            variant="primary"
            size="sm"
            icon={<IconCheck size={16} />}
            loading={busy}
            disabled={Boolean(busyId)}
            onClick={() => onPublish(review.id)}
          >
            نشر
          </AdminButton>
          <AdminButton
            variant="dangerOutline"
            size="sm"
            icon={<IconClose size={16} />}
            loading={busy}
            disabled={Boolean(busyId)}
            onClick={() => onReject(review.id)}
          >
            رفض
          </AdminButton>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {review.status !== 'published' ? (
            <AdminButton
              variant="primary"
              size="sm"
              loading={busy}
              disabled={Boolean(busyId)}
              onClick={() => onPublish(review.id)}
            >
              نشر
            </AdminButton>
          ) : null}
          <AdminButton
            variant="dangerOutline"
            size="sm"
            loading={busy}
            disabled={Boolean(busyId)}
            onClick={() => onDelete(review.id)}
          >
            حذف
          </AdminButton>
        </div>
      )}
    </article>
  )
}

function AddTestimonialForm({ onCreated }: { onCreated: () => void }) {
  const formId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [source, setSource] = useState<AdminTestimonialSource>('whatsapp')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { flash, setFlash, clearFlash } = useFlash()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (file) {
      const invalid = validateReviewImage(file)
      if (invalid) {
        setError(invalid)
        return
      }
    }
    setBusy(true)
    const result = await createAdminTestimonial({
      displayName,
      reviewText,
      source,
      image: file,
      publishImmediately: true,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setDisplayName('')
    setReviewText('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setFlash({ tone: 'success', text: 'تم إضافة الرأي ونشره.' })
    onCreated()
  }

  return (
    <AdminCard title="إضافة رأي / شهادة" bodyClassName="grid gap-4">
      <AdminAlert tone="info" title="تسمية المصدر بصدق">
        لا تُصنّفي آراء WhatsApp أو Facebook أو Instagram كرأي عميل موثّق من الموقع. استخدمي المصدر الصحيح.
      </AdminAlert>

      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <AdminTextField
          id={`${formId}-name`}
          label="اسم العرض"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={80}
          disabled={busy}
        />
        <AdminTextAreaField
          id={`${formId}-text`}
          label="نص الرأي"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          required
          maxLength={1200}
          rows={4}
          disabled={busy}
        />
        <AdminSelectField
          id={`${formId}-source`}
          label="المصدر"
          value={source}
          onChange={(e) => setSource(e.target.value as AdminTestimonialSource)}
          disabled={busy}
        >
          {ADMIN_TESTIMONIAL_SOURCES.map((s) => (
            <option key={s} value={s}>
              {reviewSourceLabel(s)}
            </option>
          ))}
        </AdminSelectField>
        <div className="grid gap-1.5">
          <label htmlFor={`${formId}-image`} className="text-sm font-semibold text-ink">
            صورة اختيارية
          </label>
          <input
            ref={fileRef}
            id={`${formId}-image`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-2 file:text-sm file:font-semibold file:text-rose-deep"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-[#8a2e2e]">
            {error}
          </p>
        ) : null}
        <div>
          <AdminButton type="submit" variant="primary" icon={<IconPlus size={16} />} loading={busy}>
            إضافة ونشر
          </AdminButton>
        </div>
      </form>
      <AdminToast flash={flash} onClose={clearFlash} />
    </AdminCard>
  )
}

export function AdminReviewsPage() {
  usePageTitle('آراء العملاء | مستكة')
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params.get('status'))
  const { flash, setFlash, clearFlash } = useFlash()
  const [rows, setRows] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const result = await listAdminReviews(filter)
      if (result.error || !result.data) {
        setError(result.error || 'تعذّر تحميل الآراء.')
        setRows([])
      } else {
        setError('')
        setRows(result.data)
      }
      setLoading(false)
      setRefreshing(false)
    },
    [filter],
  )

  useEffect(() => {
    void load()
  }, [load])

  function setFilter(next: ReviewStatusFilter) {
    const p = new URLSearchParams(params)
    if (next === 'pending') p.delete('status')
    else p.set('status', next)
    setParams(p, { replace: true })
  }

  async function onPublish(id: string) {
    setBusyId(id)
    const result = await publishReview(id)
    setBusyId(null)
    if (!result.ok) {
      setFlash({ tone: 'error', text: result.message })
      return
    }
    setFlash({ tone: 'success', text: 'تم نشر الرأي.' })
    await load(true)
  }

  async function onReject(id: string) {
    setBusyId(id)
    const result = await rejectReview(id)
    setBusyId(null)
    if (!result.ok) {
      setFlash({ tone: 'error', text: result.message })
      return
    }
    setFlash({ tone: 'success', text: 'تم رفض الرأي.' })
    await load(true)
  }

  async function onDelete(id: string) {
    if (!window.confirm('هل تريدين حذف هذا الرأي نهائيًا؟')) return
    setBusyId(id)
    const result = await deleteReview(id)
    setBusyId(null)
    if (!result.ok) {
      setFlash({ tone: 'error', text: result.message })
      return
    }
    setFlash({ tone: 'success', text: 'تم حذف الرأي.' })
    await load(true)
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="آراء العملاء"
        description="مراجعة آراء العملاء وإضافة شهادات من القنوات الأخرى."
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

      <AdminAlert tone="info" title="تذكير المراجعة قبل النشر">
        راجعي الصور لالتقاط أرقام الهواتف، البريد، العناوين، المحادثات الخاصة، أو أي معلومات شخصية غير مرتبطة. لا يُنشر أي رأي تلقائيًا.
      </AdminAlert>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cx(
              'inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold transition-colors',
              filter === item.value
                ? 'border-rose-deep bg-rose-deep text-ivory'
                : 'border-line bg-paper text-ink hover:bg-ivory',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-4">
          {loading ? <AdminListSkeleton rows={4} /> : null}
          {!loading && error ? <AdminErrorState description={error} onRetry={() => void load()} /> : null}
          {!loading && !error && rows.length === 0 ? (
            <AdminEmptyState title="لا توجد آراء في هذا التصفية" description="جرّبي تصفية أخرى أو أضيفي رأيًا يدويًا." />
          ) : null}
          {!loading && !error
            ? rows.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  busyId={busyId}
                  onPublish={(id) => void onPublish(id)}
                  onReject={(id) => void onReject(id)}
                  onDelete={(id) => void onDelete(id)}
                />
              ))
            : null}
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <AddTestimonialForm onCreated={() => void load(true)} />
        </div>
      </div>

      <AdminToast flash={flash} onClose={clearFlash} />
    </AdminPage>
  )
}
