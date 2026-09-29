import { useEffect, useState } from 'react'
import { cx } from '@/utils/cx'

export function AdminAlert({
  tone,
  children,
  onClose,
}: {
  tone: 'success' | 'error' | 'info'
  children: string
  onClose?: () => void
}) {
  const styles =
    tone === 'success'
      ? 'border-sage bg-sage/10 text-sage-deep'
      : tone === 'error'
        ? 'border-rose bg-blush text-rose-deep'
        : 'border-line bg-ivory text-muted'

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-2xl border px-4 py-3 text-sm', styles)}>
      <div className="flex items-start justify-between gap-3">
        <p className="leading-7">{children}</p>
        {onClose ? (
          <button type="button" className="shrink-0 font-semibold" onClick={onClose}>
            إغلاق
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function useFlash(timeoutMs = 4000) {
  const [flash, setFlash] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!flash || flash.tone === 'error') return
    const t = window.setTimeout(() => setFlash(null), timeoutMs)
    return () => window.clearTimeout(t)
  }, [flash, timeoutMs])

  return { flash, setFlash, clearFlash: () => setFlash(null) }
}
