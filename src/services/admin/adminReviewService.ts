import { getSupabase } from '@/lib/supabase'
import {
  REVIEW_IMAGE_TYPES,
  REVIEW_UPLOADS_BUCKET,
  TESTIMONIALS_BUCKET,
  ADMIN_TESTIMONIAL_MAX_IMAGES,
  normalizeDisplayName,
  normalizeReviewText,
  validateReviewImage,
  validateReviewImages,
} from '@/services/reviewService'
import {
  isAdminScreenshotSource,
  isReviewSource,
  isReviewStatus,
  type AdminReview,
  type AdminScreenshotSource,
  type ReviewMediaItem,
  type ReviewStatus,
  type ReviewStatusFilter,
} from '@/types/reviews'

function fail<T>(message: string): { data: T | null; error: string } {
  return { data: null, error: message }
}

async function requireClient() {
  const supabase = getSupabase()
  if (!supabase) return { supabase: null, error: 'إعدادات الاتصال غير مكتملة.' as const }
  return { supabase, error: null as null }
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function nullableStr(value: unknown): string | null {
  if (value == null) return null
  const next = String(value).trim()
  return next === '' ? null : next
}

function mapAdminRow(row: Record<string, unknown>, media: ReviewMediaItem[] = []): AdminReview | null {
  if (!isReviewSource(row.source) || !isReviewStatus(row.status)) return null
  return {
    id: str(row.id),
    orderId: row.order_id == null ? null : str(row.order_id),
    orderNumber: row.order_number == null ? null : str(row.order_number),
    source: row.source,
    displayName: nullableStr(row.display_name),
    reviewText: nullableStr(row.review_text),
    imagePath: row.image_path == null || row.image_path === '' ? null : str(row.image_path),
    media,
    status: row.status,
    sortOrder: Number(row.sort_order) || 0,
    featured: row.featured === true,
    publishedAt: row.published_at == null ? null : str(row.published_at),
    moderatedAt: row.moderated_at == null ? null : str(row.moderated_at),
    moderatedBy: row.moderated_by == null ? null : str(row.moderated_by),
    adminNote: row.admin_note == null ? null : str(row.admin_note),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

const ADMIN_SELECT =
  'id, order_id, order_number, source, display_name, review_text, image_path, status, sort_order, featured, published_at, moderated_at, moderated_by, admin_note, created_at, updated_at'

export async function listAdminReviews(filter: ReviewStatusFilter = 'all'): Promise<{
  data: AdminReview[] | null
  error: string | null
}> {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail(error!)

  let query = supabase.from('site_reviews').select(ADMIN_SELECT).order('created_at', { ascending: false })

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data, error: qErr } = await query
  if (qErr) return fail('تعذّر تحميل الآراء.')

  const ids = (data ?? []).map((row) => str((row as { id?: unknown }).id)).filter(Boolean)
  const mediaByReview = new Map<string, ReviewMediaItem[]>()

  if (ids.length) {
    const { data: mediaRows, error: mediaErr } = await supabase
      .from('site_review_media')
      .select('review_id, image_path, sort_order')
      .in('review_id', ids)
      .order('sort_order', { ascending: true })

    // Ignore missing-table until site-review-media.sql is applied.
    if (!mediaErr) {
      for (const row of mediaRows ?? []) {
        const reviewId = str((row as { review_id?: unknown }).review_id)
        const imagePath = str((row as { image_path?: unknown }).image_path)
        if (!reviewId || !imagePath) continue
        const list = mediaByReview.get(reviewId) ?? []
        list.push({ imagePath, sortOrder: Number((row as { sort_order?: unknown }).sort_order) || 0 })
        mediaByReview.set(reviewId, list)
      }
    }
  }

  const rows = (data ?? [])
    .map((row) => {
      const id = str((row as { id?: unknown }).id)
      return mapAdminRow(row as Record<string, unknown>, mediaByReview.get(id) ?? [])
    })
    .filter((row): row is AdminReview => row !== null)

  return { data: rows, error: null }
}

export async function countAdminReviewsByStatus(): Promise<{
  data: { pending: number; published: number; rejected: number } | null
  error: string | null
}> {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail(error!)

  const counts = { pending: 0, published: 0, rejected: 0 }
  const statuses = ['pending', 'published', 'rejected'] as const

  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count, error: qErr } = await supabase
        .from('site_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
      return { status, count: count ?? 0, error: qErr }
    }),
  )

  for (const result of results) {
    if (result.error) return fail('تعذّر تحميل إحصاءات الآراء.')
    counts[result.status] = result.count
  }

  return { data: counts, error: null }
}

/** Signed URL for private pending customer uploads — admin only via RLS. */
export async function getPendingReviewImageUrl(imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null
  if (!/^[0-9a-f-]{36}\/photo\.(jpg|jpeg|png|webp)$/i.test(imagePath)) return null
  const { supabase, error } = await requireClient()
  if (!supabase || error) return null

  const { data, error: sErr } = await supabase.storage
    .from(REVIEW_UPLOADS_BUCKET)
    .createSignedUrl(imagePath, 120)

  if (sErr || !data?.signedUrl) return null
  return data.signedUrl
}

function extensionFromPath(path: string): string | null {
  const match = path.match(/\.(jpg|jpeg|png|webp)$/i)
  return match ? match[1]!.toLowerCase() : null
}

function isPrivatePendingPath(path: string): boolean {
  return /^[0-9a-f-]{36}\/photo\.(jpg|jpeg|png|webp)$/i.test(path)
}

function isPublicTestimonialPath(path: string): boolean {
  return (
    /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(path) ||
    /^[0-9a-f-]{36}\/[0-9a-z]+\.(jpg|jpeg|png|webp)$/i.test(path)
  )
}

/**
 * Publish a review. If a private pending image exists, copy it to the public
 * testimonials bucket and update image_path before publishing.
 */
export async function publishReview(id: string): Promise<{ ok: true; row: AdminReview } | { ok: false; message: string }> {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  const { data: existing, error: loadErr } = await supabase
    .from('site_reviews')
    .select(ADMIN_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (loadErr || !existing) return { ok: false, message: 'لم نجد الرأي المطلوب.' }
  const current = mapAdminRow(existing as Record<string, unknown>)
  if (!current) return { ok: false, message: 'لم نجد الرأي المطلوب.' }
  if (current.status === 'published') return { ok: false, message: 'هذا الرأي منشور بالفعل.' }

  let nextImagePath = current.imagePath

  if (current.imagePath && isPrivatePendingPath(current.imagePath)) {
    const ext = extensionFromPath(current.imagePath)
    if (!ext) return { ok: false, message: 'امتداد صورة الرأي غير صالح.' }
    const publicPath = `${id}.${ext === 'jpeg' ? 'jpg' : ext}`

    const { data: blob, error: dlErr } = await supabase.storage
      .from(REVIEW_UPLOADS_BUCKET)
      .download(current.imagePath)

    if (dlErr || !blob) return { ok: false, message: 'تعذّر قراءة صورة الرأي المعلّقة.' }

    const { error: upErr } = await supabase.storage.from(TESTIMONIALS_BUCKET).upload(publicPath, blob, {
      cacheControl: '31536000',
      upsert: true,
      contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    })

    if (upErr) return { ok: false, message: 'تعذّر نشر صورة الرأي.' }

    nextImagePath = publicPath

    await supabase.storage.from(REVIEW_UPLOADS_BUCKET).remove([current.imagePath])
  }

  const { data: sessionData } = await supabase.auth.getUser()
  const moderatedBy = sessionData.user?.id ?? null

  const { data, error: qErr } = await supabase
    .from('site_reviews')
    .update({
      status: 'published' satisfies ReviewStatus,
      published_at: new Date().toISOString(),
      moderated_at: new Date().toISOString(),
      moderated_by: moderatedBy,
      image_path: nextImagePath,
    })
    .eq('id', id)
    .select(ADMIN_SELECT)
    .maybeSingle()

  if (qErr || !data) return { ok: false, message: 'تعذّر نشر الرأي.' }
  const row = mapAdminRow(data as Record<string, unknown>)
  if (!row) return { ok: false, message: 'تعذّر نشر الرأي.' }
  return { ok: true, row }
}

export async function rejectReview(
  id: string,
  adminNote?: string,
): Promise<{ ok: true; row: AdminReview } | { ok: false; message: string }> {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  const { data: sessionData } = await supabase.auth.getUser()
  const moderatedBy = sessionData.user?.id ?? null
  const note = adminNote?.trim() || null

  const { data, error: qErr } = await supabase
    .from('site_reviews')
    .update({
      status: 'rejected' satisfies ReviewStatus,
      moderated_at: new Date().toISOString(),
      moderated_by: moderatedBy,
      admin_note: note,
    })
    .eq('id', id)
    .select(ADMIN_SELECT)
    .maybeSingle()

  if (qErr || !data) return { ok: false, message: 'تعذّر رفض الرأي.' }
  const row = mapAdminRow(data as Record<string, unknown>)
  if (!row) return { ok: false, message: 'تعذّر رفض الرأي.' }
  return { ok: true, row }
}

export async function updateReviewFields(
  id: string,
  fields: { displayName?: string; reviewText?: string; sortOrder?: number; featured?: boolean },
): Promise<{ ok: true; row: AdminReview } | { ok: false; message: string }> {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  const patch: Record<string, unknown> = {}
  if (fields.displayName != null) {
    const name = normalizeDisplayName(fields.displayName)
    if (name.length < 2 || name.length > 80) return { ok: false, message: 'اسم العرض غير صالح.' }
    patch.display_name = name
  }
  if (fields.reviewText != null) {
    const text = normalizeReviewText(fields.reviewText)
    if (text.length < 5 || text.length > 1200) return { ok: false, message: 'نص الرأي غير صالح.' }
    patch.review_text = text
  }
  if (fields.sortOrder != null) patch.sort_order = fields.sortOrder
  if (fields.featured != null) patch.featured = fields.featured

  if (Object.keys(patch).length === 0) return { ok: false, message: 'لا توجد تعديلات.' }

  const { data, error: qErr } = await supabase
    .from('site_reviews')
    .update(patch)
    .eq('id', id)
    .select(ADMIN_SELECT)
    .maybeSingle()

  if (qErr || !data) return { ok: false, message: 'تعذّر حفظ التعديلات.' }
  const row = mapAdminRow(data as Record<string, unknown>)
  if (!row) return { ok: false, message: 'تعذّر حفظ التعديلات.' }
  return { ok: true, row }
}

export async function deleteReview(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  const [{ data: existing }, { data: mediaRows }] = await Promise.all([
    supabase.from('site_reviews').select('image_path').eq('id', id).maybeSingle(),
    supabase.from('site_review_media').select('image_path').eq('review_id', id),
  ])

  const paths = new Set<string>()
  const legacy =
    existing && typeof (existing as { image_path?: unknown }).image_path === 'string'
      ? String((existing as { image_path: string }).image_path)
      : null
  if (legacy) paths.add(legacy)
  for (const row of mediaRows ?? []) {
    const p = str((row as { image_path?: unknown }).image_path)
    if (p) paths.add(p)
  }

  const { error: qErr } = await supabase.from('site_reviews').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف الرأي.' }

  const privatePaths = [...paths].filter(isPrivatePendingPath)
  const publicPaths = [...paths].filter(isPublicTestimonialPath)
  if (privatePaths.length) await supabase.storage.from(REVIEW_UPLOADS_BUCKET).remove(privatePaths)
  if (publicPaths.length) await supabase.storage.from(TESTIMONIALS_BUCKET).remove(publicPaths)

  return { ok: true }
}

export interface CreateAdminScreenshotInput {
  source: AdminScreenshotSource
  /** One or more images belonging to a single testimonial (max 8). */
  images: File[]
}

/**
 * Admin screenshot testimonial — published immediately with 1–8 images.
 * No display name or review text (images are the content).
 */
export async function createAdminScreenshotTestimonial(
  input: CreateAdminScreenshotInput,
): Promise<{ ok: true; row: AdminReview } | { ok: false; message: string }> {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  if (!isAdminScreenshotSource(input.source)) {
    return { ok: false, message: 'مصدر الشهادة غير صالح.' }
  }

  const images = input.images ?? []
  const invalid = validateReviewImages(images, ADMIN_TESTIMONIAL_MAX_IMAGES)
  if (invalid) return { ok: false, message: invalid }

  const id = crypto.randomUUID()
  const uploadedPaths: string[] = []
  let reviewInserted = false

  try {
    // 1) Upload all images under {review_id}/{unique}.ext (cleanup on any later failure).
    for (let i = 0; i < images.length; i += 1) {
      const file = images[i]!
      const ext = REVIEW_IMAGE_TYPES[file.type]
      if (!ext) throw new Error('نوع الملف غير مدعوم. استخدمي صورة JPG أو PNG أو WEBP.')
      const path = `${id}/${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}.${ext}`
      const { error: upErr } = await supabase.storage.from(TESTIMONIALS_BUCKET).upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type,
      })
      if (upErr) throw new Error('تعذّر رفع إحدى الصور. حاولي مرة أخرى.')
      uploadedPaths.push(path)
    }

    const { data: sessionData } = await supabase.auth.getUser()
    const moderatedBy = sessionData.user?.id ?? null
    const now = new Date().toISOString()
    const primaryPath = uploadedPaths[0]!

    // 2) Draft review (pending — not synced to public table) with primary path
    //    so row_shape constraint stays satisfied.
    const { error: draftErr } = await supabase.from('site_reviews').insert({
      id,
      order_id: null,
      order_number: null,
      source: input.source,
      display_name: null,
      review_text: null,
      image_path: primaryPath,
      status: 'pending',
      moderated_at: now,
      moderated_by: moderatedBy,
    })
    if (draftErr) {
      throw new Error('تعذّر إنشاء الشهادة. تأكدي من تطبيق ترحيل صور الشهادات.')
    }
    reviewInserted = true

    const mediaRows = uploadedPaths.map((image_path, sort_order) => ({
      review_id: id,
      image_path,
      sort_order,
    }))

    // 3) Media rows (still private while parent is pending)
    const { error: mediaErr } = await supabase.from('site_review_media').insert(mediaRows)
    if (mediaErr) throw new Error('تعذّر حفظ صور الشهادة. لم يتم نشر شيء.')

    // 4) Publish only after uploads + media succeed
    const { data, error: pubErr } = await supabase
      .from('site_reviews')
      .update({
        status: 'published',
        published_at: now,
        moderated_at: now,
        moderated_by: moderatedBy,
      })
      .eq('id', id)
      .select(ADMIN_SELECT)
      .maybeSingle()

    if (pubErr || !data) throw new Error('تعذّر نشر الشهادة.')

    const row = mapAdminRow(
      data as Record<string, unknown>,
      mediaRows.map((m) => ({ imagePath: m.image_path, sortOrder: m.sort_order })),
    )
    if (!row) throw new Error('تعذّر إضافة الشهادة.')
    return { ok: true, row }
  } catch (err) {
    if (reviewInserted) {
      await supabase.from('site_reviews').delete().eq('id', id)
    }
    if (uploadedPaths.length) {
      await supabase.storage.from(TESTIMONIALS_BUCKET).remove(uploadedPaths)
    }
    const message = err instanceof Error ? err.message : 'تعذّر إضافة الشهادة.'
    return { ok: false, message }
  }
}

/** @deprecated Prefer images[] form. */
export async function createAdminTestimonial(input: {
  source: AdminScreenshotSource
  image?: File
  images?: File[]
  displayName?: string
  reviewText?: string
  publishImmediately?: boolean
}): Promise<{ ok: true; row: AdminReview } | { ok: false; message: string }> {
  void input.displayName
  void input.reviewText
  void input.publishImmediately
  const images = input.images?.length ? input.images : input.image ? [input.image] : []
  return createAdminScreenshotTestimonial({ source: input.source, images })
}

export async function uploadAdminTestimonialImage(
  reviewId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const invalid = validateReviewImage(file)
  if (invalid) return { ok: false, message: invalid }

  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  const ext = REVIEW_IMAGE_TYPES[file.type]
  if (!ext) return { ok: false, message: 'نوع الملف غير مدعوم.' }
  const path = `${reviewId}/${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}.${ext}`

  const { error: upErr } = await supabase.storage.from(TESTIMONIALS_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  })

  if (upErr) return { ok: false, message: 'تعذّر رفع الصورة.' }

  const { count } = await supabase
    .from('site_review_media')
    .select('id', { count: 'exact', head: true })
    .eq('review_id', reviewId)

  const sortOrder = count ?? 0
  if (sortOrder >= ADMIN_TESTIMONIAL_MAX_IMAGES) {
    await supabase.storage.from(TESTIMONIALS_BUCKET).remove([path])
    return { ok: false, message: `يمكنك إرفاق ${ADMIN_TESTIMONIAL_MAX_IMAGES} صور كحد أقصى.` }
  }

  const { error: mErr } = await supabase.from('site_review_media').insert({
    review_id: reviewId,
    image_path: path,
    sort_order: sortOrder,
  })
  if (mErr) {
    await supabase.storage.from(TESTIMONIALS_BUCKET).remove([path])
    return { ok: false, message: 'تم رفع الصورة لكن تعذّر ربطها بالشهادة.' }
  }

  if (sortOrder === 0) {
    await supabase.from('site_reviews').update({ image_path: path }).eq('id', reviewId)
  }

  return { ok: true, path }
}
