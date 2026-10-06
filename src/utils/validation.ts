import { getProduct, getZone, listTimeSlots } from '@/services/catalogService'
import type { AvailabilityResult, OrderDraft } from '@/types'
import { isBookableDate, parseISODate, tooSoonMessage } from '@/utils/dates'
import { isEgyptianMobile, normalizeDigits } from '@/utils/phone'

export type FieldErrors = Record<string, string>

function clean(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value))
}

export function validateBasicInfo(draft: OrderDraft, availability: AvailabilityResult | null, checking: boolean): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.serviceType !== 'delivery' && draft.serviceType !== 'pickup') {
    errors.serviceType = 'اختاري التوصيل أو الاستلام.'
  }

  if (draft.serviceType === 'delivery' && !getZone(draft.areaId)) {
    errors.areaId = 'اختاري منطقة التوصيل. التوصيل حاليًا داخل القاهرة والجيزة فقط.'
  }

  const people = Number(draft.servings)
  if (!draft.servings.trim() || !Number.isInteger(people) || people < 1 || people > 999) {
    errors.servings = 'اكتبي عدد الأفراد بالأرقام.'
  }

  const dateMissing = !parseISODate(draft.date)
  const dateTooSoon = !dateMissing && !isBookableDate(draft.date)

  if (dateMissing) {
    errors.date = 'اختاري تاريخ الاستلام.'
  } else if (dateTooSoon) {
    errors.date = tooSoonMessage()
  }

  if (dateMissing || dateTooSoon) {
    return clean(errors)
  }

  if (!listTimeSlots().some((slot) => slot === draft.time)) {
    errors.time = 'اختاري الوقت.'
  } else if (checking) {
    errors.time = 'جارٍ التحقق من الموعد.'
  } else if (!availability) {
    errors.time = 'جارٍ التحقق من الموعد.'
  } else if (availability.status === 'conflict') {
    errors.time = 'اختاري وقتًا آخر.'
  } else if (availability.status === 'unknown') {
    errors.time = availability.message
  }

  return clean(errors)
}

export function validateCake(draft: OrderDraft): FieldErrors {
  const errors: FieldErrors = {}
  const notes = draft.designNotes.trim()
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const isNonCakeProduct = Boolean(product && product.pricingMode !== 'cake_sizes' && !draft.cakeId)

  if (isNonCakeProduct) {
    for (const option of product?.options ?? []) {
      if (!option.required) continue
      const selected = option.values.some((v) => draft.optionValueIds.includes(v.id))
      if (!selected) errors[`option_${option.id}`] = `اختاري: ${option.name}`
    }
    return clean(errors)
  }

  if (draft.designMode === 'catalog' || draft.designMode === 'similar') {
    if (!draft.cakeId && !draft.offerId) errors.cakeId = 'اختاري التصميم.'
  }

  if (draft.designMode === 'similar' && notes.length < 8) {
    errors.designNotes = 'صفي الفرق المطلوب عن التصميم المختار.'
  }

  if (draft.designMode === 'custom' && notes.length < 8) {
    errors.designNotes = 'صفي التصميم المطلوب: الألوان، المناسبة، وأي كتابة.'
  }

  if (!draft.sizeId && !draft.offerId) errors.sizeId = 'اختاري المقاس.'

  return clean(errors)
}

export function validateFilling(draft: OrderDraft): FieldErrors {
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const isNonCakeProduct = Boolean(product && product.pricingMode !== 'cake_sizes' && !draft.cakeId)
  if (isNonCakeProduct) return {}
  if (!draft.fillingId) return { fillingId: 'اختاري الحشوة.' }
  return {}
}

export function validateCustomer(draft: OrderDraft): FieldErrors {
  const errors: FieldErrors = {}
  if (draft.customerName.trim().length < 2) errors.customerName = 'اكتبي الاسم.'
  if (!isEgyptianMobile(draft.phone)) errors.phone = 'اكتبي رقم موبايل مصري صحيح.'
  return clean(errors)
}

export function normalizePhone(value: string): string {
  return normalizeDigits(value)
}
