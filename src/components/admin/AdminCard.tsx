import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

export const adminSurfaceClass = 'rounded-xl border border-line bg-paper shadow-[0_1px_2px_rgba(74,52,46,0.04)]'

export function AdminPage({ children, width = 'wide' }: { children: ReactNode; width?: 'wide' | 'narrow' }) {
  return (
    <div
      className={cx(
        'mx-auto w-full px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8',
        width === 'wide' ? 'max-w-7xl' : 'max-w-5xl',
      )}
    >
      {children}
    </div>
  )
}

export function AdminPageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {meta ? <div className="mb-1.5">{meta}</div> : null}
        <h1 className="text-2xl leading-tight font-bold text-ink sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function AdminCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = 'section',
}: {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'div'
}) {
  return (
    <Tag className={cx(adminSurfaceClass, className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? <span className="text-rose-deep">{icon}</span> : null}
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-bold text-ink">{title}</h2>
              {description ? <p className="text-xs leading-6 text-muted">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </Tag>
  )
}

/** Label/value list used in detail cards. */
export function AdminDetailList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3.5">{children}</dl>
}

export function AdminDetail({
  label,
  children,
  ltr,
}: {
  label: string
  children: ReactNode
  ltr?: boolean
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold break-words text-ink">
        {ltr ? (
          <span dir="ltr" className="inline-block">
            {children}
          </span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}
