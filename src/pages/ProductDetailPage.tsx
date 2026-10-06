import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Container } from '@/components/layout/Container'
import { Button, ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useCatalog } from '@/providers/CatalogProvider'
import { socialLinks } from '@/data/socialLinks'
import { getCategoryLabel, getProduct } from '@/services/catalogService'
import { formatEgp } from '@/utils/format'
import { cx } from '@/utils/cx'

export function ProductDetailPage() {
  useCatalog()
  const { id = '' } = useParams()
  const product = getProduct(id)
  usePageTitle(product ? `${product.name} | مستكة` : 'منتج | مستكة')

  const [activeImage, setActiveImage] = useState(0)
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({})

  const images = useMemo(() => {
    if (!product) return []
    if (product.images.length) return product.images
    return product.image
      ? [{ id: 'primary', productId: product.id, image: product.image, imageKey: product.imageKey, imageAlt: product.imageAlt, sortOrder: 0 }]
      : []
  }, [product])

  if (!product) {
    return (
      <Container className="py-16 text-center">
        <p className="text-muted">المنتج غير متاح.</p>
        <ButtonLink to="/catalog" className="mt-6">
          العودة إلى منتجاتنا
        </ButtonLink>
      </Container>
    )
  }

  if (product.legacyCakeId || product.pricingMode === 'cake_sizes') {
    return <Navigate to={`/order?cake=${product.legacyCakeId || product.id}&mode=catalog`} replace />
  }

  const current = images[Math.min(activeImage, Math.max(images.length - 1, 0))]
  const optionsTotal = product.options.reduce((sum, option) => {
    const selected = selectedValues[option.id] ?? []
    return (
      sum +
      option.values
        .filter((v) => selected.includes(v.id))
        .reduce((s, v) => s + v.priceAdjustment, 0)
    )
  }, 0)

  const base = product.pricingMode === 'fixed' ? product.fixedPrice : null
  const displayTotal = base == null ? null : base + optionsTotal

  const optionQuery = Object.entries(selectedValues)
    .flatMap(([, ids]) => ids)
    .join(',')

  function toggleOption(optionId: string, valueId: string, selectionType: string) {
    setSelectedValues((prev) => {
      const currentIds = prev[optionId] ?? []
      if (selectionType === 'multi') {
        const next = currentIds.includes(valueId)
          ? currentIds.filter((id) => id !== valueId)
          : [...currentIds, valueId]
        return { ...prev, [optionId]: next }
      }
      // toggle / single
      const next = currentIds.includes(valueId) ? [] : [valueId]
      return { ...prev, [optionId]: next }
    })
  }

  const orderHref = `/order?product=${product.id}${optionQuery ? `&options=${optionQuery}` : ''}&mode=catalog`

  return (
    <Container className="py-10 sm:py-14">
      <nav className="mb-6 text-sm font-semibold text-muted">
        <Link to="/catalog" className="hover:text-rose">
          منتجاتنا
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="overflow-hidden rounded-3xl border border-line/80 bg-cream aspect-[4/5]">
            {current ? (
              <img src={current.image} alt={current.imageAlt || product.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {images.map((img, index) => (
                <button
                  key={img.id}
                  type="button"
                  aria-label={`صورة ${index + 1}`}
                  aria-pressed={index === activeImage}
                  onClick={() => setActiveImage(index)}
                  className={cx(
                    'size-16 overflow-hidden rounded-xl border',
                    index === activeImage ? 'border-rose-deep' : 'border-line',
                  )}
                >
                  <img src={img.image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold text-rose">{getCategoryLabel(product.categoryId)}</p>
          <h1 className="mt-2 font-display text-4xl text-rose-deep">{product.name}</h1>
          <p className="mt-4 leading-8 text-muted">{product.description}</p>

          <div className="mt-6 rounded-2xl border border-line/80 bg-paper p-5">
            {product.pricingMode === 'fixed' && product.fixedPrice != null ? (
              <p className="text-lg font-bold text-ink">
                {displayTotal != null ? formatEgp(displayTotal) : formatEgp(product.fixedPrice)}
              </p>
            ) : product.pricingMode === 'quote' ? (
              <p className="text-lg font-bold text-ink">اطلب السعر — لا يُحسب تلقائيًا عند الطلب</p>
            ) : (
              <p className="text-lg font-bold text-ink">السعر يُحدَّد عند التأكيد</p>
            )}
            {product.priceNote ? <p className="mt-2 text-sm text-muted">{product.priceNote}</p> : null}
          </div>

          {product.pricingMode !== 'quote' && product.options.length > 0 ? (
            <div className="mt-6 grid gap-4">
              <h2 className="font-display text-2xl text-rose-deep">خيارات إضافية</h2>
              {product.options.map((option) => (
                <fieldset key={option.id} className="rounded-2xl border border-line/80 bg-ivory p-4">
                  <legend className="px-1 text-sm font-bold text-ink">
                    {option.name}
                    {option.required ? ' *' : ''}
                  </legend>
                  {option.description ? <p className="mb-3 text-sm text-muted">{option.description}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const selected = (selectedValues[option.id] ?? []).includes(value.id)
                      return (
                        <button
                          key={value.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleOption(option.id, value.id, option.selectionType)}
                          className={cx(
                            'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold',
                            selected ? 'bg-rose-deep text-ivory' : 'border border-line bg-paper text-ink',
                          )}
                        >
                          {value.name}
                          {value.priceAdjustment > 0 ? ` (+${formatEgp(value.priceAdjustment)})` : ''}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {product.pricingMode === 'quote' ? (
              <a
                href={`${socialLinks.whatsapp}?text=${encodeURIComponent(`مرحبًا مستكة، أريد طلب سعر لمنتج: ${product.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-rose-deep px-6 text-base font-semibold text-ivory hover:bg-rose"
              >
                اطلب السعر عبر واتساب
              </a>
            ) : (
              <ButtonLink to={orderHref} className="sm:flex-1">
                اطلبي الآن
              </ButtonLink>
            )}
            <Button type="button" variant="secondary" className="sm:flex-1" onClick={() => window.history.back()}>
              رجوع
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}
