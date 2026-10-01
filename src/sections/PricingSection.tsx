import { Container } from '@/components/layout/Container'
import { PriceList } from '@/components/pricing/PriceList'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { useCatalog } from '@/providers/CatalogProvider'
import { getBasicPricing, getPricingNotes } from '@/services/catalogService'

function PricingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-line/80 bg-paper px-5 py-7 sm:px-10 sm:py-10" aria-hidden="true">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-0">
        {[0, 1].map((col) => (
          <div key={col} className={col === 0 ? 'lg:pe-10' : 'lg:border-s lg:border-line/80 lg:ps-10'}>
            <div className="h-8 w-36 animate-pulse rounded-md bg-line/55 motion-reduce:animate-none" />
            <ul className="mt-5 divide-y divide-line/80 border-t border-line/80">
              {Array.from({ length: col === 0 ? 7 : 4 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="grid flex-1 gap-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-line/55 motion-reduce:animate-none" />
                    <div className="h-3 w-20 animate-pulse rounded bg-line/40 motion-reduce:animate-none" />
                  </div>
                  <div className="h-5 w-20 animate-pulse rounded bg-line/55 motion-reduce:animate-none" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function PricingMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-dashed border-line/80 bg-paper px-5 py-12 text-center sm:px-10">
      <p className="font-display text-2xl text-rose-deep">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">{body}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-gold bg-paper px-6 text-sm font-semibold text-rose-deep transition hover:bg-gold-soft/40"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function PricingSection({ headingAs = 'h2' }: { headingAs?: 'h1' | 'h2' }) {
  const { status, error, version, reload } = useCatalog()
  // version forces a fresh read after CatalogProvider hydrates/reloads the store.
  void version
  const pricing = getBasicPricing()
  const notes = getPricingNotes()
  const isEmpty = pricing.single.length === 0 && pricing.twoTier.length === 0

  return (
    <section id="pricing" className="scroll-mt-24 bg-cream/60 py-16 sm:py-24">
      <Container>
        <SectionHeading
          as={headingAs}
          eyebrow={content.pricing.eyebrow}
          title={content.pricing.title}
          subtitle={content.pricing.subtitle}
        />

        {status === 'loading' ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">جاري تحميل الأسعار</span>
            <PricingSkeleton />
          </div>
        ) : null}

        {status === 'error' ? (
          <PricingMessage
            title="تعذّر تحميل الأسعار"
            body={error || 'تحققّي من الاتصال ثم حاولي مرة أخرى.'}
            actionLabel="إعادة المحاولة"
            onAction={() => void reload()}
          />
        ) : null}

        {status === 'ready' && isEmpty ? (
          <PricingMessage title="لا توجد أسعار معروضة" body="لا توجد مقاسات مفعّلة حاليًا. راجعي المقاسات من لوحة التحكم." />
        ) : null}

        {status === 'ready' && !isEmpty ? (
          <>
            <div className="mx-auto max-w-5xl rounded-3xl border border-line/80 bg-paper px-5 py-7 sm:px-10 sm:py-10">
              <div className="grid gap-10 lg:grid-cols-2 lg:gap-0">
                {pricing.single.length ? (
                  <div className="lg:pe-10">
                    <PriceList title={content.pricing.singleTitle} sizes={pricing.single} />
                  </div>
                ) : null}
                {pricing.twoTier.length ? (
                  <div className={pricing.single.length ? 'lg:border-s lg:border-line/80 lg:ps-10' : undefined}>
                    <PriceList
                      title={content.pricing.twoTierTitle}
                      note="عدد الأفراد تقريبي، كما في قائمة الأسعار."
                      sizes={pricing.twoTier}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {notes.length ? (
              <ul className="mx-auto mt-8 grid max-w-3xl gap-2 text-sm leading-7 text-muted">
                {notes.map((note) => (
                  <li key={note} className="flex gap-3">
                    <span className="mt-3 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </Container>
    </section>
  )
}
