import type { ReactNode } from 'react'
import type { ChargeStatus, OrderStatus } from '@/types'
import { STATUS_LABELS } from '@/types/admin'
import { cx } from '@/utils/cx'

export type BadgeTone = 'pending' | 'success' | 'danger' | 'neutral' | 'info'

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  pending: { badge: 'border-gold/50 bg-gold-soft/35 text-[#7a5622]', dot: 'bg-gold' },
  success: { badge: 'border-sage/45 bg-sage/12 text-sage-deep', dot: 'bg-sage-deep' },
  danger: { badge: 'border-rose/35 bg-blush/70 text-rose-deep', dot: 'bg-rose' },
  neutral: { badge: 'border-line bg-cream/70 text-muted', dot: 'bg-muted/60' },
  info: { badge: 'border-line bg-ivory text-ink', dot: 'bg-ink/50' },
}

export function AdminBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold whitespace-nowrap',
        tones[tone].badge,
        className,
      )}
    >
      <span className={cx('size-1.5 rounded-full', tones[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  )
}

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending_review: 'pending',
  confirmed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <AdminBadge tone={ORDER_STATUS_TONE[status]} className={className}>
      {STATUS_LABELS[status]}
    </AdminBadge>
  )
}

export function EnabledBadge({ enabled }: { enabled: boolean }) {
  return <AdminBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'مفعّل' : 'غير مفعّل'}</AdminBadge>
}

export const PRICE_STATUS_LABELS: Record<ChargeStatus, string> = {
  known: 'معروف',
  pending: 'غير محدد بعد',
  quote: 'يُحدَّد بعد المعاينة',
  outside: 'خارج السعر',
}

export function PriceStatusBadge({ status }: { status: ChargeStatus }) {
  const tone: BadgeTone = status === 'known' ? 'info' : status === 'pending' ? 'pending' : 'neutral'
  return <AdminBadge tone={tone}>{PRICE_STATUS_LABELS[status]}</AdminBadge>
}
