import { OrderSummaryCard } from '@/components/order/OrderSummaryCard'
import { TextField } from '@/components/ui/Field'
import { toSummaryView } from '@/services/orderService'
import type { OrderDraft } from '@/types'
import type { FieldErrors } from '@/utils/validation'

export function SummaryStep({
  draft,
  errors,
  onChange,
}: {
  draft: OrderDraft
  errors: FieldErrors
  onChange: (patch: Partial<OrderDraft>) => void
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="name"
          label="الاسم"
          autoComplete="name"
          value={draft.customerName}
          error={errors.customerName}
          onChange={(event) => onChange({ customerName: event.target.value })}
        />
        <TextField
          id="phone"
          label="رقم الموبايل"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          className="text-end"
          value={draft.phone}
          error={errors.phone}
          hint="مثال: 01012345678"
          onChange={(event) => onChange({ phone: event.target.value })}
        />
      </div>
      <OrderSummaryCard summary={toSummaryView(draft)} />
    </div>
  )
}
