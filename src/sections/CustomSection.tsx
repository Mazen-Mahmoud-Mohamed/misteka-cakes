import { Link } from 'react-router-dom'
import { Container } from '@/components/layout/Container'
import { Ornament } from '@/components/ui/SectionHeading'
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
    <section id="custom" className="scroll-mt-24 bg-cream/60 py-16 sm:py-24">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
        <header className="text-center lg:sticky lg:top-28 lg:text-start">
          <p className="mb-2 text-sm font-semibold text-rose">{content.custom.eyebrow}</p>
          <h2 className="font-display text-3xl leading-tight text-rose-deep sm:text-4xl">{content.custom.title}</h2>
          <div className="lg:[&>div]:justify-start">
            <Ornament />
          </div>
          <p className="mx-auto mt-4 max-w-md leading-8 text-muted lg:mx-0">{content.custom.subtitle}</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted lg:mx-0">{content.custom.cupcakesNote}</p>
        </header>

        <ul className="divide-y divide-line/80 overflow-hidden rounded-3xl border border-line/80 bg-paper">
          {paths.map((path) => (
            <li key={path.title}>
              <Link
                to={path.to}
                className="group flex flex-col gap-3 px-5 py-6 transition duration-200 hover:bg-blush/40 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 motion-reduce:transition-none"
              >
                <span className="min-w-0">
                  <span className="block font-display text-2xl text-rose-deep">{path.title}</span>
                  <span className="mt-1 block leading-7 text-muted">{path.text}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-rose-deep">
                  ابدئي الطلب
                  <span aria-hidden="true" className="transition duration-200 group-hover:-translate-x-1 motion-reduce:transition-none">
                    ←
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
