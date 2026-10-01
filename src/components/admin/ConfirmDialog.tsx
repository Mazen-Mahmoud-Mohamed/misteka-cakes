import type { ReactNode } from 'react'
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
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
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
          <AdminButton
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? 'جارٍ التنفيذ...' : confirmLabel}
          </AdminButton>
        </>
      }
    >
      {children}
    </AdminModal>
  )
}
