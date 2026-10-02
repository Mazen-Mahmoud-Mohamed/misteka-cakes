import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { getCategoryLabel } from '@/services/catalogService'
import type { Cake } from '@/types'
import { cx } from '@/utils/cx'

export function CakeCard({ cake, className }: { cake: Cake; className?: string }) {
  return (
    <article className={cx('group flex h-full flex-col overflow-hidden rounded-3xl border border-line/80 bg-paper', className)}>
      <div className="aspect-[4/5] overflow-hidden bg-cream">
        <img
          src={cake.image}
          alt={cake.imageAlt}
          style={{ objectPosition: cake.imagePosition }}
          className="h-full w-full object-cover motion-safe:transition motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xs font-semibold text-rose">{getCategoryLabel(cake.category)}</p>
        <h3 className="mt-1.5 font-display text-2xl leading-snug text-rose-deep sm:text-[1.75rem]">{cake.name}</h3>
        <p className="mt-2 text-sm leading-7 text-muted">{cake.description}</p>
        <div className="mt-auto flex flex-col gap-1 pt-5">
          <ButtonLink to={`/order?cake=${cake.id}&mode=catalog`} className="w-full">
            اطلبي هذا التصميم
          </ButtonLink>
          <Link
            to={`/order?cake=${cake.id}&mode=similar`}
            className="inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-rose-deep underline-offset-4 transition duration-200 hover:underline motion-reduce:transition-none"
          >
            طلب تصميم مشابه
          </Link>
        </div>
      </div>
    </article>
  )
}
