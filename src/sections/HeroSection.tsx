import butterflies from '@/assets/cakes/butterflies.jpeg'
import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { TextType } from '@/components/ui/TextType'
import { brand } from '@/data/brand'
import { content } from '@/data/content'

export function HeroSection() {
  return (
    <section className="pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20">
      <Container className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="rise text-center lg:text-start">
          <span className="mx-auto block size-36 overflow-hidden rounded-full sm:size-44 lg:mx-0">
            {/* The ring sits at 47.7% / 45% of the canvas and spans ~82%; centre it and fill the circle. */}
            <img
              src={brand.logo}
              alt={brand.logoAlt}
              className="block size-full object-cover"
              style={{ transform: 'translate(2.6%, 5.8%) scale(1.15)' }}
            />
          </span>
          <p className="mt-5 font-latin text-lg tracking-[0.18em] text-[#8a6532]">{brand.nameEn}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-rose-deep sm:text-5xl lg:text-[3.4rem]">
            <TextType text={brand.tagline} />
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-muted lg:mx-0">{content.hero.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <ButtonLink to="/order" className="sm:min-w-48">
              {content.hero.primaryCta}
            </ButtonLink>
            <ButtonLink to="/catalog" variant="secondary" className="sm:min-w-48">
              {content.hero.secondaryCta}
            </ButtonLink>
          </div>
        </div>
        <div className="rise mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none">
          <img
            src={butterflies}
            fetchPriority="high"
            alt="تورتة وردية من مستكة، مزينة بفراشات وخرز"
            className="aspect-[4/5] w-full rounded-3xl object-cover object-[center_30%] shadow-soft"
          />
        </div>
      </Container>
    </section>
  )
}
