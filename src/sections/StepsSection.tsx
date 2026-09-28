import { Container } from '@/components/layout/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'

export function StepsSection() {
  return (
    <section id="steps" className="scroll-mt-24 bg-cream/50 py-14 sm:py-20">
      <Container>
        <SectionHeading eyebrow={content.steps.eyebrow} title={content.steps.title} />
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {content.steps.items.map((item, index) => (
            <li key={item.title} className="rounded-[28px] border border-line bg-paper p-5">
              <span className="flex size-10 items-center justify-center rounded-full border border-gold text-gold" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl text-rose-deep">{item.title}</h3>
              <p className="mt-2 leading-7 text-muted">{item.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
