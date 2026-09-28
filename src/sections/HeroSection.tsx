import butterflies from '@/assets/cakes/butterflies.jpeg'
import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { brand } from '@/data/brand'
import { content } from '@/data/content'

export function HeroSection() {
  return (
    <section className="py-8 sm:py-14">
      <Container className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="rise">
          <p className="font-latin text-2xl tracking-[0.14em] text-gold">{brand.nameEn}</p>
          <img src={brand.logo} alt={brand.logoAlt} className="mt-4 h-auto w-52 object-contain sm:w-64" />
          <h1 className="mt-5 font-display text-4xl leading-tight text-rose-deep sm:text-5xl">{brand.tagline}</h1>
          <p className="mt-4 max-w-md text-lg leading-9 text-muted">{content.hero.intro}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <ButtonLink to="/order" className="sm:min-w-44">
              {content.hero.primaryCta}
            </ButtonLink>
            <ButtonLink to="/catalog" variant="secondary" className="sm:min-w-44">
              {content.hero.secondaryCta}
            </ButtonLink>
          </div>
        </div>
        <div className="rise rounded-[32px] border border-gold/40 bg-gold-soft/20 p-2 shadow-soft">
          <img
            src={butterflies}
            alt="تورتة وردية من مستيكا، مزينة بفراشات وخرز"
            className="aspect-[4/5] w-full rounded-[26px] object-cover"
          />
        </div>
      </Container>
    </section>
  )
}
