import { Container } from '@/components/layout/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { useCatalog } from '@/providers/CatalogProvider'
import { listPricingSections, listProducts, listSizes } from '@/services/catalogService'
import { resolvePricingItem, type ResolvedPricingRow } from '@/services/pricingContent'
import { cx } from '@/utils/cx'

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

type ResolvedSection = {
  id: string
  title: string
  description: string
  width: 'full' | 'half'
  rows: ResolvedPricingRow[]
}

function PricingCard({ section }: { section: ResolvedSection }) {
  const priced = section.rows.filter((row) => row.type === 'row')
  const notes = section.rows.filter((row) => row.type === 'note')
  const texts = section.rows.filter((row) => row.type === 'text')
  return (
    <div
      className={cx(
        'min-w-0 rounded-3xl border border-line/80 bg-paper px-5 py-7 sm:px-10 sm:py-10',
        section.width === 'full' && 'lg:col-span-2',
      )}
    >
      <h3 className="font-display text-2xl text-rose-deep sm:text-3xl">{section.title}</h3>
      {section.description ? <p className="mt-2 text-sm leading-7 text-muted">{section.description}</p> : null}
      {texts.map((row) => (
        <p key={row.id} className="mt-4 text-sm leading-7 whitespace-pre-line text-ink sm:text-base">
          {row.type === 'text' ? row.text : null}
        </p>
      ))}
      {priced.length ? (
        <ul className="mt-5 divide-y divide-line/80 border-t border-line/80">
          {priced.map((row) =>
            row.type === 'row' ? (
              <li key={row.id} className="flex items-start justify-between gap-4 py-3.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink sm:text-base">{row.label}</span>
                  {row.sublabel ? <span className="block text-xs text-muted sm:text-sm">{row.sublabel}</span> : null}
                  {row.note ? <span className="mt-0.5 block text-xs leading-6 text-muted">{row.note}</span> : null}
                </span>
                <span className="shrink-0 text-sm font-semibold text-rose-deep sm:text-base">{row.price}</span>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      {notes.length ? (
        <ul className="mt-4 grid gap-2 text-sm leading-7 text-muted">
          {notes.map((row) => (
            <li key={row.id} className="flex gap-3">
              <span className="mt-3 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
              <span>{row.type === 'note' ? row.text : null}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function PricingSection({ headingAs = 'h2' }: { headingAs?: 'h1' | 'h2' }) {
  const { status, error, version, reload } = useCatalog()
  void version
  const sources = { sizes: listSizes(), products: listProducts() }
  const sections: ResolvedSection[] = listPricingSections()
    .map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      width: section.width,
      rows: section.items
        .map((item) => resolvePricingItem(item, sources))
        .filter((row): row is ResolvedPricingRow => row !== null),
    }))
    .filter((section) => section.rows.length > 0)
  const isEmpty = sections.length === 0

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
          <PricingMessage title="لا توجد أسعار معروضة" body="لا توجد أسعار معروضة حاليًا. تواصلي معنا لمعرفة الأسعار." />
        ) : null}

        {status === 'ready' && !isEmpty ? (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
            {sections.map((section) => (
              <PricingCard key={section.id} section={section} />
            ))}
          </div>
        ) : null}
      </Container>
    </section>
  )
}
