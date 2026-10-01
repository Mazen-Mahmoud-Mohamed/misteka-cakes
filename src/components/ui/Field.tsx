import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cx } from '@/utils/cx'

export const controlClass =
  'min-h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base text-ink outline-none transition duration-200 focus-visible:border-rose focus-visible:ring-2 focus-visible:ring-rose/30 motion-reduce:transition-none'

function Shell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
      </label>
      <div data-describedby={describedBy}>{children}</div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm leading-6 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm leading-6 text-rose-deep">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type TextProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}

export function TextField({ id, label, hint, error, className, ...props }: TextProps) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={cx(controlClass, className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
    </Shell>
  )
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}

export function TextAreaField({ id, label, hint, error, className, ...props }: AreaProps) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={cx(controlClass, 'min-h-32 py-3', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
    </Shell>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

export function SelectField({ id, label, hint, error, className, children, ...props }: SelectProps) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          id={id}
          className={cx(controlClass, 'appearance-none pe-10', className)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-muted" aria-hidden="true">
          ▾
        </span>
      </div>
    </Shell>
  )
}
