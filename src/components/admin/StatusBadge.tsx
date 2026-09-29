import type { OrderStatus } from '@/types'
import { STATUS_LABELS } from '@/types/admin'
import { cx } from '@/utils/cx'

const styles: Record<OrderStatus, string> = {
  pending_review: 'border-gold bg-gold-soft/40 text-ink',
  confirmed: 'border-sage bg-sage/15 text-sage-deep',
  rejected: 'border-rose bg-blush text-rose-deep',
  cancelled: 'border-line bg-cream text-muted',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cx(
        'inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold',
        styles[status],
      )}
    >
      <span className="me-1.5" aria-hidden="true">
        {status === 'pending_review' ? '●' : status === 'confirmed' ? '✓' : status === 'rejected' ? '✕' : '–'}
      </span>
      {STATUS_LABELS[status]}
    </span>
  )
}
