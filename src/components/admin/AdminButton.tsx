import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '@/components/admin/icons'
import { cx } from '@/utils/cx'

const variants = {
  primary: 'border border-rose-deep bg-rose-deep text-ivory hover:border-rose hover:bg-rose',
  secondary: 'border border-line bg-paper text-ink hover:border-rose/40 hover:bg-ivory',
  ghost: 'border border-transparent bg-transparent text-rose-deep hover:bg-blush/60',
  danger: 'border border-[#9a3434] bg-[#9a3434] text-ivory hover:border-[#7f2a2a] hover:bg-[#7f2a2a]',
  dangerOutline: 'border border-[#9a3434]/35 bg-paper text-[#8a2e2e] hover:border-[#9a3434]/60 hover:bg-[#9a3434]/5',
} as const

const sizes = {
  md: 'min-h-11 gap-2 px-4 text-sm',
  sm: 'min-h-10 gap-1.5 px-3 text-sm',
} as const

export type AdminButtonVariant = keyof typeof variants

export function adminButtonClass(variant: AdminButtonVariant = 'secondary', size: keyof typeof sizes = 'md') {
  return cx(
    'inline-flex cursor-pointer items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none',
    variants[variant],
    sizes[size],
  )
}

export function AdminButton({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant
  size?: keyof typeof sizes
  icon?: ReactNode
  loading?: boolean
}) {
  return (
    <button
      type={type}
      className={cx(adminButtonClass(variant, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

export function AdminButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
}: {
  to: string
  variant?: AdminButtonVariant
  size?: keyof typeof sizes
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cx(adminButtonClass(variant, size), className)}>
      {icon}
      {children}
    </Link>
  )
}

/** Square icon-only button; `label` is required for screen readers. */
export function AdminIconButton({
  label,
  className,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink transition-colors duration-150 hover:bg-blush/60 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
