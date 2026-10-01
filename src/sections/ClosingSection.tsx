import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { content } from '@/data/content'

export function ClosingSection() {
  return (
    <section className="pb-16 sm:pb-24">
      <Container>
        <div className="mx-auto max-w-3xl border-t border-gold/40 pt-12 text-center sm:pt-14">
          <h2 className="font-display text-3xl text-rose-deep sm:text-4xl">{content.closing.title}</h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-muted">{content.closing.text}</p>
          <ButtonLink to="/order" className="mt-8 sm:min-w-56">
            {content.closing.cta}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
