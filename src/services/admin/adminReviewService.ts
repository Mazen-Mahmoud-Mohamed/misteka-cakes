import { getSupabase } from '@/lib/supabase'
import {
  REVIEW_IMAGE_TYPES,
  REVIEW_UPLOADS_BUCKET,
  TESTIMONIALS_BUCKET,
  normalizeDisplayName,
  normalizeReviewText,
  validateReviewImage,
} from '@/services/reviewService'
import {
  isAdminTestimonialSource,
  isReviewSource,
  isReviewStatus,
  type AdminReview,
  type AdminTestimonialSource,
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

function mapAdminRow(row: Record<string, unknown>): AdminReview | null {
  if (!isReviewSource(row.source) || !isReviewStatus(row.status)) return null
  return {
    id: str(row.id),
    orderId: row.order_id == null ? null : str(row.order_id),
    orderNumber: row.order_number == null ? null : str(row.order_number),
    source: row.source,
    displayName: str(row.display_name),
    reviewText: str(row.review_text),
    imagePath: row.image_path == null || row.image_path === '' ? null : str(row.image_path),
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

  const rows = (data ?? [])
    .map((row) => mapAdminRow(row as Record<string, unknown>))
    .filter((row): row is AdminReview => row !== null)

  return { data: rows, error: null }
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
  return /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(path)
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

    // Best-effort cleanup of private pending object.
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

  const { data: existing } = await supabase
    .from('site_reviews')
    .select('image_path')
    .eq('id', id)
    .maybeSingle()

  const imagePath = existing && typeof (existing as { image_path?: unknown }).image_path === 'string'
    ? String((existing as { image_path: string }).image_path)
    : null

  const { error: qErr } = await supabase.from('site_reviews').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف الرأي.' }

  if (imagePath) {
    if (isPrivatePendingPath(imagePath)) {
      await supabase.storage.from(REVIEW_UPLOADS_BUCKET).remove([imagePath])
    } else if (isPublicTestimonialPath(imagePath)) {
      await supabase.storage.from(TESTIMONIALS_BUCKET).remove([imagePath])
    }
  }

  return { ok: true }
}

export interface CreateAdminTestimonialInput {
  displayName: string
  reviewText: string
  source: AdminTestimonialSource
  image?: File | null
  publishImmediately?: boolean
}

/** Admin-created testimonial — source never forced to customer; order_id stays null. */
export async function createAdminTestimonial(
  input: CreateAdminTestimonialInput,
): Promise<{ ok: true; row: AdminReview } | { ok: false; message: string }> {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }

  if (!isAdminTestimonialSource(input.source)) {
    return { ok: false, message: 'مصدر الرأي غير صالح.' }
  }

  const displayName = normalizeDisplayName(input.displayName)
  const reviewText = normalizeReviewText(input.reviewText)
  if (displayName.length < 2 || displayName.length > 80) {
    return { ok: false, message: 'اسم العرض غير صالح.' }
  }
  if (reviewText.length < 5 || reviewText.length > 1200) {
    return { ok: false, message: 'نص الرأي غير صالح.' }
  }

  if (input.image) {
    const invalid = validateReviewImage(input.image)
    if (invalid) return { ok: false, message: invalid }
  }

  const publish = input.publishImmediately !== false
  const { data: sessionData } = await supabase.auth.getUser()
  const moderatedBy = sessionData.user?.id ?? null
  const now = new Date().toISOString()

  const { data, error: qErr } = await supabase
    .from('site_reviews')
    .insert({
      order_id: null,
      order_number: null,
      source: input.source,
      display_name: displayName,
      review_text: reviewText,
      status: publish ? 'published' : 'pending',
      published_at: publish ? now : null,
      moderated_at: publish ? now : null,
      moderated_by: publish ? moderatedBy : null,
    })
    .select(ADMIN_SELECT)
    .maybeSingle()

  if (qErr || !data) return { ok: false, message: 'تعذّر إضافة الرأي.' }
  let row = mapAdminRow(data as Record<string, unknown>)
  if (!row) return { ok: false, message: 'تعذّر إضافة الرأي.' }

  if (input.image) {
    const ext = REVIEW_IMAGE_TYPES[input.image.type]
    if (!ext) return { ok: false, message: 'نوع الملف غير مدعوم.' }
    const publicPath = `${row.id}.${ext}`

    const { error: upErr } = await supabase.storage.from(TESTIMONIALS_BUCKET).upload(publicPath, input.image, {
      cacheControl: '31536000',
      upsert: false,
      contentType: input.image.type,
    })

    if (upErr) {
      return { ok: false, message: 'تم حفظ الرأي لكن تعذّر رفع الصورة.' }
    }

    const { data: updated, error: uErr } = await supabase
      .from('site_reviews')
      .update({ image_path: publicPath })
      .eq('id', row.id)
      .select(ADMIN_SELECT)
      .maybeSingle()

    if (!uErr && updated) {
      row = mapAdminRow(updated as Record<string, unknown>) ?? row
    }
  }

  return { ok: true, row }
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
  const path = `${reviewId}.${ext}`

  const { error: upErr } = await supabase.storage.from(TESTIMONIALS_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: true,
    contentType: file.type,
  })

  if (upErr) return { ok: false, message: 'تعذّر رفع الصورة.' }

  const { error: qErr } = await supabase.from('site_reviews').update({ image_path: path }).eq('id', reviewId)
  if (qErr) return { ok: false, message: 'تم رفع الصورة لكن تعذّر ربطها بالرأي.' }

  return { ok: true, path }
}
