import { ChoiceCard } from '@/components/ui/ChoiceCard'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { useCatalog } from '@/providers/CatalogProvider'
import { getProduct } from '@/services/catalogService'
import type { OrderDraft } from '@/types'
import { isCakeOrdering, isQuoteOrdering } from '@/types/products'
import type { FieldErrors } from '@/utils/validation'
import { formatEgp } from '@/utils/format'
import { normalizeDigits } from '@/utils/phone'
import { cx } from '@/utils/cx'

export function ProductConfigStep({
  draft,
  errors,
  onChange,
}: {
  draft: OrderDraft
  errors: FieldErrors
  onChange: (patch: Partial<OrderDraft>) => void
}) {
  useCatalog()
  const product = draft.productId ? getProduct(draft.productId) : undefined
  if (!product || isCakeOrdering(product) || isQuoteOrdering(product)) return null

  const packages = product.priceTiers.filter((t) => t.tierKind === 'package' && t.enabled)
  const weights = product.priceTiers.filter((t) => t.tierKind === 'weight' && t.enabled)
  const ranges = product.priceTiers.filter((t) => t.tierKind === 'quantity_range' && t.enabled)
  const showPackagePicker = packages.length > 0
  const showWeightPicker = product.orderingModel === 'weight' || weights.length > 0
  const showQtyInput =
    !showPackagePicker &&
    !showWeightPicker &&
    (product.orderingModel === 'quantity' || product.orderingModel === 'custom' || ranges.length > 0)

  function toggleOptionValue(optionId: string, valueId: string, selectionType: string) {
    const option = product!.options.find((o) => o.id === optionId)
    if (!option) return
    const relatedIds = new Set(option.values.map((v) => v.id))
    const without = draft.optionValueIds.filter((id) => !relatedIds.has(id))
    const selected = draft.optionValueIds.includes(valueId)
    if (selectionType === 'multi') {
      onChange({ optionValueIds: selected ? without : [...without, valueId] })
      return
    }
    onChange({ optionValueIds: selected ? without : [...without, valueId] })
  }

  function setOptionNote(optionName: string, value: string) {
    const marker = `[${optionName}]`
    const lines = draft.designNotes
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith(marker))
    const next = value.trim() ? [...lines, `${marker} ${value.trim()}`] : lines
    onChange({ designNotes: next.join('\n') })
  }

  function optionNoteValue(optionName: string) {
    const marker = `[${optionName}]`
    const line = draft.designNotes.split('\n').find((l) => l.startsWith(marker))
    return line ? line.slice(marker.length).trim() : ''
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-line bg-blush/40 p-4">
        <p className="text-xs font-bold text-rose">المنتج</p>
        <p className="mt-1 font-semibold text-ink">{product.name}</p>
        {product.description ? <p className="mt-1 text-sm text-muted">{product.description}</p> : null}
      </div>

      {showPackagePicker ? (
        <fieldset className="grid gap-3">
          <legend className="font-semibold text-ink">اختاري العدد / الباقة</legend>
          {packages.map((tier) => (
            <ChoiceCard
              key={tier.id}
              name="priceTierId"
              value={tier.id}
              checked={draft.priceTierId === tier.id}
              title={tier.label}
              description={formatEgp(tier.price)}
              onChange={() =>
                onChange({
                  priceTierId: tier.id,
                  quantity: String(tier.packageQty ?? 1),
                })
              }
            />
          ))}
          {errors.priceTierId ? <p className="text-sm text-[#9a3434]">{errors.priceTierId}</p> : null}
        </fieldset>
      ) : null}

      {showWeightPicker ? (
        <fieldset className="grid gap-3">
          <legend className="font-semibold text-ink">اختاري الوزن</legend>
          {weights.map((tier) => (
            <ChoiceCard
              key={tier.id}
              name="priceTierId"
              value={tier.id}
              checked={draft.priceTierId === tier.id}
              title={tier.label}
              description={formatEgp(tier.price)}
              onChange={() => onChange({ priceTierId: tier.id, quantity: '1' })}
            />
          ))}
          {errors.priceTierId ? <p className="text-sm text-[#9a3434]">{errors.priceTierId}</p> : null}
        </fieldset>
      ) : null}

      {showQtyInput ? (
        <TextField
          id="quantity"
          label="الكمية"
          inputMode="numeric"
          value={draft.quantity}
          error={errors.quantity}
          hint={
            product.qtyMin != null || product.qtyMax != null
              ? `من ${product.qtyMin ?? 1} إلى ${product.qtyMax ?? 99}${product.qtyStep && product.qtyStep > 1 ? ` (خطوة ${product.qtyStep})` : ''}`
              : undefined
          }
          onChange={(event) => onChange({ quantity: normalizeDigits(event.target.value) })}
        />
      ) : null}

      {product.orderingModel === 'fixed_item' && product.fixedPrice != null ? (
        <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-semibold text-ink">
          السعر: {formatEgp(product.fixedPrice)}
        </p>
      ) : null}

      {product.options.length > 0 ? (
        <div className="grid gap-4">
          <h3 className="font-semibold text-ink">خيارات المنتج</h3>
          {product.options.map((option) => (
            <fieldset key={option.id} className="rounded-2xl border border-line/80 bg-ivory p-4">
              <legend className="px-1 text-sm font-bold text-ink">
                {option.name}
                {option.required ? ' *' : ''}
              </legend>
              {option.description ? <p className="mb-3 text-sm text-muted">{option.description}</p> : null}
              {option.selectionType === 'text' ? (
                <TextField
                  id={`opt-text-${option.id}`}
                  label=""
                  value={optionNoteValue(option.name)}
                  onChange={(e) => setOptionNote(option.name, e.target.value)}
                />
              ) : option.selectionType === 'textarea' ? (
                <TextAreaField
                  id={`opt-area-${option.id}`}
                  label=""
                  value={optionNoteValue(option.name)}
                  onChange={(e) => setOptionNote(option.name, e.target.value)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const selected = draft.optionValueIds.includes(value.id)
                    return (
                      <button
                        key={value.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleOptionValue(option.id, value.id, option.selectionType)}
                        className={cx(
                          'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold',
                          selected ? 'bg-rose-deep text-ivory' : 'border border-line bg-paper text-ink',
                        )}
                      >
                        {value.name}
                        {value.priceAdjustment > 0 ? ` (+${formatEgp(value.priceAdjustment)})` : ''}
                      </button>
                    )
                  })}
                </div>
              )}
              {errors[`option_${option.id}`] ? (
                <p className="mt-2 text-sm text-[#9a3434]">{errors[`option_${option.id}`]}</p>
              ) : null}
            </fieldset>
          ))}
        </div>
      ) : null}
    </div>
  )
}
