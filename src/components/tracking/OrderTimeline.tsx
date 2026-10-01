import type { OrderStatus, ServiceType } from '@/types'
import type { TrackedOrderEvent } from '@/services/trackingService'
import { cx } from '@/utils/cx'
import { lifecycleFor, STATUS_LABELS } from '@/utils/orderStatus'

type StageState = 'completed' | 'current' | 'upcoming' | 'terminal'

interface Stage {
  status: OrderStatus
  state: StageState
  at?: string
}

const STATE_SR: Record<StageState, string> = {
  completed: 'مرحلة مكتملة',
  current: 'المرحلة الحالية',
  upcoming: 'مرحلة قادمة',
  terminal: 'حالة نهائية',
}

function formatEventTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function buildStages(status: OrderStatus, serviceType: ServiceType, events: TrackedOrderEvent[]): Stage[] {
  const flow = lifecycleFor(serviceType)
  const at = new Map<OrderStatus, string>()
  for (const event of events) at.set(event.status, event.at)

  if (status === 'rejected' || status === 'cancelled') {
    const reached = events.map((e) => e.status).filter((s) => flow.includes(s))
    const last = reached.length ? reached[reached.length - 1] : 'pending_review'
    const lastIndex = Math.max(0, flow.indexOf(last))
    return [
      ...flow.slice(0, lastIndex + 1).map((s) => ({ status: s, state: 'completed' as const, at: at.get(s) })),
      { status, state: 'terminal', at: at.get(status) },
    ]
  }

  const currentIndex = Math.max(0, flow.indexOf(status))
  return flow.map((s, i) => ({
    status: s,
    state: i < currentIndex ? 'completed' : i === currentIndex ? (s === 'delivered' ? 'completed' : 'current') : 'upcoming',
    at: i <= currentIndex ? at.get(s) : undefined,
  }))
}

function Marker({ state }: { state: StageState }) {
  if (state === 'completed') {
    return (
      <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-sage-deep text-ivory" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    )
  }
  if (state === 'terminal') {
    return (
      <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-rose-deep text-ivory" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M7 7l10 10M17 7 7 17" />
        </svg>
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 border-rose-deep bg-paper" aria-hidden="true">
        <span className="size-3 rounded-full bg-rose-deep" />
      </span>
    )
  }
  return <span className="relative z-10 size-8 shrink-0 rounded-full border-2 border-line bg-paper" aria-hidden="true" />
}

export function OrderTimeline({
  status,
  serviceType,
  events,
}: {
  status: OrderStatus
  serviceType: ServiceType
  events: TrackedOrderEvent[]
}) {
  const stages = buildStages(status, serviceType, events)

  return (
    <ol className="grid" aria-label="مراحل الطلب">
      {stages.map((stage, index) => {
        const last = index === stages.length - 1
        const time = stage.at ? formatEventTime(stage.at) : ''
        return (
          <li
            key={stage.status}
            data-stage={stage.status}
            data-state={stage.state}
            aria-current={stage.state === 'current' || stage.state === 'terminal' ? 'step' : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className={cx(
                  'absolute start-4 top-8 bottom-0 w-0.5 -translate-x-1/2 rtl:translate-x-1/2',
                  stage.state === 'completed' ? 'bg-sage-deep/60' : 'bg-line',
                )}
              />
            ) : null}
            <Marker state={stage.state} />
            <div className="min-w-0 pt-1">
              <p
                className={cx(
                  'text-[0.9375rem] leading-6 font-semibold',
                  stage.state === 'upcoming' ? 'text-muted' : stage.state === 'terminal' ? 'text-rose-deep' : 'text-ink',
                )}
              >
                {STATUS_LABELS[stage.status]}
                <span className="sr-only"> — {STATE_SR[stage.state]}</span>
              </p>
              {stage.state === 'current' ? <p className="text-sm text-rose-deep">الحالة الحالية</p> : null}
              {time ? <p className="text-xs text-muted tabular-nums">{time}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
