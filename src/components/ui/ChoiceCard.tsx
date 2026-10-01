import { cx } from '@/utils/cx'

export function ChoiceCard({
  name,
  value,
  checked,
  title,
  description,
  onChange,
}: {
  name: string
  value: string
  checked: boolean
  title: string
  description?: string
  onChange: () => void
}) {
  return (
    <label
      className={cx(
        'flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition duration-200 motion-reduce:transition-none',
        checked ? 'border-rose bg-blush/80 shadow-soft' : 'border-line bg-paper hover:border-gold',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 accent-rose-deep"
      />
      <span className="grid gap-1">
        <span className="font-semibold text-ink">{title}</span>
        {description ? <span className="text-sm leading-6 text-muted">{description}</span> : null}
      </span>
    </label>
  )
}
