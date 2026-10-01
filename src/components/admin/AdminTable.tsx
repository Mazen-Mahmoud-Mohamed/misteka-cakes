import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { adminSurfaceClass } from '@/components/admin/AdminCard'
import { cx } from '@/utils/cx'

/** Desktop data table. Pair with a stacked card list for small screens. */
export function AdminTable({
  caption,
  head,
  children,
  className,
}: {
  caption: string
  head: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx(adminSurfaceClass, 'overflow-hidden', className)}>
      <table className="w-full table-auto border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-ivory/70">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-line/70">{children}</tbody>
      </table>
    </div>
  )
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx('px-4 py-2.5 text-start text-xs font-bold whitespace-nowrap text-muted', className)}
      {...props}
    />
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('px-4 py-3 align-middle text-ink', className)} {...props} />
}

export function Tr({ className, children }: { className?: string; children: ReactNode }) {
  return <tr className={cx('transition-colors duration-150 hover:bg-ivory/70 motion-reduce:transition-none', className)}>{children}</tr>
}

/** Stacked list container for mobile rows. */
export function AdminList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <ul aria-label={label} className={cx(adminSurfaceClass, 'divide-y divide-line/70 overflow-hidden', className)}>
      {children}
    </ul>
  )
}
