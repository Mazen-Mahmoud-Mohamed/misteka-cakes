import { getSupabase } from '@/lib/supabase'
import { normalizeTrackingPhone } from '@/services/trackingService'
import {
  isReviewSource,
  type PublicReview,
  type ReviewServiceFailure,
  type SubmitCustomerReviewInput,
} from '@/types/reviews'

export const REVIEW_UPLOADS_BUCKET = 'review-uploads'
export const TESTIMONIALS_BUCKET = 'testimonials'

export const REVIEW_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const ADMIN_TESTIMONIAL_MAX_IMAGES = 8

const OFFLINE: ReviewServiceFailure = {
  ok: false,
  code: 'offline',
  message: 'خدمة الآراء غير متاحة حاليًا.',
}

const NETWORK: ReviewServiceFailure = {
  ok: false,
  code: 'network',
  message: 'تعذّر الاتصال. تأكدي من الإنترنت ثم أعيدي المحاولة.',
}

function failure(data: unknown): ReviewServiceFailure {
  const row = (data ?? {}) as { code?: string; message?: string }
  return {
    ok: false,
    code: row.code ?? 'error',
    message: row.message ?? 'حدث خطأ غير متوقع. أعيدي المحاولة.',
  }
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

export function validateReviewImage(file: File): string | null {
  const ext = REVIEW_IMAGE_TYPES[file.type]
  if (!ext) return 'نوع الملف غير مدعوم. استخدمي صورة JPG أو PNG أو WEBP.'
  if (file.size > REVIEW_IMAGE_MAX_BYTES) return 'حجم الصورة أكبر من 5 ميجابايت.'
  return null
}

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeReviewText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function validateCustomerReviewFields(displayName: string, reviewText: string): string | null {
  const name = normalizeDisplayName(displayName)
  const text = normalizeReviewText(reviewText)
  if (name.length < 2 || name.length > 80) return 'اكتبي اسمًا مناسبًا للعرض (حرفان على الأقل).'
  if (text.length < 5 || text.length > 1200) return 'اكتبي رأيك بوضوح (من 5 إلى 1200 حرف).'
  return null
}

export function validateReviewImages(files: File[], max = ADMIN_TESTIMONIAL_MAX_IMAGES): string | null {
  if (!files.length) return 'أرفقي صورة واحدة على الأقل.'
  if (files.length > max) return `يمكنك إرفاق ${max} صور كحد أقصى.`
  for (const file of files) {
    const err = validateReviewImage(file)
    if (err) return err
  }
  return null
}

/** Public URL for published testimonial media (flat or nested under review id). */
export function publicTestimonialImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null
  const flat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i
  const nested =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-z]+\.(jpg|jpeg|png|webp)$/i
  if (!flat.test(imagePath) && !nested.test(imagePath)) return null
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${TESTIMONIALS_BUCKET}/${imagePath}`
}

function mapPublicRow(
  row: Record<string, unknown>,
  mediaByReview: Map<string, import('@/types/reviews').ReviewMediaItem[]>,
): PublicReview | null {
  if (!isReviewSource(row.source)) return null
  const displayName =
    row.display_name == null || String(row.display_name).trim() === ''
      ? null
      : str(row.display_name).trim()
  const reviewText =
    row.review_text == null || String(row.review_text).trim() === ''
      ? null
      : str(row.review_text).trim()
  const imagePath = row.image_path == null || row.image_path === '' ? null : str(row.image_path)
  const reviewId = row.review_id == null ? null : str(row.review_id)
  const media = reviewId ? (mediaByReview.get(reviewId) ?? []) : []

  if (row.source === 'customer') {
    if (!displayName || !reviewText) return null
  } else {
    const screenshotOnly = !displayName && !reviewText
    if (screenshotOnly) {
      if (!imagePath && media.length === 0) return null
    } else if (!displayName || !reviewText) {
      return null
    }
  }

  return {
    reviewId,
    displayName,
    reviewText,
    imagePath,
    media,
    source: row.source,
    publishedAt: row.published_at == null ? null : str(row.published_at),
    sortOrder: Number(row.sort_order) || 0,
    featured: row.featured === true,
  }
}

/** Fetch published reviews from the dedicated public-safe table only. */
export async function fetchPublishedReviews(): Promise<{
  reviews: PublicReview[]
  error: string | null
}> {
  const supabase = getSupabase()
  if (!supabase) return { reviews: [], error: null }

  try {
    // Prefer join key + media; fall back if migration not applied yet.
    let reviewRows: Array<Record<string, unknown>> | null = null

    {
      const withId = await supabase
        .from('site_reviews_public')
        .select('review_id, display_name, review_text, image_path, source, published_at, sort_order, featured')
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false })

      if (!withId.error && withId.data) {
        reviewRows = withId.data as Array<Record<string, unknown>>
      } else {
        const legacy = await supabase
          .from('site_reviews_public')
          .select('display_name, review_text, image_path, source, published_at, sort_order, featured')
          .order('sort_order', { ascending: true })
          .order('published_at', { ascending: false })
        if (legacy.error || !legacy.data) {
          return { reviews: [], error: 'تعذّر تحميل آراء العملاء.' }
        }
        reviewRows = legacy.data as Array<Record<string, unknown>>
      }
    }

    const mediaByReview = new Map<string, import('@/types/reviews').ReviewMediaItem[]>()
    const mediaRes = await supabase
      .from('site_review_media_public')
      .select('review_id, image_path, sort_order')
      .order('sort_order', { ascending: true })

    if (!mediaRes.error && mediaRes.data) {
      for (const row of mediaRes.data as Array<Record<string, unknown>>) {
        const reviewId = str(row.review_id)
        const imagePath = str(row.image_path)
        if (!reviewId || !imagePath) continue
        const list = mediaByReview.get(reviewId) ?? []
        list.push({ imagePath, sortOrder: Number(row.sort_order) || 0 })
        mediaByReview.set(reviewId, list)
      }
    }

    const reviews = reviewRows
      .map((row) => mapPublicRow(row, mediaByReview))
      .filter((row): row is PublicReview => row !== null)

    return { reviews, error: null }
  } catch {
    return { reviews: [], error: 'تعذّر تحميل آراء العملاء.' }
  }
}

/**
 * Submit a customer review via security-definer RPC (never direct INSERT).
 * Optionally uploads one image to the private bucket then attaches via RPC.
 */
export async function submitCustomerReview(
  input: SubmitCustomerReviewInput,
): Promise<{ ok: true; reviewId: string } | ReviewServiceFailure> {
  const supabase = getSupabase()
  if (!supabase) return OFFLINE

  const phone = normalizeTrackingPhone(input.phone)
  const orderNumber = input.orderNumber.trim().toUpperCase()
  const displayName = normalizeDisplayName(input.displayName)
  const reviewText = normalizeReviewText(input.reviewText)

  const fieldError = validateCustomerReviewFields(displayName, reviewText)
  if (fieldError) return { ok: false, code: 'invalid', message: fieldError }

  if (input.image) {
    const imageError = validateReviewImage(input.image)
    if (imageError) return { ok: false, code: 'invalid_image', message: imageError }
  }

  const { data, error } = await supabase.rpc('submit_customer_review', {
    p_phone: phone,
    p_order_number: orderNumber,
    p_display_name: displayName,
    p_review_text: reviewText,
  })

  if (error) return NETWORK
  const result = data as { ok?: boolean; reviewId?: string; code?: string; message?: string }
  if (!result?.ok || !result.reviewId) return failure(data)

  const reviewId = String(result.reviewId)

  if (input.image) {
    const attached = await attachCustomerReviewImage({
      phone,
      orderNumber,
      reviewId,
      file: input.image,
    })
    if (!attached.ok) {
      // Review text is already pending; surface image failure clearly.
      return {
        ok: false,
        code: attached.code,
        message: `${attached.message} تم حفظ النص وهو قيد المراجعة.`,
      }
    }
  }

  return { ok: true, reviewId }
}

async function attachCustomerReviewImage(args: {
  phone: string
  orderNumber: string
  reviewId: string
  file: File
}): Promise<{ ok: true } | ReviewServiceFailure> {
  const supabase = getSupabase()
  if (!supabase) return OFFLINE

  const ext = REVIEW_IMAGE_TYPES[args.file.type]
  if (!ext) return { ok: false, code: 'invalid_image', message: 'نوع الملف غير مدعوم.' }

  const path = `${args.reviewId}/photo.${ext}`

  const { error: uploadError } = await supabase.storage.from(REVIEW_UPLOADS_BUCKET).upload(path, args.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: args.file.type,
  })

  if (uploadError) {
    return { ok: false, code: 'upload_failed', message: 'تعذّر رفع الصورة. حاولي مرة أخرى.' }
  }

  const { data, error } = await supabase.rpc('attach_customer_review_image', {
    p_phone: normalizeTrackingPhone(args.phone),
    p_order_number: args.orderNumber.trim().toUpperCase(),
    p_review_id: args.reviewId,
    p_image_path: path,
  })

  if (error) return NETWORK
  const result = data as { ok?: boolean }
  if (!result?.ok) return failure(data)
  return { ok: true }
}
