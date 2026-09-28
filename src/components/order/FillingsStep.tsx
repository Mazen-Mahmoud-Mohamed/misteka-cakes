import { ChoiceCard } from '@/components/ui/ChoiceCard'
import { listFillings } from '@/services/catalogService'
import type { OrderDraft } from '@/types'
import type { FieldErrors } from '@/utils/validation'
import { chargeAmountLabel } from '@/utils/format'

export function FillingsStep({
  draft,
  errors,
  onChange,
}: {
  draft: OrderDraft
  errors: FieldErrors
  onChange: (patch: Partial<OrderDraft>) => void
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="font-semibold text-ink">الحشوة</legend>
      {listFillings().map((filling) => (
        <ChoiceCard
          key={filling.id}
          name="filling"
          value={filling.id}
          checked={draft.fillingId === filling.id}
          title={filling.name}
          description={filling.price === 0 ? 'بدون إضافة على السعر' : chargeAmountLabel(filling.priceStatus, filling.price)}
          onChange={() => onChange({ fillingId: filling.id })}
        />
      ))}
      {errors.fillingId ? (
        <p role="alert" className="text-sm text-rose-deep">
          {errors.fillingId}
        </p>
      ) : null}
    </fieldset>
  )
}
