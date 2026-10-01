import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/utils/cx'

export type StatTone = 'default' | 'pending' | 'success' | 'danger' | 'neutral' | 'brand'

const iconTones: Record<StatTone, string> = {
  default: 'bg-cream text-ink',
  pending: 'bg-gold-soft/45 text-[#7a5622]',
  success: 'bg-sage/15 text-sage-deep',
  danger: 'bg-blush text-rose-deep',
  neutral: 'bg-cream text-muted',
  brand: 'bg-rose-deep/10 text-rose-deep',
}

export function AdminStatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  to,
  highlight,
}: {
  label: string
  value: number | string
  hint?: string
  icon?: ReactNode
  tone?: StatTone
  to?: string
  highlight?: boolean
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8125rem] leading-6 font-semibold text-muted">{label}</p>
        {icon ? (
          <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', iconTones[tone])}>{icon}</span>
        ) : null}
      </div>
      <p className="mt-1 text-[1.75rem] leading-none font-bold text-ink tabular-nums">{value}</p>
      {hint ? <p className="mt-2 truncate text-xs text-muted">{hint}</p> : null}
    </>
  )

  const className = cx(
    'flex h-full min-h-[7.5rem] flex-col rounded-xl border p-4 transition-colors duration-150 motion-reduce:transition-none',
    highlight ? 'border-gold/60 bg-gold-soft/20' : 'border-line bg-paper',
  )

  if (to) {
    return (
      <Link to={to} className={cx(className, 'hover:border-rose/40')}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}
