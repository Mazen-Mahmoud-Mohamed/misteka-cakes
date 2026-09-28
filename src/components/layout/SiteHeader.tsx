import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { brand } from '@/data/brand'
import { content } from '@/data/content'
import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'
import { cx } from '@/utils/cx'

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  function goPricing() {
    setOpen(false)
    if (location.pathname === '/') {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate('/', { state: { scrollTo: 'pricing' } })
  }

  function close() {
    setOpen(false)
  }

  const linkClass = 'rounded-full px-3 py-2 text-base font-semibold text-ink hover:bg-blush'

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur-md">
      <Container className="flex min-h-20 items-center justify-between gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-2" onClick={close}>
          <img src={brand.logo} alt="" className="h-14 w-auto max-w-16 object-contain" />
          <span className="truncate font-display text-3xl leading-none text-rose-deep">{brand.nameAr}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
          <Link to="/" className={linkClass}>
            الرئيسية
          </Link>
          <Link to="/catalog" className={linkClass}>
            التورت
          </Link>
          <button type="button" className={linkClass} onClick={goPricing}>
            الأسعار
          </button>
          <ButtonLink to="/order" className="ms-2">
            {content.hero.primaryCta}
          </ButtonLink>
        </nav>

        <button
          type="button"
          className="inline-flex size-12 items-center justify-center rounded-full border border-line bg-paper text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? 'إغلاق القائمة' : 'فتح القائمة'}</span>
          <span aria-hidden="true" className="grid gap-1.5">
            <span className="block h-px w-5 bg-ink" />
            <span className="block h-px w-5 bg-ink" />
            <span className="block h-px w-5 bg-ink" />
          </span>
        </button>
      </Container>

      <div id="mobile-nav" className={cx('border-t border-line bg-ivory lg:hidden', open ? 'block' : 'hidden')}>
        <nav className="grid gap-1 px-4 py-3" aria-label="تنقل الجوال">
          <Link to="/" className={linkClass} onClick={close}>
            الرئيسية
          </Link>
          <Link to="/catalog" className={linkClass} onClick={close}>
            التورت
          </Link>
          <button type="button" className={cx(linkClass, 'text-start')} onClick={goPricing}>
            الأسعار
          </button>
          <ButtonLink to="/order" className="mt-2" >
            {content.hero.primaryCta}
          </ButtonLink>
        </nav>
      </div>
    </header>
  )
}
