import type { ReactNode } from 'react'
import { adminSurfaceClass } from '@/components/admin/AdminCard'
import { AdminButton } from '@/components/admin/AdminButton'
import { IconAlert, IconInbox, IconRefresh, Spinner } from '@/components/admin/icons'
import { cx } from '@/utils/cx'

export function AdminEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx(adminSurfaceClass, 'flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-cream text-muted">{icon ?? <IconInbox />}</span>
      <p className="mt-4 text-base font-bold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm leading-7 text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function AdminErrorState({
  title = 'تعذّر تحميل البيانات',
  description,
  onRetry,
  retrying,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div role="alert" className={cx(adminSurfaceClass, 'flex flex-col items-center px-6 py-12 text-center')}>
      <span className="grid size-12 place-items-center rounded-full bg-blush text-rose-deep">
        <IconAlert />
      </span>
      <p className="mt-4 text-base font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-7 text-muted">
        {description || 'تحقّقي من الاتصال بالإنترنت ثم حاولي مرة أخرى.'}
      </p>
      {onRetry ? (
        <AdminButton className="mt-5" icon={<IconRefresh size={18} />} loading={retrying} onClick={onRetry}>
          إعادة المحاولة
        </AdminButton>
      ) : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('block animate-pulse rounded-md bg-line/55 motion-reduce:animate-none', className)} />
}

/** Generic list/table skeleton. */
export function AdminListSkeleton({ rows = 5, label = 'جاري التحميل' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className={cx(adminSurfaceClass, 'divide-y divide-line/70 overflow-hidden')}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-2/5 max-w-56" />
            <Skeleton className="h-3 w-3/5 max-w-80" />
          </div>
          <Skeleton className="hidden h-7 w-20 rounded-full sm:block" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function AdminFullPageLoading({ label = 'جاري التحقق من الجلسة...' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ivory text-sm text-muted">
      <Spinner className="size-6 text-rose-deep" />
      {label}
    </div>
  )
}
