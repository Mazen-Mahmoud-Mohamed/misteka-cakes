import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Container } from '@/components/layout/Container'
import { Ornament } from '@/components/ui/SectionHeading'
import {
  fetchPublishedReviews,
  publicTestimonialImageUrl,
} from '@/services/reviewService'
import {
  isScreenshotTestimonial,
  reviewImagePaths,
  reviewSourceLabel,
  type PublicReview,
} from '@/types/reviews'
import { cx } from '@/utils/cx'

/** Interval between automatic testimonial story changes (ms). */
export const REVIEWS_AUTOPLAY_MS = 5000

type Breakpoint = 'mobile' | 'tablet' | 'desktop'

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('desktop')

  useEffect(() => {
    function read(): Breakpoint {
      const w = window.innerWidth
      if (w < 640) return 'mobile'
      if (w < 1024) return 'tablet'
      return 'desktop'
    }
    const apply = () => setBp(read())
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  return bp
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return reduced
}

/** Responsive fan transforms — inspired by BounceCards, sized for Mestika. */
function stackTransforms(count: number, bp: Breakpoint): string[] {
  if (count <= 0) return []
  if (count === 1) return ['rotate(-2deg)']

  if (bp === 'mobile') {
    if (count === 2) return ['rotate(-7deg) translateX(-1.35rem)', 'rotate(7deg) translateX(1.35rem)']
    return [
      'rotate(-8deg) translateX(-2rem)',
      'rotate(2deg) translateX(-0.35rem)',
      'rotate(8deg) translateX(2rem)',
    ].slice(0, Math.min(count, 3))
  }

  if (bp === 'tablet') {
    if (count === 2) return ['rotate(-8deg) translateX(-3rem)', 'rotate(8deg) translateX(3rem)']
    if (count === 3) {
      return [
        'rotate(-8deg) translateX(-4.25rem)',
        'rotate(0deg)',
        'rotate(8deg) translateX(4.25rem)',
      ]
    }
    return [
      'rotate(-9deg) translateX(-5.5rem)',
      'rotate(-3deg) translateX(-1.75rem)',
      'rotate(3deg) translateX(1.75rem)',
      'rotate(9deg) translateX(5.5rem)',
    ].slice(0, Math.min(count, 4))
  }

  // desktop
  if (count === 2) return ['rotate(-8deg) translateX(-5rem)', 'rotate(8deg) translateX(5rem)']
  if (count === 3) {
    return [
      'rotate(-7deg) translateX(-6.5rem)',
      'rotate(0deg)',
      'rotate(7deg) translateX(6.5rem)',
    ]
  }
  if (count === 4) {
    return [
      'rotate(-9deg) translateX(-8.5rem)',
      'rotate(-3deg) translateX(-2.75rem)',
      'rotate(3deg) translateX(2.75rem)',
      'rotate(9deg) translateX(8.5rem)',
    ]
  }
  return [
    'rotate(-10deg) translateX(-9.5rem)',
    'rotate(-4deg) translateX(-4.75rem)',
    'rotate(0deg)',
    'rotate(4deg) translateX(4.75rem)',
    'rotate(10deg) translateX(9.5rem)',
  ].slice(0, Math.min(count, 5))
}

function maxVisibleCards(bp: Breakpoint): number {
  if (bp === 'mobile') return 3
  if (bp === 'tablet') return 4
  return 5
}

/** React Bits–style: strip rotation so the hovered card faces forward. */
function getNoRotationTransform(transformStr: string): string {
  if (/rotate\([^)]*\)/.test(transformStr)) {
    return transformStr.replace(/rotate\([^)]*\)/, 'rotate(0deg)')
  }
  if (!transformStr || transformStr === 'none') return 'rotate(0deg)'
  return `${transformStr} rotate(0deg)`
}

/** Nudge an existing fan transform horizontally (px), preserving rem-based fan spreads. */
function getPushedTransform(baseTransform: string, offsetPx: number): string {
  const match = baseTransform.match(/translateX\(([-0-9.]+)(px|rem)\)/)
  if (match) {
    const current = Number.parseFloat(match[1]!)
    const unit = match[2]!
    if (unit === 'px') {
      return baseTransform.replace(match[0], `translateX(${current + offsetPx}px)`)
    }
    const remDelta = offsetPx / 16
    return baseTransform.replace(match[0], `translateX(${current + remDelta}rem)`)
  }
  if (!baseTransform || baseTransform === 'none') return `translateX(${offsetPx}px)`
  return `${baseTransform} translateX(${offsetPx}px)`
}

function getHoveredTransform(baseTransform: string): string {
  return `${getNoRotationTransform(baseTransform)} scale(1.06)`
}

function hoverPushPx(bp: Breakpoint): number {
  if (bp === 'tablet') return 44
  return 58
}

function useFinePointerHover(): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const apply = () => setOk(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return ok
}

function imageAlt(review: PublicReview, index: number, total: number): string {
  if (isScreenshotTestimonial(review)) {
    return total > 1 ? `لقطة من محادثة عميل ${index + 1} من ${total}` : 'لقطة من محادثة عميل'
  }
  if (review.displayName) {
    return total > 1 ? `صورة من تجربة ${review.displayName} ${index + 1} من ${total}` : `صورة من تجربة ${review.displayName}`
  }
  return total > 1 ? `صورة شهادة ${index + 1} من ${total}` : 'صورة شهادة'
}

function GalleryLightbox({
  urls,
  index,
  alts,
  onClose,
  onIndexChange,
}: {
  urls: string[]
  index: number
  alts: string[]
  onClose: () => void
  onIndexChange: (next: number) => void
}) {
  const multi = urls.length > 1
  const safe = Math.min(Math.max(index, 0), urls.length - 1)
  const url = urls[safe]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (!multi) return
      if (e.key === 'ArrowLeft') onIndexChange((safe + 1) % urls.length)
      if (e.key === 'ArrowRight') onIndexChange((safe - 1 + urls.length) % urls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onIndexChange, multi, safe, urls.length])

  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="عرض صورة الشهادة"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 end-4 grid size-10 place-items-center rounded-full border border-line/40 bg-paper text-ink shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
        aria-label="إغلاق"
        onClick={onClose}
      >
        ×
      </button>

      {multi ? (
        <>
          <button
            type="button"
            className="absolute start-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-line/50 bg-paper/95 text-lg font-bold text-ink shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose sm:start-6"
            aria-label="الصورة السابقة"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange((safe - 1 + urls.length) % urls.length)
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="absolute end-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-line/50 bg-paper/95 text-lg font-bold text-ink shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose sm:end-6"
            aria-label="الصورة التالية"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange((safe + 1) % urls.length)
            }}
          >
            ›
          </button>
        </>
      ) : null}

      <div className="relative max-w-[min(96vw,52rem)]" onClick={(e) => e.stopPropagation()}>
        <img
          src={url}
          alt={alts[safe] ?? ''}
          className="max-h-[78vh] w-full rounded-2xl object-contain shadow-lg"
        />
        {multi ? (
          <p className="mt-3 text-center text-sm font-bold tabular-nums text-paper">
            {safe + 1} / {urls.length}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function BounceCardsStack({
  review,
  urls,
  onOpen,
}: {
  review: PublicReview
  urls: string[]
  onOpen: (index: number) => void
}) {
  const bp = useBreakpoint()
  const finePointer = useFinePointerHover()
  const rootRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(() => prefersReducedMotion())
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const visibleCount = Math.min(urls.length, maxVisibleCards(bp))
  const visible = urls.slice(0, visibleCount)
  const transforms = stackTransforms(visible.length, bp)
  const pushPx = hoverPushPx(bp)
  const cardSize =
    bp === 'mobile' ? 'size-[7.25rem]' : bp === 'tablet' ? 'size-[9.5rem]' : 'size-[11.5rem]'

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (prefersReducedMotion()) {
      setInView(true)
      return
    }
    setInView(false)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.28, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [review.reviewId, review.publishedAt, urls.join('|')])

  useEffect(() => {
    setActiveIndex(null)
  }, [review.reviewId, review.publishedAt, urls.join('|'), bp])

  if (!visible.length) return null

  function displayTransform(index: number): string {
    const base = transforms[index] ?? 'none'
    if (activeIndex == null) return base
    if (index === activeIndex) return getHoveredTransform(base)
    const dir = index < activeIndex ? -1 : 1
    return getPushedTransform(base, dir * pushPx)
  }

  function displayZ(index: number): number {
    if (activeIndex === index) return 40
    return index + 1
  }

  return (
    <div
      ref={rootRef}
      className={cx(
        'mestika-bounce-stack relative mx-auto flex h-[13.5rem] w-full max-w-[22rem] items-center justify-center overflow-visible sm:h-[17rem] sm:max-w-[28rem] lg:h-[20rem] lg:max-w-[34rem]',
        inView && 'is-inview',
      )}
      role="group"
      aria-label="صور هذه الشهادة"
      onMouseLeave={() => {
        if (finePointer) setActiveIndex(null)
      }}
    >
      {visible.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="mestika-bounce-fan absolute"
          data-active={activeIndex === i ? 'true' : undefined}
          style={{
            transform: displayTransform(i),
            zIndex: displayZ(i),
          }}
          onMouseEnter={() => {
            if (finePointer) setActiveIndex(i)
          }}
        >
          <button
            type="button"
            className={cx(
              'mestika-bounce-card block overflow-hidden rounded-[1.35rem] border border-gold-soft/70 bg-paper shadow-[0_14px_36px_rgba(74,52,46,0.14)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose',
              'transition-[box-shadow] duration-300 motion-reduce:transition-none',
              activeIndex === i
                ? 'shadow-[0_18px_42px_rgba(109,59,68,0.18)]'
                : 'hover:shadow-[0_18px_42px_rgba(109,59,68,0.18)]',
              cardSize,
            )}
            style={{ animationDelay: `${120 + i * 70}ms` }}
            aria-label={`تكبير ${imageAlt(review, i, urls.length)}`}
            onFocus={() => setActiveIndex(i)}
            onBlur={(e) => {
              const next = e.relatedTarget
              if (next instanceof Node && rootRef.current?.contains(next)) return
              setActiveIndex(null)
            }}
            onClick={() => onOpen(i)}
          >
            <span className="block size-full overflow-hidden">
              <img
                src={url}
                alt={imageAlt(review, i, urls.length)}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="size-full object-cover object-center"
                draggable={false}
              />
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}

function StoryContent({ review }: { review: PublicReview }) {
  const screenshot = isScreenshotTestimonial(review)

  if (screenshot) {
    return (
      <div className="mx-auto max-w-md text-center lg:mx-0 lg:text-start">
        <p className="inline-flex items-center rounded-full border border-line bg-blush/50 px-3 py-1 text-xs font-bold text-rose-deep">
          {reviewSourceLabel(review.source)}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md text-center lg:mx-0 lg:text-start">
      <p className="inline-flex items-center rounded-full border border-line bg-blush/50 px-3 py-1 text-xs font-bold text-rose-deep">
        رأي عميل
      </p>
      {review.reviewText ? (
        <blockquote className="mt-5 font-display text-xl leading-9 text-ink sm:text-2xl sm:leading-10">
          <span className="text-gold" aria-hidden>
            “
          </span>
          {review.reviewText}
          <span className="text-gold" aria-hidden>
            ”
          </span>
        </blockquote>
      ) : null}
      {review.displayName ? (
        <p className="mt-5 font-display text-lg text-rose-deep">— {review.displayName}</p>
      ) : null}
    </div>
  )
}

function StoryNav({
  index,
  total,
  onPrev,
  onNext,
  onSelect,
  showAutoplayHint,
}: {
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  onSelect: (i: number) => void
  showAutoplayHint?: boolean
}) {
  const labelId = useId()
  if (total <= 1) return null

  return (
    <div className="mt-10 flex flex-col items-center gap-3" aria-labelledby={labelId}>
      {showAutoplayHint ? (
        <p className="sr-only">
          الشهادات تتناوب تلقائيًا. استخدمي الأسهم أو النقاط للتنقل يدويًا.
        </p>
      ) : null}
      <p id={labelId} className="text-xs font-semibold tabular-nums text-muted">
        {index + 1} من {total}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="grid size-9 place-items-center rounded-full border border-line bg-paper text-base font-bold text-ink transition hover:border-rose/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose motion-reduce:transition-none"
          aria-label="الشهادة السابقة"
        >
          ‹
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="اختيار شهادة">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`الشهادة ${i + 1}`}
              onClick={() => onSelect(i)}
              className={cx(
                'size-2 rounded-full transition motion-reduce:transition-none',
                i === index ? 'scale-110 bg-rose-deep' : 'bg-ink/20 hover:bg-ink/35',
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onNext}
          className="grid size-9 place-items-center rounded-full border border-line bg-paper text-base font-bold text-ink transition hover:border-rose/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose motion-reduce:transition-none"
          aria-label="الشهادة التالية"
        >
          ›
        </button>
      </div>
    </div>
  )
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [ready, setReady] = useState(false)
  const [storyIndex, setStoryIndex] = useState(0)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number; alts: string[] } | null>(
    null,
  )
  const [autoplayEpoch, setAutoplayEpoch] = useState(0)
  const [hoverPaused, setHoverPaused] = useState(false)
  const reducedMotion = useReducedMotion()
  const finePointer = useFinePointerHover()
  const storyCountRef = useRef(0)

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

  useEffect(() => {
    if (storyIndex >= reviews.length) setStoryIndex(0)
  }, [reviews.length, storyIndex])

  storyCountRef.current = reviews.length

  const resetAutoplayTimer = useCallback(() => {
    setAutoplayEpoch((e) => e + 1)
  }, [])

  const goStoryManual = useCallback(
    (delta: number) => {
      const n = storyCountRef.current
      if (n <= 0) return
      setStoryIndex((i) => (i + delta + n) % n)
      resetAutoplayTimer()
    },
    [resetAutoplayTimer],
  )

  const selectStoryManual = useCallback(
    (index: number) => {
      setStoryIndex(index)
      resetAutoplayTimer()
    },
    [resetAutoplayTimer],
  )

  const lightboxOpen = lightbox !== null
  const autoplayEligible =
    reviews.length > 1 && !reducedMotion && !lightboxOpen && !(finePointer && hoverPaused)

  useEffect(() => {
    if (!autoplayEligible) return

    const id = window.setInterval(() => {
      const n = storyCountRef.current
      if (n <= 1) return
      setStoryIndex((i) => (i + 1) % n)
    }, REVIEWS_AUTOPLAY_MS)

    return () => window.clearInterval(id)
  }, [autoplayEligible, autoplayEpoch])

  if (!ready || reviews.length === 0) return null

  const active = reviews[Math.min(storyIndex, reviews.length - 1)]!
  const paths = reviewImagePaths(active)
  const urls = paths.map((p) => publicTestimonialImageUrl(p)).filter((u): u is string => Boolean(u))
  const alts = urls.map((_, i) => imageAlt(active, i, urls.length))

  return (
    <section
      id="reviews"
      className="relative z-[1] scroll-mt-24 overflow-x-clip bg-ivory/80 py-16 sm:py-24"
      aria-labelledby="reviews-heading"
    >
      <Container>
        <header className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <h2 id="reviews-heading" className="font-display text-3xl leading-tight text-rose-deep sm:text-4xl">
            آراء عملائنا
          </h2>
          <Ornament />
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted sm:text-base">
            تجارب حقيقية من عملائنا
            <span className="ms-1 text-rose" aria-hidden>
              ♥
            </span>
          </p>
        </header>

        <div
          className="reviews-story-autoplay"
          data-autoplay={autoplayEligible ? 'on' : 'off'}
          onMouseEnter={() => {
            if (finePointer) setHoverPaused(true)
          }}
          onMouseLeave={() => {
            if (!finePointer) return
            setHoverPaused(false)
            resetAutoplayTimer()
          }}
        >
          <article
            key={`${active.reviewId ?? active.publishedAt ?? storyIndex}-${urls.join('|')}`}
            className="relative mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12"
          >
            {/* RTL: content first → sits at inline-start (right). Stack second → visual gallery on the left. */}
            <div className="order-2 lg:order-1">
              <StoryContent review={active} />
            </div>

            <div className="order-1 lg:order-2">
              {urls.length > 0 ? (
                <BounceCardsStack
                  review={active}
                  urls={urls}
                  onOpen={(index) => setLightbox({ urls, index, alts })}
                />
              ) : (
                <div className="mx-auto flex h-[12rem] max-w-sm items-center justify-center rounded-[1.5rem] border border-dashed border-line bg-cream/50 px-6 text-center text-sm text-muted">
                  شهادة مكتوبة بدون صورة
                </div>
              )}
            </div>
          </article>

          <StoryNav
            index={Math.min(storyIndex, reviews.length - 1)}
            total={reviews.length}
            onPrev={() => goStoryManual(-1)}
            onNext={() => goStoryManual(1)}
            onSelect={selectStoryManual}
            showAutoplayHint={reviews.length > 1 && !reducedMotion}
          />
        </div>
      </Container>

      {lightbox ? (
        <GalleryLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          alts={lightbox.alts}
          onClose={() => {
            setLightbox(null)
            resetAutoplayTimer()
          }}
          onIndexChange={(next) => setLightbox((prev) => (prev ? { ...prev, index: next } : prev))}
        />
      ) : null}
    </section>
  )
}
