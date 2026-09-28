import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/utils/cx'

const variants = {
  primary: 'bg-rose-deep text-ivory hover:bg-rose',
  secondary: 'border border-gold bg-paper text-rose-deep hover:bg-gold-soft/40',
  ghost: 'bg-transparent text-rose-deep hover:bg-blush',
} as const

const base =
  'inline-flex min-h-12 items-center justify-center rounded-full px-6 text-center text-base font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50'

type Variant = keyof typeof variants

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cx(base, variants[variant], className)} {...props} />
}

export function ButtonLink({
  to,
  variant = 'primary',
  className,
  children,
}: {
  to: string
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cx(base, variants[variant], className)}>
      {children}
    </Link>
  )
}
