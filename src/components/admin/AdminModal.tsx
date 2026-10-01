import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { AdminIconButton } from '@/components/admin/AdminButton'
import { IconClose } from '@/components/admin/icons'
import { cx } from '@/utils/cx'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab focus inside `ref`, closes on Escape (unless busy),
 * locks page scroll and restores focus to the trigger on close.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  busy?: boolean,
) {
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  closeRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = ref.current
    panel?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!busyRef.current) closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [open, ref])
}

export function AdminModal({
  open,
  title,
  description,
  onClose,
  busy,
  size = 'md',
  role = 'dialog',
  footer,
  children,
}: {
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  busy?: boolean
  size?: 'sm' | 'md' | 'lg'
  role?: 'dialog' | 'alertdialog'
  footer?: ReactNode
  children?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  useFocusTrap(panelRef, open, onClose, busy)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink/50"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-paper shadow-[0_24px_60px_rgba(74,52,46,0.18)] outline-none sm:rounded-2xl',
          size === 'sm' ? 'sm:max-w-md' : size === 'md' ? 'sm:max-w-xl' : 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/80 px-5 py-4">
          <div className="min-w-0 pt-1.5">
            <h2 id={titleId} className="text-lg leading-snug font-bold text-ink">
              {title}
            </h2>
            {description ? (
              <div id={descId} className="mt-1 text-sm leading-7 text-muted">
                {description}
              </div>
            ) : null}
          </div>
          <AdminIconButton label="إغلاق" disabled={busy} onClick={onClose} className="-me-2 text-muted">
            <IconClose size={20} />
          </AdminIconButton>
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div> : null}
        {footer ? (
          <div className="grid grid-cols-2 gap-2 border-t border-line/80 bg-ivory/60 px-5 py-3.5 sm:flex sm:justify-end sm:rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
