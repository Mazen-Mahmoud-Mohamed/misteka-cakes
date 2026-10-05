/** Customer reviews & admin testimonials — public-safe shapes only. */

export const REVIEW_SOURCES = ['customer', 'whatsapp', 'facebook', 'instagram', 'manual'] as const
export type ReviewSource = (typeof REVIEW_SOURCES)[number]

export const REVIEW_STATUSES = ['pending', 'published', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const ADMIN_TESTIMONIAL_SOURCES = ['whatsapp', 'facebook', 'instagram', 'manual'] as const
export type AdminTestimonialSource = (typeof ADMIN_TESTIMONIAL_SOURCES)[number]

/** Columns from public.site_reviews_public — never includes order/admin metadata. */
export interface PublicReview {
  displayName: string
  reviewText: string
  imagePath: string | null
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
  displayName: string
  reviewText: string
  imagePath: string | null
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
  /** Optional single image — validated client-side then uploaded via secure path. */
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

export function isAdminTestimonialSource(value: unknown): value is AdminTestimonialSource {
  return typeof value === 'string' && (ADMIN_TESTIMONIAL_SOURCES as readonly string[]).includes(value)
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
