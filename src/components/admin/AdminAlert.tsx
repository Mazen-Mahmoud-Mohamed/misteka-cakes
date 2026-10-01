import { useEffect, useState, type ReactNode } from 'react'
import { IconAlert, IconCheckCircle, IconClose, IconInfo } from '@/components/admin/icons'
import { cx } from '@/utils/cx'

type Tone = 'success' | 'error' | 'info'

const toneStyles: Record<Tone, string> = {
  success: 'border-sage/50 bg-[#f3f5ef] text-sage-deep',
  error: 'border-rose/35 bg-blush/70 text-rose-deep',
  info: 'border-line bg-ivory text-ink',
}

const toneIcons: Record<Tone, ReactNode> = {
  success: <IconCheckCircle size={20} />,
  error: <IconAlert size={20} />,
  info: <IconInfo size={20} />,
}

export function AdminAlert({
  tone,
  title,
  children,
  onClose,
  className,
}: {
  tone: Tone
  title?: string
  children: ReactNode
  onClose?: () => void
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', toneStyles[tone], className)}
    >
      <span className="mt-0.5">{toneIcons[tone]}</span>
      <div className="min-w-0 flex-1 leading-7">
        {title ? <p className="font-bold">{title}</p> : null}
        <div className={title ? 'text-ink/80' : 'font-semibold'}>{children}</div>
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label="إغلاق التنبيه"
          className="-my-1 -me-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-md opacity-70 hover:bg-ink/5 hover:opacity-100"
          onClick={onClose}
        >
          <IconClose size={18} />
        </button>
      ) : null}
    </div>
  )
}

export type Flash = { tone: Tone; text: string }

/** Floating feedback for completed actions. Success auto-dismisses; errors stay until closed. */
export function AdminToast({ flash, onClose }: { flash: Flash | null; onClose: () => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-6"
    >
      {flash ? (
        <div className="pointer-events-auto w-full max-w-md rounded-lg bg-paper shadow-[0_12px_32px_rgba(74,52,46,0.16)]">
          <AdminAlert tone={flash.tone} onClose={onClose}>
            {flash.text}
          </AdminAlert>
        </div>
      ) : null}
    </div>
  )
}

export function useFlash(timeoutMs = 4000) {
  const [flash, setFlash] = useState<Flash | null>(null)

  useEffect(() => {
    if (!flash || flash.tone === 'error') return
    const t = window.setTimeout(() => setFlash(null), timeoutMs)
    return () => window.clearTimeout(t)
  }, [flash, timeoutMs])

  return { flash, setFlash, clearFlash: () => setFlash(null) }
}

export const SAVE_SUCCESS = 'عملية الحفظ تمت بنجاح.'
export const SAVE_ERROR = 'تعذّر حفظ البيانات، حاولي مرة أخرى.'
