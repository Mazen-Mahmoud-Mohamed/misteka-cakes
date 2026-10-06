import { useRef } from 'react'
import { ChoiceCard } from '@/components/ui/ChoiceCard'
import { TextAreaField } from '@/components/ui/Field'
import { useCatalog } from '@/providers/CatalogProvider'
import { getOffer, getProduct, listCakes, listExtras, listSizes } from '@/services/catalogService'
import { recommendSizeId, sizeFitNote } from '@/services/pricingService'
import type { OrderDraft, PricingGroup } from '@/types'
import type { FieldErrors } from '@/utils/validation'
import { formatEgp } from '@/utils/format'
import { cx } from '@/utils/cx'

export function CakeDetailsStep({
  draft,
  errors,
  onChange,
  referencePreview,
  referenceError,
  onReference,
}: {
  draft: OrderDraft
  errors: FieldErrors
  onChange: (patch: Partial<OrderDraft>) => void
  referencePreview: string | null
  referenceError: string
  onReference: (file: File | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  useCatalog()
  const cakes = listCakes()
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const offer = draft.offerId ? getOffer(draft.offerId) : undefined
  const isNonCakeProduct = Boolean(product && product.pricingMode !== 'cake_sizes' && !draft.cakeId)
  const sizes = listSizes(draft.structure)
  const people = Number(draft.servings)
  const recommended = recommendSizeId(sizes, people)
  const needsCake = !isNonCakeProduct && !offer && (draft.designMode === 'catalog' || draft.designMode === 'similar')
  const selectedSize = sizes.find((size) => size.id === draft.sizeId)

  function setStructure(structure: PricingGroup) {
    const nextSizes = listSizes(structure)
    const stillValid = nextSizes.some((size) => size.id === draft.sizeId)
    onChange({
      structure,
      sizeId: stillValid ? draft.sizeId : (recommendSizeId(nextSizes, people) ?? ''),
    })
  }

  function toggleOptionValue(optionId: string, valueId: string, selectionType: string) {
    const option = product?.options.find((o) => o.id === optionId)
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

  return (
    <div className="grid gap-6">
      {offer ? (
        <div className="rounded-2xl border border-gold/40 bg-[#fff8f0] p-4">
          <p className="text-xs font-bold text-[#8a6532]">عرض / باقة</p>
          <p className="mt-1 font-display text-2xl text-rose-deep">{offer.name}</p>
          <p className="mt-2 text-sm leading-7 text-muted">{offer.description}</p>
        </div>
      ) : null}

      {product && isNonCakeProduct ? (
        <div className="rounded-2xl border border-line bg-blush/40 p-4">
          <p className="text-xs font-bold text-rose">المنتج</p>
          <p className="mt-1 font-semibold text-ink">{product.name}</p>
          {product.description ? <p className="mt-1 text-sm text-muted">{product.description}</p> : null}
        </div>
      ) : null}

      {!isNonCakeProduct ? (
      <fieldset className="grid gap-3">
        <legend className="font-semibold text-ink">نوع التصميم</legend>
        <ChoiceCard
          name="designMode"
          value="catalog"
          checked={draft.designMode === 'catalog'}
          title="تصميم من الموقع"
          description="نفس تصميم التورتة المختارة."
          onChange={() => onChange({ designMode: 'catalog' })}
        />
        <ChoiceCard
          name="designMode"
          value="similar"
          checked={draft.designMode === 'similar'}
          title="تصميم قريب من تورتة سابقة"
          description="اختاري التصميم، ثم صفي الفرق المطلوب."
          onChange={() => onChange({ designMode: 'similar' })}
        />
        <ChoiceCard
          name="designMode"
          value="custom"
          checked={draft.designMode === 'custom'}
          title="تصميم مخصص"
          description="صفي التورتة، ويمكنك إرفاق صورة مرجعية."
          onChange={() => onChange({ designMode: 'custom' })}
        />
      </fieldset>
      ) : null}

      {needsCake ? (
        <fieldset className="grid gap-3">
          <legend className="font-semibold text-ink">التصميم</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {cakes.map((cake) => {
              const selected = draft.cakeId === cake.id
              return (
                <button
                  key={cake.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ cakeId: cake.id })}
                  className={cx(
                    'flex items-center gap-3 rounded-2xl border p-2 text-start',
                    selected ? 'border-rose bg-blush/70' : 'border-line bg-paper',
                  )}
                >
                  <img src={cake.image} alt="" className="size-16 rounded-xl object-cover" />
                  <span className="font-semibold text-ink">{cake.name}</span>
                </button>
              )
            })}
          </div>
          {errors.cakeId ? (
            <p role="alert" className="text-sm text-rose-deep">
              {errors.cakeId}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {product && product.options.length > 0 ? (
        <div className="grid gap-4">
          <h3 className="font-semibold text-ink">خيارات إضافية</h3>
          {product.options.map((option) => (
            <fieldset key={option.id} className="rounded-2xl border border-line bg-paper p-4">
              <legend className="px-1 text-sm font-bold text-ink">
                {option.name}
                {option.required ? ' *' : ''}
              </legend>
              {option.description ? <p className="mb-3 text-sm text-muted">{option.description}</p> : null}
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
                        selected ? 'bg-rose-deep text-ivory' : 'border border-line bg-ivory text-ink',
                      )}
                    >
                      {value.name}
                      {value.priceAdjustment > 0 ? ` (+${formatEgp(value.priceAdjustment)})` : ''}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}

      <TextAreaField
        id="design-notes"
        label={draft.designMode === 'catalog' ? 'ملاحظات التصميم' : 'وصف التصميم'}
        hint={
          draft.designMode === 'catalog'
            ? 'اختياري. الكتابة على التورتة أو أي تفصيلة.'
            : 'الألوان، المناسبة، والكتابة المطلوبة.'
        }
        value={draft.designNotes}
        error={errors.designNotes}
        maxLength={800}
        onChange={(event) => onChange({ designNotes: event.target.value })}
      />

      {draft.designMode !== 'catalog' ? (
        <div className="grid gap-2">
          <label htmlFor="reference" className="font-semibold text-ink">
            صورة مرجعية
          </label>
          <input
            id="reference"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-ink file:me-3 file:min-h-11 file:rounded-full file:border-0 file:bg-blush file:px-4 file:font-semibold file:text-rose-deep"
            ref={fileRef}
            onChange={(event) => onReference(event.target.files?.[0] ?? null)}
          />
          <p className="text-sm leading-6 text-muted">اختياري. JPG أو PNG أو WEBP، بحد 5 ميغابايت.</p>
          {referenceError ? (
            <p role="alert" className="text-sm text-rose-deep">
              {referenceError}
            </p>
          ) : null}
          {referencePreview ? (
            <div className="mt-2">
              <img src={referencePreview} alt="معاينة الصورة المرجعية" className="max-h-56 rounded-2xl object-contain" />
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-rose-deep"
                onClick={() => {
                  if (fileRef.current) fileRef.current.value = ''
                  onReference(null)
                }}
              >
                إزالة الصورة
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isNonCakeProduct ? (
      <>
      <div className="rounded-2xl bg-ivory px-4 py-3 text-sm leading-7 text-muted">
        عدد الأفراد في هذا الطلب: <span className="font-semibold text-ink">{draft.servings || '—'}</span>. يمكن الرجوع للخطوة السابقة لتعديله.
      </div>

      <fieldset className="grid gap-3">
        <legend className="font-semibold text-ink">شكل التورتة</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="structure"
            value="single"
            checked={draft.structure === 'single'}
            title="طبقة واحدة"
            onChange={() => setStructure('single')}
          />
          <ChoiceCard
            name="structure"
            value="two-tier"
            checked={draft.structure === 'two-tier'}
            title="دورين"
            description="السعر من قائمة الدورين، وتنفيذ التصميم يُراجع."
            onChange={() => setStructure('two-tier')}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="font-semibold text-ink">المقاس</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {sizes.map((size) => {
            const selected = draft.sizeId === size.id
            return (
              <button
                key={size.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ sizeId: size.id })}
                className={cx(
                  'rounded-2xl border p-4 text-start',
                  selected ? 'border-rose bg-blush/70' : 'border-line bg-paper',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-2xl text-ink">{size.label}</span>
                  {recommended === size.id ? (
                    <span className="rounded-full bg-gold-soft px-2 py-1 text-xs font-semibold text-ink">مقترح</span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-muted">يكفي {size.servingsLabel}</span>
                <span className="mt-2 block font-semibold text-rose-deep">{formatEgp(size.price)}</span>
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={draft.sizeId === 'custom'}
            onClick={() => onChange({ sizeId: 'custom' })}
            className={cx(
              'rounded-2xl border p-4 text-start',
              draft.sizeId === 'custom' ? 'border-rose bg-blush/70' : 'border-line bg-paper',
            )}
          >
            <span className="font-display text-2xl text-ink">مقاس حسب الطلب</span>
            <span className="mt-1 block text-sm leading-6 text-muted">يمكن تنفيذ مقاس غير موجود في القائمة. السعر غير محدد.</span>
          </button>
        </div>
        {selectedSize && Number.isFinite(people) && sizeFitNote(selectedSize, people) ? (
          <p className="text-sm leading-6 text-muted">{sizeFitNote(selectedSize, people)}</p>
        ) : null}
        {errors.sizeId ? (
          <p role="alert" className="text-sm text-rose-deep">
            {errors.sizeId}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4">
        <h3 className="font-semibold text-ink">إضافات التصميم</h3>
        {listExtras().map((extra) => {
          const enabled = draft.extraIds.includes(extra.id)
          return (
            <fieldset key={extra.id} className="rounded-2xl border border-line bg-paper p-4">
              <legend className="px-1 font-semibold text-ink">{extra.name}</legend>
              <p className="mt-1 text-sm leading-6 text-muted">{extra.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ChoiceCard
                  name={extra.id}
                  value="no"
                  checked={!enabled}
                  title="لا"
                  onChange={() => onChange({ extraIds: draft.extraIds.filter((id) => id !== extra.id) })}
                />
                <ChoiceCard
                  name={extra.id}
                  value="yes"
                  checked={enabled}
                  title="نعم"
                  onChange={() =>
                    onChange({
                      extraIds: draft.extraIds.includes(extra.id) ? draft.extraIds : [...draft.extraIds, extra.id],
                    })
                  }
                />
              </div>
            </fieldset>
          )
        })}
      </div>
      </>
      ) : null}
    </div>
  )
}
