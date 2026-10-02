import { CakeCarousel } from '@/components/catalog/CakeCarousel'
import { Container } from '@/components/layout/Container'
import { DriftWallShowcase } from '@/components/preview/DriftWallShowcase'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'
import { useCatalog } from '@/providers/CatalogProvider'
import { listCakes } from '@/services/catalogService'

// TEMPORARY: set to false to switch the homepage back to the CircularCarousel showcase.
const PREVIEW_DRIFTWALL = true

export function DesignsSection() {
  useCatalog()
  const cakes = listCakes()

  return (
    <section id="designs" className="scroll-mt-24 py-16 sm:py-24">
      <Container>
        <SectionHeading eyebrow={content.designs.eyebrow} title={content.designs.title} subtitle={content.designs.subtitle} />
        {PREVIEW_DRIFTWALL ? <DriftWallShowcase /> : <CakeCarousel cakes={cakes} />}
      </Container>
    </section>
  )
}
