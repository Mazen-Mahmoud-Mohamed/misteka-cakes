import { useEffect, useState } from 'react'
import { Container } from '@/components/layout/Container'
import { Ornament } from '@/components/ui/SectionHeading'
import {
  fetchPublishedReviews,
  publicTestimonialImageUrl,
} from '@/services/reviewService'
import { reviewSourceLabel, type PublicReview } from '@/types/reviews'
import { cx } from '@/utils/cx'

function ReviewCard({ review, index }: { review: PublicReview; index: number }) {
  const imageUrl = publicTestimonialImageUrl(review.imagePath)
  return (
    <article
      className={cx(
        'flex h-full flex-col overflow-hidden rounded-3xl border border-line/80 bg-paper',
        'transition duration-300 motion-reduce:transition-none',
        'hover:border-rose/25 hover:shadow-[0_12px_40px_rgba(74,52,46,0.06)]',
      )}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      {imageUrl ? (
        <div className="aspect-[4/3] overflow-hidden bg-cream/80">
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <p className="text-sm leading-7 text-ink/90">&ldquo;{review.reviewText}&rdquo;</p>
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 pt-1">
          <p className="font-display text-xl text-rose-deep">{review.displayName}</p>
          <p className="text-xs font-semibold text-muted">{reviewSourceLabel(review.source)}</p>
        </div>
      </div>
    </article>
  )
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchPublishedReviews()
      if (cancelled) return
      setReviews(result.reviews)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Hide entirely when empty or still loading with no data — avoid ugly empty state.
  if (!ready || reviews.length === 0) return null

  return (
    <section id="reviews" className="scroll-mt-24 bg-ivory py-16 sm:py-24" aria-labelledby="reviews-heading">
      <Container>
        <header className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <h2 id="reviews-heading" className="font-display text-3xl leading-tight text-rose-deep sm:text-4xl">
            آراء عملائنا
          </h2>
          <Ornament />
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted sm:text-base">
            كلمات من عملاء حقيقيين ومن مشاركات عبر قنواتنا — بعد المراجعة.
          </p>
        </header>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {reviews.map((review, index) => (
            <li key={`${review.displayName}-${review.publishedAt ?? index}-${index}`}>
              <ReviewCard review={review} index={index} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
