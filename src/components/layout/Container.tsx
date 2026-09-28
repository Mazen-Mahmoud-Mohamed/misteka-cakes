import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}
