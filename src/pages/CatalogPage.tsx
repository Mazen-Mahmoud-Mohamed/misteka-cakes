import { useState } from 'react'
import { CakeCard } from '@/components/catalog/CakeCard'
import { Container } from '@/components/layout/Container'
import { categoryLabels } from '@/data/cakes'
import { usePageTitle } from '@/hooks/usePageTitle'
import { listCakes } from '@/services/catalogService'
import type { CakeCategory } from '@/types'
import { cx } from '@/utils/cx'

const filters: Array<CakeCategory | 'all'> = ['all', 'birthday', 'celebration']

export function CatalogPage() {
  usePageTitle('التورت | مستيكا')
  const [filter, setFilter] = useState<CakeCategory | 'all'>('all')
  const cakes = listCakes().filter((cake) => filter === 'all' || cake.category === filter)

  return (
    <Container className="py-10 sm:py-14">
      <header className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="font-display text-4xl text-rose-deep sm:text-5xl">التورت</h1>
        <p className="mt-3 leading-8 text-muted">تصميمات يمكن طلبها، أو استخدامها كمرجع لتصميم قريب منها.</p>
      </header>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="group" aria-label="تصفية التورت">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={cx(
              'min-h-11 rounded-full px-4 text-sm font-semibold',
              filter === item ? 'bg-rose-deep text-ivory' : 'border border-line bg-paper text-ink',
            )}
          >
            {categoryLabels[item]}
          </button>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cakes.map((cake) => (
          <CakeCard key={cake.id} cake={cake} />
        ))}
      </div>
    </Container>
  )
}
