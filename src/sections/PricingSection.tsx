import { Container } from '@/components/layout/Container'
import { PriceList } from '@/components/pricing/PriceList'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { getBasicPricing, getPricingNotes } from '@/services/catalogService'

export function PricingSection({ headingAs = 'h2' }: { headingAs?: 'h1' | 'h2' }) {
  const pricing = getBasicPricing()

  return (
    <section id="pricing" className="scroll-mt-24 bg-cream/60 py-16 sm:py-24">
      <Container>
        <SectionHeading
          as={headingAs}
          eyebrow={content.pricing.eyebrow}
          title={content.pricing.title}
          subtitle={content.pricing.subtitle}
        />
        <div className="mx-auto max-w-5xl rounded-3xl border border-line/80 bg-paper px-5 py-7 sm:px-10 sm:py-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-0">
            <div className="lg:pe-10">
              <PriceList title={content.pricing.singleTitle} sizes={pricing.single} />
            </div>
            <div className="lg:border-s lg:border-line/80 lg:ps-10">
              <PriceList title={content.pricing.twoTierTitle} note="عدد الأفراد تقريبي، كما في قائمة الأسعار." sizes={pricing.twoTier} />
            </div>
          </div>
        </div>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-2 text-sm leading-7 text-muted">
          {getPricingNotes().map((note) => (
            <li key={note} className="flex gap-3">
              <span className="mt-3 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
