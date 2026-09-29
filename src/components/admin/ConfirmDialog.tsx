import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-6 shadow-soft">
        <h2 className="font-display text-2xl text-rose-deep">{title}</h2>
        <p className="mt-3 leading-8 text-muted">{body}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant={danger ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
            className={danger ? 'border-rose text-rose-deep' : undefined}
          >
            {busy ? 'جارٍ التنفيذ...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}
