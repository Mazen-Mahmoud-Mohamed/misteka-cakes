import { AdminButton } from '@/components/admin/AdminButton'
import { AdminModal } from '@/components/admin/AdminModal'

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'إلغاء',
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AdminModal
      open={open}
      role="alertdialog"
      size="sm"
      title={title}
      description={body}
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <AdminButton disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </AdminButton>
          <AdminButton variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {busy ? 'جارٍ التنفيذ...' : confirmLabel}
          </AdminButton>
        </>
      }
    />
  )
}
