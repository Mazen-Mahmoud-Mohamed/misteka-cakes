import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { IconCheck } from '@/components/admin/icons'
import { cx } from '@/utils/cx'

export const adminControlClass =
  'w-full rounded-lg border border-line bg-paper px-3 text-[0.9375rem] text-ink outline-none transition-colors duration-150 placeholder:text-muted/70 hover:border-rose/30 focus-visible:border-rose-deep focus-visible:ring-3 focus-visible:ring-rose-deep/15 disabled:cursor-not-allowed disabled:bg-ivory disabled:text-muted aria-invalid:border-[#9a3434] aria-invalid:focus-visible:ring-[#9a3434]/15 motion-reduce:transition-none'

function describedBy(id: string, hint?: string, error?: string) {
  return [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined
}

export function AdminFieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-[#8a2e2e]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] leading-6 font-semibold text-[#8a2e2e]">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] leading-6 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type Common = { id: string; label: string; hint?: string; error?: string; wrapperClassName?: string }

export function AdminTextField({
  id,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & Common) {
  return (
    <AdminFieldShell id={id} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(adminControlClass, 'min-h-11', className)}
        {...props}
      />
    </AdminFieldShell>
  )
}

export function AdminTextAreaField({
  id,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  return (
    <AdminFieldShell id={id} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(adminControlClass, 'min-h-24 py-2.5 leading-7', className)}
        {...props}
      />
    </AdminFieldShell>
  )
}

export function AdminSelectField({
  id,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & Common) {
  return (
    <AdminFieldShell id={id} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <AdminSelect
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={className}
        {...props}
      >
        {children}
      </AdminSelect>
    </AdminFieldShell>
  )
}

/** Bare select (used in filter bars where the label is rendered separately). */
export function AdminSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(adminControlClass, 'min-h-11 cursor-pointer appearance-none pe-9', className)} {...props}>
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

/** Accessible on/off switch for soft-enable flags. */
export function AdminSwitch({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="mt-0.5 text-[0.8125rem] leading-6 text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 motion-reduce:transition-none',
          checked ? 'border-sage-deep bg-sage-deep' : 'border-line bg-cream',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-0.5 size-[1.375rem] rounded-full bg-paper shadow-[0_1px_2px_rgba(74,52,46,0.25)] transition-[inset-inline-start] duration-150 motion-reduce:transition-none',
            checked ? 'start-[1.375rem]' : 'start-0.5',
          )}
        />
        <span className="sr-only">{checked ? 'مفعّل' : 'غير مفعّل'}</span>
      </button>
    </div>
  )
}

/** Selectable option tile used inside checkbox groups. */
export function AdminCheckboxTile({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean
  onChange: () => void
  children: ReactNode
  hint?: string
}) {
  return (
    <label
      className={cx(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 has-focus-visible:ring-3 has-focus-visible:ring-rose-deep/20 motion-reduce:transition-none',
        checked ? 'border-rose-deep/40 bg-blush/40 text-ink' : 'border-line bg-paper text-ink hover:border-rose/30',
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden="true"
        className={cx(
          'grid size-5 shrink-0 place-items-center rounded-md border',
          checked ? 'border-rose-deep bg-rose-deep text-ivory' : 'border-line bg-paper text-transparent',
        )}
      >
        <IconCheck size={14} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{children}</span>
        {hint ? (
          <span className="ms-1.5 text-xs text-muted">{hint}</span>
        ) : null}
      </span>
    </label>
  )
}
