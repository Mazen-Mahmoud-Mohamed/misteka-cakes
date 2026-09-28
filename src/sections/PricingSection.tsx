import { Container } from '@/components/layout/Container'
import { PriceList } from '@/components/pricing/PriceList'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { getBasicPricing, getPricingNotes } from '@/services/catalogService'

export function PricingSection() {
  const pricing = getBasicPricing()

  return (
    <section id="pricing" className="scroll-mt-24 bg-cream/50 py-14 sm:py-20">
      <Container>
        <SectionHeading eyebrow={content.pricing.eyebrow} title={content.pricing.title} subtitle={content.pricing.subtitle} />
        <div className="grid gap-6 lg:grid-cols-2">
          <PriceList title={content.pricing.singleTitle} sizes={pricing.single} />
          <PriceList title={content.pricing.twoTierTitle} note="عدد الأفراد تقريبي، كما في قائمة الأسعار." sizes={pricing.twoTier} />
        </div>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm leading-7 text-muted">
          {getPricingNotes().map((note) => (
            <li key={note} className="rounded-2xl border border-line bg-paper px-4 py-3">
              {note}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
