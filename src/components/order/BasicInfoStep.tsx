import { ChoiceCard } from '@/components/ui/ChoiceCard'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { listTimeSlots, listZones } from '@/services/catalogService'
import type { AvailabilityResult, OrderDraft } from '@/types'
import type { FieldErrors } from '@/utils/validation'
import { formatArabicDate, formatTimeLabel, isBookableDate, minBookableDate, tooSoonMessage } from '@/utils/dates'
import { normalizeDigits } from '@/utils/phone'
import { cx } from '@/utils/cx'

export function BasicInfoStep({
  draft,
  errors,
  onChange,
  availability,
  checking,
}: {
  draft: OrderDraft
  errors: FieldErrors
  onChange: (patch: Partial<OrderDraft>) => void
  availability: AvailabilityResult | null
  checking: boolean
}) {
  const earliest = minBookableDate()
  const dateTooSoon = Boolean(draft.date) && !isBookableDate(draft.date)
  const dateError = dateTooSoon ? tooSoonMessage() : errors.date
  const dateReady = Boolean(draft.date) && !dateTooSoon && !errors.date

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-3">
        <legend className="mb-2 font-semibold text-ink">طريقة الاستلام</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="serviceType"
            value="delivery"
            checked={draft.serviceType === 'delivery'}
            title="توصيل"
            description="داخل القاهرة والجيزة فقط، عبر أوبر على حسابك."
            onChange={() => onChange({ serviceType: 'delivery' })}
          />
          <ChoiceCard
            name="serviceType"
            value="pickup"
            checked={draft.serviceType === 'pickup'}
            title="استلام"
            description="مكان الاستلام يُأكد عند مراجعة الطلب."
            onChange={() => onChange({ serviceType: 'pickup', areaId: '' })}
          />
        </div>
        {errors.serviceType ? (
          <p role="alert" className="text-sm text-rose-deep">
            {errors.serviceType}
          </p>
        ) : null}
      </fieldset>

      {draft.serviceType === 'delivery' ? (
        <>
          <SelectField
            id="area"
            label="منطقة التوصيل"
            value={draft.areaId}
            error={errors.areaId}
            hint="التوصيل حاليًا داخل القاهرة والجيزة فقط."
            onChange={(event) => onChange({ areaId: event.target.value })}
          >
            <option value="">اختاري المنطقة</option>
            {listZones().map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            id="address"
            label="وصف العنوان"
            hint="اختياري. الشارع أو أقرب علامة، بدون خريطة."
            value={draft.addressNotes}
            maxLength={300}
            onChange={(event) => onChange({ addressNotes: event.target.value })}
          />
        </>
      ) : null}

      <TextField
        id="servings"
        label="عدد الأفراد"
        inputMode="numeric"
        value={draft.servings}
        error={errors.servings}
        hint="يساعدنا نرشّح المقاس من قائمة الأسعار. العدد تقريبي."
        onChange={(event) => onChange({ servings: normalizeDigits(event.target.value) })}
      />

      <TextField
        id="date"
        label={draft.serviceType === 'delivery' ? 'تاريخ التوصيل' : 'تاريخ الاستلام'}
        type="date"
        dir="ltr"
        className="text-end"
        min={earliest}
        value={draft.date}
        error={dateError}
        hint={`أقرب موعد للحجز: ${formatArabicDate(earliest)}`}
        onChange={(event) => onChange({ date: event.target.value, time: '' })}
      />

      <SelectField
        id="time"
        label="الوقت"
        value={draft.time}
        disabled={!dateReady}
        error={errors.time}
        hint="يُؤكد الوقت المناسب عند مراجعة الطلب."
        onChange={(event) => onChange({ time: event.target.value })}
      >
        <option value="">اختاري الوقت</option>
        {listTimeSlots().map((slot) => (
          <option key={slot} value={slot}>
            {formatTimeLabel(slot)}
          </option>
        ))}
      </SelectField>

      {dateReady && draft.time ? (
        <p
          className={cx(
            'rounded-2xl px-4 py-3 text-sm leading-7',
            availability?.status === 'conflict' || availability?.status === 'unknown'
              ? 'bg-blush text-rose-deep'
              : 'bg-cream text-ink',
          )}
          role="status"
        >
          {checking ? 'جارٍ التحقق من الموعد.' : availability?.message}
        </p>
      ) : null}
    </div>
  )
}
