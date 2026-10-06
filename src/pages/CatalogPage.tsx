import { useMemo, useState } from 'react'
import { OfferCard } from '@/components/catalog/OfferCard'
import { ProductCard } from '@/components/catalog/ProductCard'
import { Container } from '@/components/layout/Container'
import { ALL_CATEGORIES_LABEL } from '@/data/cakes'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useCatalog } from '@/providers/CatalogProvider'
import {
  getProductCategory,
  listChildProductCategories,
  listOffers,
  listProductsInCategory,
  listTopProductCategories,
} from '@/services/catalogService'
import { cx } from '@/utils/cx'

export function CatalogPage() {
  usePageTitle('منتجاتنا | مستكة')
  useCatalog()
  const [parentId, setParentId] = useState<string | 'all'>('all')
  const [subId, setSubId] = useState<string | 'all'>('all')

  const tops = listTopProductCategories()
  const parentFilters = useMemo(
    () => [{ id: 'all' as const, name: ALL_CATEGORIES_LABEL }, ...tops],
    [tops],
  )

  const selectedParent = parentFilters.some((f) => f.id === parentId) ? parentId : 'all'
  const parentCategory = selectedParent === 'all' ? undefined : getProductCategory(selectedParent)
  const isOffers = parentCategory?.kind === 'offers'

  const children = selectedParent === 'all' || isOffers ? [] : listChildProductCategories(selectedParent)
  const subFilters = children.length
    ? [{ id: 'all' as const, name: ALL_CATEGORIES_LABEL }, ...children]
    : []
  const selectedSub = subFilters.some((f) => f.id === subId) ? subId : 'all'

  const products = isOffers ? [] : listProductsInCategory(selectedParent, selectedSub)
  const offers = isOffers || selectedParent === 'all' ? listOffers() : []

  function selectParent(id: string | 'all') {
    setParentId(id)
    setSubId('all')
  }

  return (
    <Container className="py-10 sm:py-14">
      <header className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="font-display text-4xl text-rose-deep sm:text-5xl">منتجاتنا</h1>
        <p className="mt-3 leading-8 text-muted">
          تصفّحي التورت، الكب كيك، والكيك بوبس وغيرها — أو اطلعي على العروض والباقات.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap justify-center gap-2" role="group" aria-label="تصفية المنتجات">
        {parentFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedParent === item.id}
            onClick={() => selectParent(item.id)}
            className={cx(
              'inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold transition duration-200 motion-reduce:transition-none',
              selectedParent === item.id
                ? 'bg-rose-deep text-ivory'
                : 'border border-line bg-paper text-ink hover:border-rose/40',
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      {subFilters.length > 0 ? (
        <div className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="التصنيفات الفرعية">
          {subFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={selectedSub === item.id}
              onClick={() => setSubId(item.id)}
              className={cx(
                'inline-flex min-h-10 cursor-pointer items-center rounded-full px-3.5 text-sm font-semibold transition duration-200 motion-reduce:transition-none',
                selectedSub === item.id
                  ? 'bg-rose/90 text-ivory'
                  : 'border border-line/80 bg-ivory text-ink hover:border-rose/35',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-8" />
      )}

      {isOffers ? (
        offers.length ? (
          <div className="flex flex-wrap justify-center gap-6">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                className="w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted">لا توجد عروض منشورة حاليًا.</p>
        )
      ) : (
        <>
          {selectedParent === 'all' && offers.length > 0 ? (
            <section className="mb-12" aria-labelledby="offers-heading">
              <h2 id="offers-heading" className="mb-5 text-center font-display text-3xl text-rose-deep">
                العروض والباقات
              </h2>
              <div className="flex flex-wrap justify-center gap-6">
                {offers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    className="w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {products.length ? (
            <div className="flex flex-wrap justify-center gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  className="w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
                />
              ))}
            </div>
          ) : selectedParent === 'all' && offers.length > 0 ? null : (
            <p className="text-center text-muted">لا توجد منتجات في هذا التصنيف حاليًا.</p>
          )}
        </>
      )}
    </Container>
  )
}
