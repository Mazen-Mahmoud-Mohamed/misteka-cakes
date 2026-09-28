import { CakeCard } from '@/components/catalog/CakeCard'
import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { listCakes } from '@/services/catalogService'

export function DesignsSection() {
  const cakes = listCakes().slice(0, 4)

  return (
    <section id="designs" className="scroll-mt-24 py-14 sm:py-20">
      <Container>
        <SectionHeading eyebrow={content.designs.eyebrow} title={content.designs.title} subtitle={content.designs.subtitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cakes.map((cake) => (
            <CakeCard key={cake.id} cake={cake} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <ButtonLink to="/catalog" variant="secondary">
            {content.hero.secondaryCta}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
