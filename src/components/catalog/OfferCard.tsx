import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { offerDiscountBadge, offerHasDiscount, type Offer } from '@/types/products'
import { cx } from '@/utils/cx'
import { formatEgp } from '@/utils/format'

export function OfferCard({ offer, className }: { offer: Offer; className?: string }) {
  const discountBadge = offerDiscountBadge(offer)
  const showDiscount = offerHasDiscount(offer)
  const primaryBadge = showDiscount && discountBadge ? discountBadge : offer.badgeLabel || 'عرض خاص'

  return (
    <article
      className={cx(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border border-gold/35 bg-gradient-to-b from-[#fff8f0] to-paper shadow-[0_12px_40px_-24px_rgba(138,101,50,0.45)]',
        className,
      )}
    >
      <div className="absolute start-4 top-4 z-10 flex flex-wrap gap-2">
        <span className="rounded-full bg-rose-deep px-3 py-1 text-xs font-bold text-ivory">{primaryBadge}</span>
        {showDiscount && discountBadge && discountBadge !== primaryBadge ? (
          <span className="rounded-full bg-[#8a6532] px-3 py-1 text-xs font-bold text-ivory">{discountBadge}</span>
        ) : null}
      </div>
      <Link to={`/offer/${offer.id}`} className="aspect-[16/11] overflow-hidden bg-cream">
        {offer.imageKey ? (
          <img
            src={offer.image}
            alt={offer.imageAlt || offer.name}
            className="h-full w-full object-cover motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-blush/40 font-display text-3xl text-rose-deep/50">باقة</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h2 className="font-display text-2xl leading-snug text-rose-deep sm:text-[1.75rem]">{offer.name}</h2>
        <p className="mt-2 text-sm leading-7 text-muted">{offer.description}</p>
        {offer.pricingRule === 'custom_bundle' && offer.customBundlePrice != null ? (
          <p className="mt-3 text-sm font-bold text-ink">سعر الباقة: {formatEgp(offer.customBundlePrice)}</p>
        ) : null}
        <ul className="mt-3 grid gap-1 text-sm text-ink/80">
          {offer.components.slice(0, 4).map((c) => (
            <li key={c.id}>
              ×{c.quantity}
              {c.roleLabel ? ` — ${c.roleLabel}` : ''}
              {c.componentPricing === 'free' ? ' (هدية)' : ''}
              {c.componentPricing === 'percent_off' && c.discountPercent != null ? ` (خصم ${c.discountPercent}%)` : ''}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-5">
          <ButtonLink to={`/offer/${offer.id}`} className="w-full">
            تفاصيل العرض
          </ButtonLink>
        </div>
      </div>
    </article>
  )
}
