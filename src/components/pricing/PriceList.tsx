import type { CakeSize } from '@/types'
import { formatEgp } from '@/utils/format'

export function PriceList({
  title,
  note,
  sizes,
}: {
  title: string
  note?: string
  sizes: CakeSize[]
}) {
  return (
    <section>
      <h3 className="font-display text-3xl text-rose-deep">{title}</h3>
      {note ? <p className="mt-1 text-sm leading-6 text-muted">{note}</p> : null}

      <ul className="mt-5 divide-y divide-line/80 border-t border-line/80">
        {sizes.map((size) => (
          <li key={size.id} className="flex items-center justify-between gap-4 py-3.5">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{size.label}</p>
              <p className="text-sm text-muted">يكفي {size.servingsLabel}</p>
            </div>
            <p className="shrink-0 font-display text-xl text-rose-deep tabular-nums">{formatEgp(size.price)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
