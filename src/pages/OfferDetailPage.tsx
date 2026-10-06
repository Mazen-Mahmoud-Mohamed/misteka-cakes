import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/layout/Container'
import { Button, ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useCatalog } from '@/providers/CatalogProvider'
import {
  getOffer,
  getProduct,
  getProductCategory,
  listProductsForOfferComponent,
} from '@/services/catalogService'
import { offerDiscountBadge, offerHasDiscount } from '@/types/products'
import { formatEgp } from '@/utils/format'
import { cx } from '@/utils/cx'

export function OfferDetailPage() {
  useCatalog()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const offer = getOffer(id)
  usePageTitle(offer ? `${offer.name} | مستكة` : 'عرض | مستكة')

  const pickable = useMemo(
    () => (offer?.components ?? []).filter((c) => c.customerPicks || (!c.productId && c.categoryId)),
    [offer],
  )

  const [picks, setPicks] = useState<Record<string, string>>({})
  const [pickError, setPickError] = useState('')

  if (!offer) {
    return (
      <Container className="py-16 text-center">
        <p className="text-muted">العرض غير متاح.</p>
        <ButtonLink to="/catalog" className="mt-6">
          العودة إلى منتجاتنا
        </ButtonLink>
      </Container>
    )
  }

  const discountBadge = offerDiscountBadge(offer)
  const showDiscount = offerHasDiscount(offer)

  function setPick(componentId: string, productId: string) {
    setPickError('')
    setPicks((prev) => ({ ...prev, [componentId]: productId }))
  }

  function startOrder() {
    for (const component of pickable) {
      const allowed = listProductsForOfferComponent(component)
      const selected = picks[component.id]
      if (!selected || !allowed.some((p) => p.id === selected)) {
        setPickError('اختاري الأصناف المطلوبة داخل العرض قبل المتابعة.')
        return
      }
    }
    const sel = pickable.map((c) => `${c.id}:${picks[c.id]}`).join(',')
    const qs = new URLSearchParams({ offer: offer!.id, mode: 'catalog' })
    if (sel) qs.set('picks', sel)
    navigate(`/order?${qs.toString()}`)
  }

  return (
    <Container className="py-10 sm:py-14">
      <nav className="mb-6 text-sm font-semibold text-muted">
        <Link to="/catalog" className="hover:text-rose">
          منتجاتنا
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{offer.name}</span>
      </nav>

      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-gold/35 bg-gradient-to-b from-[#fff8f0] to-paper shadow-[0_16px_48px_-28px_rgba(138,101,50,0.5)]">
        <div className="relative aspect-[16/10] bg-cream">
          <div className="absolute start-4 top-4 z-10 flex flex-wrap gap-2">
            <span className="rounded-full bg-rose-deep px-3 py-1 text-xs font-bold text-ivory">
              {offer.badgeLabel || 'عرض خاص'}
            </span>
            {showDiscount && discountBadge ? (
              <span className="rounded-full bg-[#8a6532] px-3 py-1 text-xs font-bold text-ivory">{discountBadge}</span>
            ) : null}
          </div>
          {offer.imageKey ? (
            <img src={offer.image} alt={offer.imageAlt || offer.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-4xl text-rose-deep/40">باقة</div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          <h1 className="font-display text-4xl text-rose-deep">{offer.name}</h1>
          <p className="mt-4 leading-8 text-muted">{offer.description}</p>

          {offer.pricingRule === 'custom_bundle' && offer.customBundlePrice != null ? (
            <p className="mt-4 text-lg font-bold text-ink">سعر الباقة: {formatEgp(offer.customBundlePrice)}</p>
          ) : null}

          <h2 className="mt-8 font-display text-2xl text-rose-deep">محتويات العرض</h2>
          <ul className="mt-4 grid gap-4">
            {offer.components.map((component) => {
              const product = component.productId ? getProduct(component.productId) : undefined
              const category = component.categoryId ? getProductCategory(component.categoryId) : undefined
              const label = product?.name || category?.name || 'عنصر'
              const needsPick = component.customerPicks || (!component.productId && !!component.categoryId)
              const choices = needsPick ? listProductsForOfferComponent(component) : []
              const pricing =
                component.componentPricing === 'free'
                  ? 'هدية'
                  : component.componentPricing === 'percent_off' && component.discountPercent != null
                    ? `خصم ${component.discountPercent}%`
                    : component.componentPricing === 'fixed_off' && component.discountAmount != null
                      ? `خصم ${formatEgp(component.discountAmount)}`
                      : component.componentPricing === 'included_in_bundle'
                        ? 'ضمن سعر الباقة'
                        : 'بالسعر الكامل'

              return (
                <li key={component.id} className="rounded-2xl border border-line/80 bg-ivory px-4 py-3">
                  <p className="font-semibold text-ink">
                    {label} × {component.quantity}
                    {component.roleLabel ? ` — ${component.roleLabel}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-muted">{pricing}</p>
                  {needsPick ? (
                    <div className="mt-3">
                      <p className="mb-2 text-sm font-bold text-rose">اختاري الصنف</p>
                      {choices.length === 0 ? (
                        <p className="text-sm text-muted">لا توجد أصناف متاحة لهذا الاختيار حاليًا.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {choices.map((choice) => {
                            const selected = picks[component.id] === choice.id
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setPick(component.id, choice.id)}
                                className={cx(
                                  'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold',
                                  selected ? 'bg-rose-deep text-ivory' : 'border border-line bg-paper text-ink',
                                )}
                              >
                                {choice.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>

          {pickError ? (
            <p role="alert" className="mt-4 text-sm text-rose-deep">
              {pickError}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="sm:flex-1" onClick={startOrder}>
              اطلبي هذا العرض
            </Button>
            <ButtonLink to="/catalog" variant="secondary" className="sm:flex-1">
              تصفّح منتجاتنا
            </ButtonLink>
          </div>
        </div>
      </div>
    </Container>
  )
}
