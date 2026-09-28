import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { Ornament } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'

export function ClosingSection() {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <div className="rounded-[32px] border border-gold/40 bg-paper px-6 py-12 text-center shadow-soft sm:px-12">
          <h2 className="font-display text-4xl text-rose-deep sm:text-5xl">{content.closing.title}</h2>
          <Ornament />
          <p className="mx-auto mt-4 max-w-xl leading-8 text-muted">{content.closing.text}</p>
          <ButtonLink to="/order" className="mt-6">
            {content.closing.cta}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
