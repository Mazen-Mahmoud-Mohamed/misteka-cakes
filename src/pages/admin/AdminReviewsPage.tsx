import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminAlert, AdminToast, useFlash } from '@/components/admin/AdminAlert'
import { AdminButton } from '@/components/admin/AdminButton'
import { AdminPage, AdminPageHeader, AdminCard, adminSurfaceClass } from '@/components/admin/AdminCard'
import { AdminSelectField } from '@/components/admin/AdminField'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import { AdminStatCard } from '@/components/admin/AdminStatCard'
import { IconCheck, IconClose, IconPlus, IconRefresh } from '@/components/admin/icons'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  countAdminReviewsByStatus,
  createAdminScreenshotTestimonial,
  deleteReview,
  getPendingReviewImageUrl,
  listAdminReviews,
  publishReview,
  rejectReview,
} from '@/services/admin/adminReviewService'
import { publicTestimonialImageUrl, validateReviewImages } from '@/services/reviewService'
import {
  ADMIN_SCREENSHOT_SOURCES,
  ADMIN_TESTIMONIAL_MAX_IMAGES,
  arabicImageCountLabel,
  isScreenshotTestimonial,
  reviewImagePaths,
  reviewSourceLabel,
  reviewStatusLabel,
  type AdminReview,
  type AdminScreenshotSource,
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

function ReviewImage({
  path,
  className,
  maxHeightClass = 'max-h-52',
  onOpen,
}: {
  path: string | null
  className?: string
  maxHeightClass?: string
  onOpen?: (url: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    // Customer pending private path: `{uuid}/photo.ext`
    if (/\/photo\.(jpg|jpeg|png|webp)$/i.test(path)) {
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
    <button
      type="button"
      onClick={() => onOpen?.(url)}
      className={cx(
        'group block w-full overflow-hidden rounded-xl border border-line/80 bg-ivory text-start',
        className,
      )}
    >
      <img
        src={url}
        alt="معاينة الشهادة"
        className={cx('mx-auto w-full object-contain', maxHeightClass, 'transition duration-200 group-hover:opacity-95')}
      />
    </button>
  )
}

function SourceBadge({ source }: { source: AdminReview['source'] }) {
  const label =
    source === 'whatsapp'
      ? 'شهادة من WhatsApp'
      : source === 'facebook'
        ? 'شهادة من Facebook'
        : source === 'instagram'
          ? 'شهادة من Instagram'
          : reviewSourceLabel(source)
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-ivory px-2 py-0.5 text-[0.6875rem] font-bold text-muted">
      {label}
    </span>
  )
}

function ReviewCard({
  review,
  busyId,
  onPublish,
  onReject,
  onDelete,
  onOpenImage,
}: {
  review: AdminReview
  busyId: string | null
  onPublish: (id: string) => void
  onReject: (id: string) => void
  onDelete: (id: string) => void
  onOpenImage: (url: string) => void
}) {
  const busy = busyId === review.id
  const screenshot = isScreenshotTestimonial(review)
  const paths = reviewImagePaths(review)

  return (
    <article className={cx(adminSurfaceClass, 'grid gap-3 p-3.5 sm:p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceBadge source={review.source} />
          <span className="text-[0.6875rem] font-semibold text-muted">{reviewStatusLabel(review.status)}</span>
          {screenshot && paths.length > 0 ? (
            <span className="text-[0.6875rem] font-semibold text-muted">{arabicImageCountLabel(paths.length)}</span>
          ) : null}
        </div>
        {review.orderNumber ? (
          <p
            className="rounded-md border border-line bg-ivory px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-ink"
            dir="ltr"
            title="مرجع الطلب للمراجعة الداخلية"
          >
            {review.orderNumber}
          </p>
        ) : null}
      </div>

      {screenshot ? (
        paths.length <= 1 ? (
          <ReviewImage path={paths[0] ?? null} maxHeightClass="max-h-72 sm:max-h-80" onOpen={onOpenImage} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {paths.map((path) => (
              <ReviewImage key={path} path={path} maxHeightClass="max-h-28" onOpen={onOpenImage} />
            ))}
          </div>
        )
      ) : (
        <>
          {review.displayName ? (
            <h3 className="font-display text-lg leading-snug text-rose-deep sm:text-xl">{review.displayName}</h3>
          ) : null}
          {review.reviewText ? (
            <p className="text-sm leading-7 whitespace-pre-wrap text-ink">{review.reviewText}</p>
          ) : null}
          <ReviewImage path={review.imagePath} onOpen={onOpenImage} />
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3">
        {review.status === 'pending' ? (
          <>
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
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </article>
  )
}

type SelectedImage = { id: string; file: File; previewUrl: string }

function AddScreenshotForm({
  onCreated,
  onFlash,
}: {
  onCreated: () => void
  onFlash: (flash: { tone: 'success' | 'error'; text: string }) => void
}) {
  const formId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<AdminScreenshotSource>('whatsapp')
  const [images, setImages] = useState<SelectedImage[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      for (const item of images) URL.revokeObjectURL(item.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke on unmount only
  }, [])

  function clearImages() {
    setImages((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl)
      return []
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function addFiles(list: FileList | File[] | null) {
    setError('')
    if (!list || list.length === 0) return

    const incoming = Array.from(list)
    const remaining = ADMIN_TESTIMONIAL_MAX_IMAGES - images.length
    if (remaining <= 0) {
      setError(`يمكنك إرفاق ${ADMIN_TESTIMONIAL_MAX_IMAGES} صور كحد أقصى.`)
      return
    }

    const nextBatch = incoming.slice(0, remaining)
    if (incoming.length > remaining) {
      setError(`تم إرفاق أول ${remaining} صور فقط (الحد ${ADMIN_TESTIMONIAL_MAX_IMAGES}).`)
    }

    const invalid = validateReviewImages(nextBatch, remaining)
    if (invalid) {
      setError(invalid)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const seen = new Set(images.map((i) => `${i.file.name}:${i.file.size}:${i.file.lastModified}`))
    const added: SelectedImage[] = []
    for (const file of nextBatch) {
      const key = `${file.name}:${file.size}:${file.lastModified}`
      if (seen.has(key)) continue
      seen.add(key)
      added.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    if (!added.length) {
      setError('هذه الصور مضافة بالفعل.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setImages((prev) => [...prev, ...added])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeAt(index: number) {
    setImages((prev) => {
      const copy = [...prev]
      const [removed] = copy.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return copy
    })
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return
    setImages((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(from, 1)
      if (!item) return prev
      copy.splice(to, 0, item)
      return copy
    })
  }

  function onDropZone(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  function onThumbDragStart(index: number) {
    setDragIndex(index)
  }

  function onThumbDrop(index: number) {
    if (dragIndex == null || dragIndex === index) {
      setDragIndex(null)
      return
    }
    setImages((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(dragIndex, 1)
      if (!item) return prev
      copy.splice(index, 0, item)
      return copy
    })
    setDragIndex(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const files = images.map((i) => i.file)
    const invalid = validateReviewImages(files, ADMIN_TESTIMONIAL_MAX_IMAGES)
    if (invalid) {
      setError(invalid)
      return
    }

    setBusy(true)
    const result = await createAdminScreenshotTestimonial({ source, images: files })
    setBusy(false)

    if (!result.ok) {
      setError(result.message)
      onFlash({ tone: 'error', text: result.message })
      return
    }

    clearImages()
    setSource('whatsapp')
    onFlash({ tone: 'success', text: 'تم إضافة الشهادة ونشرها.' })
    onCreated()
  }

  return (
    <AdminCard
      title="+ إضافة شهادة من محادثة"
      description="عدة صور لقصة واحدة — بدون اسم أو نص."
      bodyClassName="grid gap-3"
    >
      <form className="grid gap-3" onSubmit={(e) => void onSubmit(e)}>
        <AdminSelectField
          id={`${formId}-source`}
          label="المصدر"
          value={source}
          onChange={(e) => setSource(e.target.value as AdminScreenshotSource)}
          disabled={busy}
        >
          {ADMIN_SCREENSHOT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {reviewSourceLabel(s)}
            </option>
          ))}
        </AdminSelectField>

        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">صور الشهادة</p>
            {images.length > 0 ? (
              <p className="text-xs font-semibold text-muted">{arabicImageCountLabel(images.length)}</p>
            ) : null}
          </div>
          <label
            htmlFor={`${formId}-image`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDropZone}
            className={cx(
              'grid cursor-pointer place-items-center gap-1 rounded-xl border border-dashed px-3 py-6 text-center transition-colors',
              dragging ? 'border-rose-deep bg-blush/40' : 'border-line bg-ivory/80 hover:border-rose/40 hover:bg-blush/20',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <span className="text-sm font-semibold text-ink">اسحبي الصور هنا أو اختاري الصور</span>
            <span className="text-xs text-muted">
              JPG / PNG / WEBP · حتى 5 ميجابايت للصورة · حد أقصى {ADMIN_TESTIMONIAL_MAX_IMAGES} صور
            </span>
            <input
              ref={fileRef}
              id={`${formId}-image`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || images.length >= ADMIN_TESTIMONIAL_MAX_IMAGES}
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        </div>

        {images.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((item, index) => (
              <li
                key={item.id}
                draggable={!busy}
                onDragStart={() => onThumbDragStart(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onThumbDrop(index)}
                className={cx(
                  'relative overflow-hidden rounded-xl border border-line bg-paper',
                  dragIndex === index && 'opacity-60',
                )}
              >
                <img
                  src={item.previewUrl}
                  alt={`معاينة ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute start-1 top-1 rounded bg-ink/75 px-1.5 py-0.5 text-[0.625rem] font-bold text-paper">
                    رئيسية
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-ink/55 p-1">
                  <button
                    type="button"
                    className="rounded px-1 text-[0.625rem] font-bold text-paper disabled:opacity-40"
                    disabled={busy || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label="تحريك لليسار"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded px-1 text-[0.625rem] font-bold text-paper disabled:opacity-40"
                    disabled={busy || index === images.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label="تحريك لليمين"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ms-auto grid size-6 place-items-center rounded-full bg-paper/90 text-ink"
                    disabled={busy}
                    onClick={() => removeAt(index)}
                    aria-label="إزالة الصورة"
                  >
                    <IconClose size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-semibold text-[#8a2e2e]">
            {error}
          </p>
        ) : null}

        <AdminButton type="submit" variant="primary" icon={<IconPlus size={16} />} loading={busy} className="w-full">
          إضافة ونشر
        </AdminButton>
      </form>
    </AdminCard>
  )
}

function ImageLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!url) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url, onClose])

  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="عرض الصورة"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 end-4 grid size-10 place-items-center rounded-full bg-paper text-ink"
        aria-label="إغلاق"
        onClick={onClose}
      >
        <IconClose />
      </button>
      <img
        src={url}
        alt=""
        className="max-h-[90vh] max-w-[min(96vw,56rem)] rounded-lg object-contain shadow-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export function AdminReviewsPage() {
  usePageTitle('آراء العملاء | مستكة')
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params.get('status'))
  const { flash, setFlash, clearFlash } = useFlash()
  const [rows, setRows] = useState<AdminReview[]>([])
  const [counts, setCounts] = useState({ pending: 0, published: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [listResult, countResult] = await Promise.all([
        listAdminReviews(filter),
        countAdminReviewsByStatus(),
      ])

      if (listResult.error || !listResult.data) {
        setError(listResult.error || 'تعذّر تحميل الآراء.')
        setRows([])
      } else {
        setError('')
        setRows(listResult.data)
      }

      if (countResult.data) setCounts(countResult.data)

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
        description="راجعي آراء العملاء وشهادات التواصل."
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <AdminStatCard
          label="قيد المراجعة"
          value={counts.pending}
          tone="pending"
          highlight={filter === 'pending'}
          to="/admin/reviews"
        />
        <AdminStatCard
          label="منشورة"
          value={counts.published}
          tone="success"
          highlight={filter === 'published'}
          to="/admin/reviews?status=published"
        />
        <AdminStatCard
          label="مرفوضة"
          value={counts.rejected}
          tone="danger"
          highlight={filter === 'rejected'}
          to="/admin/reviews?status=rejected"
        />
      </div>

      <AdminAlert tone="info" title="تذكير المراجعة" className="mb-4">
        راجعي اللقطات بحثًا عن أرقام هواتف أو بريد أو عناوين أو محادثات خاصة قبل النشر.
      </AdminAlert>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cx(
              'inline-flex min-h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold transition-colors',
              filter === item.value
                ? 'border-rose-deep bg-rose-deep text-ivory'
                : 'border-line bg-paper text-ink hover:bg-ivory',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-3">
          {loading ? <AdminListSkeleton rows={3} /> : null}
          {!loading && error ? <AdminErrorState description={error} onRetry={() => void load()} /> : null}
          {!loading && !error && rows.length === 0 ? (
            <AdminEmptyState
              title="لا توجد عناصر في هذه التصفية"
              description="أضيفي شهادة من محادثة، أو راجعي آراء العملاء المعلّقة."
            />
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
                  onOpenImage={setLightboxUrl}
                />
              ))
            : null}
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <AddScreenshotForm onCreated={() => void load(true)} onFlash={setFlash} />
        </div>
      </div>

      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <AdminToast flash={flash} onClose={clearFlash} />
    </AdminPage>
  )
}
