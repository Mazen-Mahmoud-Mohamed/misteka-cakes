import { Link } from 'react-router-dom'
import { brand } from '@/data/brand'
import { Container } from '@/components/layout/Container'
import { getPricingNotes, listZones } from '@/services/catalogService'

export function SiteFooter() {
  const zones = listZones().map((zone) => zone.name).join(' و')

  return (
    <footer className="mt-8 border-t border-line bg-cream/70">
      <Container className="grid gap-8 py-12 md:grid-cols-[1.2fr_1fr]">
        <div>
          <img src={brand.logo} alt={brand.logoAlt} className="h-auto w-40 object-contain" />
          <p className="mt-4 font-display text-3xl text-rose-deep">{brand.nameAr}</p>
          <p className="font-latin text-xl text-gold">{brand.nameEn}</p>
          <p className="mt-3 max-w-sm leading-8 text-muted">{brand.tagline}</p>
        </div>
        <div className="grid gap-3 text-sm leading-7 text-muted">
          <p>التوصيل حاليًا داخل {zones}.</p>
          {getPricingNotes().map((note) => (
            <p key={note}>{note}</p>
          ))}
          <nav className="mt-2 flex flex-wrap gap-3 font-semibold text-ink" aria-label="تذييل">
            <Link to="/catalog" className="inline-flex min-h-11 items-center rounded-full px-3 hover:text-rose">
              التورت
            </Link>
            <Link to="/order" className="inline-flex min-h-11 items-center rounded-full px-3 hover:text-rose">
              الطلب
            </Link>
          </nav>
        </div>
      </Container>
    </footer>
  )
}
