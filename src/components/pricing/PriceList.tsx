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
    <section className="rounded-[28px] border border-gold/40 bg-gold-soft/20 p-2">
      <div className="rounded-[22px] border border-line bg-paper p-4 sm:p-6">
        <h3 className="font-display text-3xl text-rose-deep">{title}</h3>
        {note ? <p className="mt-2 text-sm leading-6 text-muted">{note}</p> : null}

        <ul className="mt-5 grid gap-3 md:hidden">
          {sizes.map((size) => (
            <li key={size.id} className="rounded-2xl border border-line bg-ivory px-4 py-3">
              <p className="font-display text-2xl text-ink">{size.label}</p>
              <p className="mt-1 text-sm text-muted">يكفي {size.servingsLabel}</p>
              <p className="mt-2 font-semibold text-rose-deep">{formatEgp(size.price)}</p>
            </li>
          ))}
        </ul>

        <table className="mt-5 hidden w-full border-separate border-spacing-0 overflow-hidden rounded-2xl md:table">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="bg-sage text-ivory">
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                المقاس
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                يكفي
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                السعر
              </th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((size, index) => (
              <tr key={size.id} className={index % 2 === 0 ? 'bg-paper' : 'bg-ivory'}>
                <th scope="row" className="border-t border-line px-4 py-3 text-start font-semibold">
                  {size.label}
                </th>
                <td className="border-t border-line px-4 py-3">{size.servingsLabel}</td>
                <td className="border-t border-line px-4 py-3 font-semibold text-rose-deep">{formatEgp(size.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
