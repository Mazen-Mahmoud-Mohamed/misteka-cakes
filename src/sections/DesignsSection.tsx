import { CakeCard } from '@/components/catalog/CakeCard'
import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { listCakes } from '@/services/catalogService'

/** Mobile/tablet show 4 cakes (2×2); desktop shows 6 (3×2) so no row is left half-empty. */
const DESKTOP_COUNT = 6
const COMPACT_COUNT = 4

export function DesignsSection() {
  const cakes = listCakes().slice(0, DESKTOP_COUNT)

  return (
    <section id="designs" className="scroll-mt-24 py-16 sm:py-24">
      <Container>
        <SectionHeading eyebrow={content.designs.eyebrow} title={content.designs.title} subtitle={content.designs.subtitle} />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {cakes.map((cake, index) => (
            <CakeCard key={cake.id} cake={cake} className={index >= COMPACT_COUNT ? 'hidden lg:flex' : undefined} />
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-sm leading-7 text-muted">السعر حسب المقاس المختار من قائمة التورت الأساسية.</p>
          <ButtonLink to="/catalog" variant="secondary">
            {content.hero.secondaryCta}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
