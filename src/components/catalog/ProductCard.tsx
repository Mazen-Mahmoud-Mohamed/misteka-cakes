import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { socialLinks } from '@/data/socialLinks'
import { getCategoryLabel, getCake } from '@/services/catalogService'
import type { Product } from '@/types/products'
import { isCakeOrdering, isQuoteOrdering } from '@/types/products'
import { cx } from '@/utils/cx'
import { formatEgp } from '@/utils/format'

function productHref(product: Product): string {
  if (isQuoteOrdering(product)) return `/product/${product.id}`
  if (isCakeOrdering(product)) {
    const cakeId = product.legacyCakeId || product.id
    return `/order?cake=${cakeId}&mode=catalog`
  }
  return `/product/${product.id}`
}

function quoteWhatsAppHref(product: Product): string {
  const text = encodeURIComponent(`مرحبًا مستكة، أريد طلب سعر لمنتج: ${product.name}`)
  return `${socialLinks.whatsapp}?text=${text}`
}

function priceLabelFor(product: Product): string | null {
  if (isQuoteOrdering(product)) return 'اطلب السعر'
  if (isCakeOrdering(product)) return 'السعر حسب المقاس'
  const packages = product.priceTiers.filter((t) => t.tierKind === 'package' && t.enabled)
  if (packages.length > 0) {
    const prices = packages.map((p) => p.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? `من ${formatEgp(min)}` : `من ${formatEgp(min)} — ${formatEgp(max)}`
  }
  const weights = product.priceTiers.filter((t) => t.tierKind === 'weight' && t.enabled)
  if (weights.length > 0) {
    const min = Math.min(...weights.map((w) => w.price))
    return `من ${formatEgp(min)}`
  }
  if (product.fixedPrice != null) return formatEgp(product.fixedPrice)
  return null
}

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const cake = product.legacyCakeId ? getCake(product.legacyCakeId) : undefined
  const href = productHref(product)
  const isQuote = isQuoteOrdering(product)
  const priceLabel = priceLabelFor(product)

  return (
    <article className={cx('group flex h-full flex-col overflow-hidden rounded-3xl border border-line/80 bg-paper', className)}>
      <Link to={href} className="aspect-[4/5] overflow-hidden bg-cream">
        <img
          src={product.image || cake?.image}
          alt={product.imageAlt || product.name}
          className="h-full w-full object-cover motion-safe:transition motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.02]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xs font-semibold text-rose">{getCategoryLabel(product.categoryId)}</p>
        <h2 className="mt-1.5 font-display text-2xl leading-snug text-rose-deep sm:text-[1.75rem]">{product.name}</h2>
        <p className="mt-2 text-sm leading-7 text-muted">{product.description}</p>
        {priceLabel ? <p className="mt-3 text-sm font-semibold text-ink/80">{priceLabel}</p> : null}
        <div className="mt-auto flex flex-col gap-1 pt-5">
          {isQuote ? (
            <a
              href={quoteWhatsAppHref(product)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rose-deep px-6 text-base font-semibold text-ivory transition duration-200 hover:bg-rose"
            >
              اطلب السعر
            </a>
          ) : isCakeOrdering(product) ? (
            <>
              <ButtonLink to={`/order?cake=${product.legacyCakeId || product.id}&mode=catalog`} className="w-full">
                اطلبي هذا التصميم
              </ButtonLink>
              <Link
                to={`/order?cake=${product.legacyCakeId || product.id}&mode=similar`}
                className="inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-rose-deep underline-offset-4 transition duration-200 hover:underline motion-reduce:transition-none"
              >
                طلب تصميم مشابه
              </Link>
            </>
          ) : (
            <ButtonLink to={href} className="w-full">
              عرض التفاصيل
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  )
}
