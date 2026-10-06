import { Container } from '@/components/layout/Container'
import { PriceList } from '@/components/pricing/PriceList'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { useCatalog } from '@/providers/CatalogProvider'
import {
  getBasicPricing,
  getPricingNotes,
  listChildProductCategories,
  listProductsInCategory,
  listTopProductCategories,
} from '@/services/catalogService'
import { isCakeOrdering, isQuoteOrdering, type Product } from '@/types/products'
import { formatEgp } from '@/utils/format'

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

function productPriceRows(product: Product): Array<{ id: string; label: string; price: string }> {
  if (isQuoteOrdering(product)) {
    return [{ id: `${product.id}-quote`, label: product.name, price: 'اطلب السعر' }]
  }
  if (isCakeOrdering(product)) return []
  const packages = product.priceTiers.filter((t) => t.tierKind === 'package' && t.enabled)
  if (packages.length) {
    return packages.map((t) => ({
      id: t.id,
      label: `${product.name} — ${t.label}`,
      price: formatEgp(t.price),
    }))
  }
  const weights = product.priceTiers.filter((t) => t.tierKind === 'weight' && t.enabled)
  if (weights.length) {
    return weights.map((t) => ({
      id: t.id,
      label: `${product.name} — ${t.label}`,
      price: formatEgp(t.price),
    }))
  }
  const ranges = product.priceTiers.filter((t) => t.tierKind === 'quantity_range' && t.enabled)
  if (ranges.length) {
    return ranges.map((t) => ({
      id: t.id,
      label: `${product.name} — ${t.label}`,
      price: `${formatEgp(t.price)} / قطعة`,
    }))
  }
  if (product.fixedPrice != null) {
    return [
      {
        id: product.id,
        label:
          product.orderingModel === 'quantity'
            ? `${product.name} — للقطعة`
            : product.name,
        price: formatEgp(product.fixedPrice),
      },
    ]
  }
  return []
}

export function PricingSection({ headingAs = 'h2' }: { headingAs?: 'h1' | 'h2' }) {
  const { status, error, version, reload } = useCatalog()
  void version
  const pricing = getBasicPricing()
  const notes = getPricingNotes()
  const roots = listTopProductCategories().filter((c) => c.kind !== 'offers')
  const catalogSections = roots
    .map((root) => {
      const subs = listChildProductCategories(root.id)
      const products =
        subs.length > 0
          ? subs.flatMap((sub) => listProductsInCategory(sub.id, 'all'))
          : listProductsInCategory(root.id, 'all')
      const nonCake = products.filter((p) => !isCakeOrdering(p))
      const rows = nonCake.flatMap(productPriceRows)
      return { root, rows }
    })
    .filter((section) => section.rows.length > 0)

  const hasCakePricing = pricing.single.length > 0 || pricing.twoTier.length > 0
  const isEmpty = !hasCakePricing && catalogSections.length === 0

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
          <PricingMessage title="لا توجد أسعار معروضة" body="لا توجد منتجات أو مقاسات مفعّلة حاليًا." />
        ) : null}

        {status === 'ready' && !isEmpty ? (
          <div className="mx-auto grid max-w-5xl gap-8">
            {hasCakePricing ? (
              <div className="rounded-3xl border border-line/80 bg-paper px-5 py-7 sm:px-10 sm:py-10">
                <h3 className="font-display text-3xl text-rose-deep">التورت</h3>
                <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-0">
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
            ) : null}

            {catalogSections.map((section) => (
              <div key={section.root.id} className="rounded-3xl border border-line/80 bg-paper px-5 py-7 sm:px-10 sm:py-10">
                <h3 className="font-display text-3xl text-rose-deep">{section.root.name}</h3>
                <ul className="mt-5 divide-y divide-line/80 border-t border-line/80">
                  {section.rows.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-4 py-3.5">
                      <span className="text-sm font-semibold text-ink sm:text-base">{row.label}</span>
                      <span className="shrink-0 font-latin text-sm font-semibold text-rose-deep sm:text-base">
                        {row.price}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {notes.length ? (
              <ul className="mx-auto grid max-w-3xl gap-2 text-sm leading-7 text-muted">
                {notes.map((note) => (
                  <li key={note} className="flex gap-3">
                    <span className="mt-3 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  )
}
