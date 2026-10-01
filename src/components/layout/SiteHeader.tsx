import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { brand } from '@/data/brand'
import { content } from '@/data/content'
import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'
import { cx } from '@/utils/cx'

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  function close() {
    setOpen(false)
  }

  const linkClass =
    'inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-base font-semibold text-ink transition duration-200 hover:bg-blush motion-reduce:transition-none'

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur-md">
      <Container className="flex min-h-20 items-center justify-between gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-2" onClick={close}>
          <img src={brand.logo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
          <span className="truncate font-display text-3xl leading-none text-rose-deep">{brand.nameAr}</span>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex" aria-label="التنقل الرئيسي">
          <Link to="/" className={linkClass}>
            الرئيسية
          </Link>
          <Link to="/catalog" className={linkClass}>
            التورت
          </Link>
          <Link to="/pricing" className={linkClass}>
            الأسعار
          </Link>
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
        <nav className="grid gap-2 px-4 py-4" aria-label="تنقل الجوال">
          <Link to="/" className={linkClass} onClick={close}>
            الرئيسية
          </Link>
          <Link to="/catalog" className={linkClass} onClick={close}>
            التورت
          </Link>
          <Link to="/pricing" className={linkClass} onClick={close}>
            الأسعار
          </Link>
          <ButtonLink to="/order" className="mt-2" >
            {content.hero.primaryCta}
          </ButtonLink>
        </nav>
      </div>
    </header>
  )
}
