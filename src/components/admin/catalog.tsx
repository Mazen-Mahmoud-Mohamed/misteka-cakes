import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AdminAlert, AdminToast, SAVE_ERROR, SAVE_SUCCESS, useFlash } from '@/components/admin/AdminAlert'
import { AdminButton } from '@/components/admin/AdminButton'
import { adminSurfaceClass } from '@/components/admin/AdminCard'
import { adminControlClass } from '@/components/admin/AdminField'
import { AdminModal } from '@/components/admin/AdminModal'
import { AdminEmptyState, AdminErrorState, AdminListSkeleton } from '@/components/admin/AdminStates'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { IconPencil, IconPlus, IconSearch } from '@/components/admin/icons'
import { cx } from '@/utils/cx'

type Row = { id: string; enabled: boolean }
type SaveResult = { ok: boolean; message: string }
export type FieldErrors = Partial<Record<string, string>>

/**
 * Shared list + edit state for soft-disable catalog tables.
 * `prepare` must produce the exact payload previously sent to the upsert service.
 */
export function useCatalogCrud<T extends Row>({
  list,
  upsert,
  prepare,
  validate,
  onSaved,
  onDiscard,
}: {
  list: () => Promise<{ data: T[] | null; error: string | null }>
  upsert: (row: T) => Promise<SaveResult>
  prepare: (draft: T) => T
  validate: (draft: T) => FieldErrors
  onSaved?: (saved: T, previous: T | null) => void | Promise<void>
  onDiscard?: (draft: T) => void
}) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<T | null>(null)
  const [original, setOriginal] = useState<T | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const { flash, setFlash, clearFlash } = useFlash()

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const res = await list()
      if (res.error) {
        setError(res.error)
        setRows([])
      } else {
        setError('')
        setRows(res.data ?? [])
      }
      setLoading(false)
      setRefreshing(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    void load()
  }, [load])

  function open(next: T, existing: T | null) {
    setDraft(next)
    setOriginal(existing)
    setFieldErrors({})
    setFormError('')
  }

  function close() {
    if (saving) return
    if (draft) onDiscard?.(draft)
    setDraft(null)
    setOriginal(null)
    setConfirmDisable(false)
  }

  function update(patch: Partial<T>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    const keys = Object.keys(patch)
    if (keys.some((k) => fieldErrors[k])) {
      setFieldErrors((current) => {
        const next = { ...current }
        for (const k of keys) delete next[k]
        return next
      })
    }
  }

  async function commit() {
    if (!draft) return
    setSaving(true)
    setFormError('')
    const payload = prepare(draft)
    const result = await upsert(payload)
    setSaving(false)
    setConfirmDisable(false)
    if (!result.ok) {
      console.error('[admin] save failed:', result.message)
      setFormError(SAVE_ERROR)
      setFlash({ tone: 'error', text: SAVE_ERROR })
      return
    }
    await onSaved?.(payload, original)
    setDraft(null)
    setOriginal(null)
    setFlash({ tone: 'success', text: SAVE_SUCCESS })
    await load(true)
  }

  function requestSave(event?: FormEvent) {
    event?.preventDefault()
    if (!draft) return
    const errors = validate(draft)
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors)
      setFormError('راجعي الحقول المطلوبة قبل الحفظ.')
      return
    }
    if (original?.enabled && !draft.enabled) {
      setConfirmDisable(true)
      return
    }
    void commit()
  }

  return {
    rows,
    loading,
    refreshing,
    error,
    load,
    draft,
    original,
    isNew: !original,
    open,
    close,
    update,
    fieldErrors,
    formError,
    saving,
    requestSave,
    confirmDisable,
    confirmSave: () => void commit(),
    cancelDisable: () => setConfirmDisable(false),
    flash,
    clearFlash,
  }
}

export type EnabledFilter = 'all' | 'enabled' | 'disabled'

export function useCatalogFilter<T extends Row>(rows: T[], fields: (row: T) => Array<string | null | undefined>) {
  const [query, setQuery] = useState('')
  const [enabled, setEnabled] = useState<EnabledFilter>('all')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (enabled === 'enabled' && !row.enabled) return false
      if (enabled === 'disabled' && row.enabled) return false
      if (!q) return true
      return fields(row).some((value) => (value ?? '').toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, enabled])
  return { query, setQuery, enabled, setEnabled, filtered, active: Boolean(query.trim()) || enabled !== 'all' }
}

export function CatalogToolbar({
  id,
  placeholder,
  filter,
  total,
  visible,
  noun,
}: {
  id: string
  placeholder: string
  filter: ReturnType<typeof useCatalogFilter<Row>>
  total: number
  visible: number
  noun: string
}) {
  const options: Array<{ value: EnabledFilter; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'enabled', label: 'مفعّل' },
    { value: 'disabled', label: 'غير مفعّل' },
  ]
  return (
    <div className={cx(adminSurfaceClass, 'mb-4 flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center')}>
      <div className="relative min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          {placeholder}
        </label>
        <IconSearch size={18} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted" />
        <input
          id={id}
          type="search"
          placeholder={placeholder}
          value={filter.query}
          onChange={(e) => filter.setQuery(e.target.value)}
          className={cx(adminControlClass, 'min-h-11 ps-10')}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
        <div role="group" aria-label="تصفية حسب الحالة" className="inline-flex rounded-lg border border-line bg-ivory p-0.5">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter.enabled === option.value}
              onClick={() => filter.setEnabled(option.value)}
              className={cx(
                'min-h-10 cursor-pointer rounded-md px-3 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none',
                filter.enabled === option.value ? 'bg-paper text-rose-deep shadow-[0_1px_2px_rgba(74,52,46,0.12)]' : 'text-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm whitespace-nowrap text-muted" aria-live="polite">
          {filter.active ? `${visible} من ${total}` : `${total}`} {noun}
        </p>
      </div>
    </div>
  )
}

/** Renders loading / error / empty / no-match states, or the table (md+) and list (mobile). */
export function CatalogResults({
  loading,
  error,
  onRetry,
  retrying,
  total,
  visible,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  addLabel,
  onAdd,
  onClearFilters,
  table,
  list,
}: {
  loading: boolean
  error: string
  onRetry: () => void
  retrying: boolean
  total: number
  visible: number
  emptyTitle: string
  emptyDescription: string
  emptyIcon: ReactNode
  addLabel: string
  onAdd: () => void
  onClearFilters: () => void
  table: ReactNode
  list: ReactNode
}) {
  if (loading) return <AdminListSkeleton rows={5} />
  if (error) return <AdminErrorState description={error} onRetry={onRetry} retrying={retrying} />
  if (total === 0) {
    return (
      <AdminEmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <AdminButton variant="primary" icon={<IconPlus size={18} />} onClick={onAdd}>
            {addLabel}
          </AdminButton>
        }
      />
    )
  }
  if (visible === 0) {
    return (
      <AdminEmptyState
        icon={<IconSearch />}
        title="لا توجد نتائج مطابقة"
        description="جرّبي كلمة بحث أخرى أو غيّري تصفية الحالة."
        action={<AdminButton onClick={onClearFilters}>مسح التصفية</AdminButton>}
      />
    )
  }
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden">{list}</div>
    </>
  )
}

export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <AdminButton size="sm" icon={<IconPencil size={16} />} aria-label={label} onClick={onClick}>
      تعديل
    </AdminButton>
  )
}

/** Mobile row with title, meta lines, badges and an edit action. */
export function CatalogListItem({
  title,
  subtitle,
  meta,
  badges,
  media,
  editLabel,
  onEdit,
}: {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  badges?: ReactNode
  media?: ReactNode
  editLabel: string
  onEdit: () => void
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      {media}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        {meta ? <div className="mt-1.5 text-[0.8125rem] text-ink/85">{meta}</div> : null}
        {badges ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
      </div>
      <EditButton label={editLabel} onClick={onEdit} />
    </li>
  )
}

export function IdText({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs text-muted" dir="ltr">
      <span className="inline-block">{children}</span>
    </span>
  )
}

/** Edit/create modal shell with consistent footer and disable confirmation. */
export function CatalogEditor<T extends Row>({
  crud,
  newTitle,
  editTitle,
  disableTitle,
  disableBody,
  size = 'md',
  children,
}: {
  crud: ReturnType<typeof useCatalogCrud<T>>
  newTitle: string
  editTitle: string
  disableTitle: string
  disableBody: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}) {
  const formId = 'catalog-editor-form'
  return (
    <>
      <AdminModal
        open={Boolean(crud.draft) && !crud.confirmDisable}
        title={crud.isNew ? newTitle : editTitle}
        description={crud.isNew ? 'الحقول المعلّمة بـ * مطلوبة.' : undefined}
        size={size}
        busy={crud.saving}
        onClose={crud.close}
        footer={
          <>
            <AdminButton disabled={crud.saving} onClick={crud.close}>
              إلغاء
            </AdminButton>
            <AdminButton type="submit" form={formId} variant="primary" loading={crud.saving}>
              {crud.saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </AdminButton>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={crud.requestSave} className="grid gap-4">
          {crud.formError ? <AdminAlert tone="error">{crud.formError}</AdminAlert> : null}
          {children}
        </form>
      </AdminModal>
      <ConfirmDialog
        open={crud.confirmDisable}
        title={disableTitle}
        body={disableBody}
        confirmLabel="تعطيل وحفظ"
        cancelLabel="رجوع للتعديل"
        danger
        busy={crud.saving}
        onCancel={crud.cancelDisable}
        onConfirm={crud.confirmSave}
      />
      <AdminToast flash={crud.flash} onClose={crud.clearFlash} />
    </>
  )
}

export const SORT_HINT = 'الرقم الأصغر يظهر أولًا.'
export const ID_HINT_NEW = 'معرّف فريد بالإنجليزية بدون مسافات.'
export const ID_HINT_EDIT = 'تغيير المعرّف يحفظ العنصر كعنصر جديد.'
