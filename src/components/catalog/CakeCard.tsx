import { categoryLabels } from '@/data/cakes'
import { ButtonLink } from '@/components/ui/Button'
import type { Cake } from '@/types'

export function CakeCard({ cake }: { cake: Cake }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-line bg-paper shadow-soft">
      <div className="aspect-[3/4] overflow-hidden bg-cream">
        <img
          src={cake.image}
          alt={cake.imageAlt}
          style={{ objectPosition: cake.imagePosition }}
          className="h-full w-full object-cover motion-safe:transition motion-safe:duration-500 motion-safe:hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-sm font-semibold text-rose">{categoryLabels[cake.category]}</p>
        <h3 className="font-display text-3xl leading-tight text-rose-deep">{cake.name}</h3>
        <p className="leading-7 text-muted">{cake.description}</p>
        <p className="text-sm leading-6 text-muted">السعر حسب المقاس المختار من قائمة التورت الأساسية.</p>
        <div className="mt-auto grid gap-2 pt-2">
          <ButtonLink to={`/order?cake=${cake.id}&mode=catalog`}>اطلبي هذا التصميم</ButtonLink>
          <ButtonLink to={`/order?cake=${cake.id}&mode=similar`} variant="secondary">
            طلب تصميم مشابه
          </ButtonLink>
        </div>
      </div>
    </article>
  )
}
