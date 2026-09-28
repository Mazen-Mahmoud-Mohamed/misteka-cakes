import { Container } from '@/components/layout/Container'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { content } from '@/data/content'

const paths = [
  {
    title: 'تصميم من الموقع',
    text: 'اختاري تورتة من التشكيلة واطلبيها.',
    to: '/order?mode=catalog',
  },
  {
    title: 'قريب من تورتة سابقة',
    text: 'حددي التصميم، واكتبي الفرق الذي تريدينه.',
    to: '/order?mode=similar',
  },
  {
    title: 'صورة مع وصف',
    text: 'أرفقي صورة مرجعية، واشرحي الألوان والكتابة.',
    to: '/order?mode=custom',
  },
]

export function CustomSection() {
  return (
    <section id="custom" className="scroll-mt-24 py-14 sm:py-20">
      <Container>
        <SectionHeading eyebrow={content.custom.eyebrow} title={content.custom.title} subtitle={content.custom.subtitle} />
        <div className="grid gap-4 md:grid-cols-3">
          {paths.map((path) => (
            <article key={path.title} className="flex flex-col rounded-[28px] border border-line bg-paper p-6 shadow-soft">
              <h3 className="font-display text-3xl text-rose-deep">{path.title}</h3>
              <p className="mt-3 flex-1 leading-8 text-muted">{path.text}</p>
              <ButtonLink to={path.to} variant="secondary" className="mt-6">
                ابدئي الطلب
              </ButtonLink>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-7 text-muted">{content.custom.cupcakesNote}</p>
      </Container>
    </section>
  )
}
