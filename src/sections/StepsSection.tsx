import { Container } from '@/components/layout/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'

export function StepsSection() {
  return (
    <section id="steps" className="scroll-mt-24 pt-16 pb-10 sm:pt-24 sm:pb-12">
      <Container>
        <SectionHeading eyebrow={content.steps.eyebrow} title={content.steps.title} />
        <ol className="relative mx-auto grid max-w-5xl gap-8 lg:grid-cols-4 lg:gap-6">
          <span className="absolute inset-y-5 start-5 w-px bg-gold/50 lg:hidden" aria-hidden="true" />
          <span className="absolute inset-x-[12.5%] top-5 hidden h-px bg-gold/50 lg:block" aria-hidden="true" />
          {content.steps.items.map((item, index) => (
            <li key={item.title} className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center">
              <span
                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-deep font-semibold text-ivory ring-4 ring-ivory"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="lg:mt-2">
                <h3 className="font-display text-2xl text-rose-deep">{item.title}</h3>
                <p className="mt-1 text-sm leading-7 text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
