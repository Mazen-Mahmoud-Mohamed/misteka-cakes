import { useState } from 'react'
import { CakeCard } from '@/components/catalog/CakeCard'
import { Container } from '@/components/layout/Container'
import { ALL_CATEGORIES_LABEL } from '@/data/cakes'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useCatalog } from '@/providers/CatalogProvider'
import { listCakes, listCategories } from '@/services/catalogService'
import type { CakeCategory } from '@/types'
import { cx } from '@/utils/cx'

export function CatalogPage() {
  usePageTitle('التورت | مستكة')
  const [selected, setFilter] = useState<CakeCategory | 'all'>('all')
  useCatalog()
  const allCakes = listCakes()
  const filters = [
    { id: 'all', name: ALL_CATEGORIES_LABEL },
    ...listCategories().filter((category) => allCakes.some((cake) => cake.category === category.id)),
  ]
  const filter = filters.some((item) => item.id === selected) ? selected : 'all'
  const cakes = allCakes.filter((cake) => filter === 'all' || cake.category === filter)

  return (
    <Container className="py-10 sm:py-14">
      <header className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="font-display text-4xl text-rose-deep sm:text-5xl">التورت</h1>
        <p className="mt-3 leading-8 text-muted">تصميمات يمكن طلبها، أو استخدامها كمرجع لتصميم قريب منها.</p>
      </header>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="group" aria-label="تصفية التورت">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cx(
              'inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold transition duration-200 motion-reduce:transition-none',
              filter === item.id ? 'bg-rose-deep text-ivory' : 'border border-line bg-paper text-ink hover:border-rose/40',
            )}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-6">
        {cakes.map((cake) => (
          <CakeCard
            key={cake.id}
            cake={cake}
            className="w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
          />
        ))}
      </div>
    </Container>
  )
}
