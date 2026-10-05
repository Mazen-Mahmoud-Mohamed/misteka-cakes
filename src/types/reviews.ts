/** Customer reviews & admin testimonials — public-safe shapes only. */

export const REVIEW_SOURCES = ['customer', 'whatsapp', 'facebook', 'instagram', 'manual'] as const
export type ReviewSource = (typeof REVIEW_SOURCES)[number]

export const REVIEW_STATUSES = ['pending', 'published', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** Admin screenshot sources only — no free-text / manual writing in the form. */
export const ADMIN_SCREENSHOT_SOURCES = ['whatsapp', 'facebook', 'instagram'] as const
export type AdminScreenshotSource = (typeof ADMIN_SCREENSHOT_SOURCES)[number]

/** @deprecated Use ADMIN_SCREENSHOT_SOURCES */
export const ADMIN_TESTIMONIAL_SOURCES = ADMIN_SCREENSHOT_SOURCES
export type AdminTestimonialSource = AdminScreenshotSource

/** Max images per admin screenshot testimonial. */
export const ADMIN_TESTIMONIAL_MAX_IMAGES = 8

export interface ReviewMediaItem {
  imagePath: string
  sortOrder: number
}

/** Columns from public.site_reviews_public (+ joined public media). */
export interface PublicReview {
  /** Opaque public join key (site_reviews.id) — not order/customer PII. */
  reviewId: string | null
  displayName: string | null
  reviewText: string | null
  /** Legacy/primary image path (first media or customer photo). */
  imagePath: string | null
  /** Ordered gallery; never duplicates primary unnecessarily in UI. */
  media: ReviewMediaItem[]
  source: ReviewSource
  publishedAt: string | null
  sortOrder: number
  featured: boolean
}

/** Admin moderation row — may include order reference for moderation only. */
export interface AdminReview {
  id: string
  orderId: string | null
  orderNumber: string | null
  source: ReviewSource
  displayName: string | null
  reviewText: string | null
  imagePath: string | null
  media: ReviewMediaItem[]
  status: ReviewStatus
  sortOrder: number
  featured: boolean
  publishedAt: string | null
  moderatedAt: string | null
  moderatedBy: string | null
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

export type ReviewStatusFilter = ReviewStatus | 'all'

export interface SubmitCustomerReviewInput {
  phone: string
  orderNumber: string
  displayName: string
  reviewText: string
  image?: File | null
}

export type ReviewServiceFailure = {
  ok: false
  code: string
  message: string
}

export function isReviewSource(value: unknown): value is ReviewSource {
  return typeof value === 'string' && (REVIEW_SOURCES as readonly string[]).includes(value)
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value)
}

export function isAdminScreenshotSource(value: unknown): value is AdminScreenshotSource {
  return typeof value === 'string' && (ADMIN_SCREENSHOT_SOURCES as readonly string[]).includes(value)
}

/** @deprecated Use isAdminScreenshotSource */
export function isAdminTestimonialSource(value: unknown): value is AdminTestimonialSource {
  return isAdminScreenshotSource(value)
}

/** Ordered image paths for a review (media table first, else legacy image_path). */
export function reviewImagePaths(review: {
  imagePath?: string | null
  media?: ReviewMediaItem[]
}): string[] {
  const fromMedia = (review.media ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => m.imagePath)
    .filter(Boolean)
  if (fromMedia.length) return fromMedia
  return review.imagePath ? [review.imagePath] : []
}

/** Screenshot-only admin testimonial (image(s) are the content — no name/text). */
export function isScreenshotTestimonial(review: {
  source: ReviewSource
  displayName: string | null
  reviewText: string | null
  imagePath?: string | null
  media?: ReviewMediaItem[]
}): boolean {
  return (
    review.source !== 'customer' &&
    (review.displayName == null || review.displayName === '') &&
    (review.reviewText == null || review.reviewText === '') &&
    reviewImagePaths(review).length > 0
  )
}

/** Honest Arabic source labels — never claim website verification for admin imports. */
export function reviewSourceLabel(source: ReviewSource): string {
  switch (source) {
    case 'customer':
      return 'رأي عميل'
    case 'whatsapp':
      return 'رأي عبر WhatsApp'
    case 'facebook':
      return 'رأي عبر Facebook'
    case 'instagram':
      return 'رأي عبر Instagram'
    case 'manual':
      return 'يدوي'
  }
}

export function reviewStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case 'pending':
      return 'في انتظار المراجعة'
    case 'published':
      return 'منشورة'
    case 'rejected':
      return 'مرفوضة'
  }
}

export function arabicImageCountLabel(count: number): string {
  if (count === 1) return 'صورة واحدة'
  if (count === 2) return 'صورتان'
  if (count >= 3 && count <= 10) return `${count} صور`
  return `${count} صورة`
}
