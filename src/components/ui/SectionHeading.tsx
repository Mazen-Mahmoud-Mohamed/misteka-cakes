export function Ornament() {
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-gold" aria-hidden="true">
      <span className="h-px w-10 bg-gold-soft sm:w-14" />
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 0.8 8.2 5.8 13.2 7 8.2 8.2 7 13.2 5.8 8.2 0.8 7 5.8 5.8Z" />
      </svg>
      <span className="h-px w-10 bg-gold-soft sm:w-14" />
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  id,
  as: Heading = 'h2',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  id?: string
  as?: 'h1' | 'h2'
}) {
  return (
    <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
      {eyebrow ? <p className="mb-2 text-sm font-semibold text-rose">{eyebrow}</p> : null}
      <Heading id={id} className="font-display text-3xl leading-tight text-rose-deep sm:text-4xl">
        {title}
      </Heading>
      <Ornament />
      {subtitle ? <p className="mt-4 text-base leading-8 text-muted">{subtitle}</p> : null}
    </header>
  )
}
