import { getDeliveryPolicy } from '@/services/catalogService'
import type { CakeSize, DesignExtra, Filling, OrderTotal, PriceLine, ServiceType } from '@/types'

export function recommendSizeId(sizes: CakeSize[], people: number): string | null {
  if (!Number.isFinite(people) || people < 1) return null

  const finite = sizes.filter((size) => size.servingsMax != null)
  const fit = finite
    .filter((size) => people <= (size.servingsMax as number))
    .sort((a, b) => (a.servingsMax as number) - (b.servingsMax as number) || a.price - b.price)

  if (fit[0]) return fit[0].id

  const open = sizes
    .filter((size) => size.servingsMax == null)
    .sort((a, b) => (a.servingsMin ?? 0) - (b.servingsMin ?? 0))

  const covering = open.find((size) => people >= (size.servingsMin ?? 0))
  if (covering) return covering.id

  if (open[0] && finite.every((size) => (size.servingsMax as number) < people)) {
    return open[0].id
  }

  return null
}

export function sizeFitNote(size: CakeSize, people: number): string | null {
  if (size.servingsMax != null && people > size.servingsMax) {
    return 'هذا المقاس يكفي عددًا أقل من الأفراد المكتوب تقريبًا.'
  }
  if (size.servingsMin != null && people < size.servingsMin && size.servingsMax == null) {
    return 'القائمة تبدأ هذا المقاس من عدد أكبر تقريبًا.'
  }
  if (size.servingsMin != null && size.servingsMax != null && (people < size.servingsMin || people > size.servingsMax)) {
    return 'عدد الأفراد خارج المدى المكتوب لهذا المقاس. يمكنك المتابعة، والمقاس تقريبي.'
  }
  return null
}

export function calculateOrderTotal(input: {
  size: CakeSize | null
  customSize: boolean
  filling: Filling | null
  extras: DesignExtra[]
  serviceType: '' | ServiceType
  /** Optional product add-on lines (name + adjustment). */
  optionLines?: Array<{ id: string; label: string; amount: number }>
  /** When ordering a fixed-price non-cake product, use this as base instead of size. */
  fixedProductBase?: { label: string; amount: number | null; pending?: boolean } | null
}): OrderTotal {
  const lines: PriceLine[] = []
  let estimatedTotal: number | null = 0
  const pendingCharges: string[] = []

  if (input.fixedProductBase) {
    if (input.fixedProductBase.pending || input.fixedProductBase.amount == null) {
      lines.push({
        id: 'base',
        label: input.fixedProductBase.label,
        amount: null,
        status: 'pending',
      })
      pendingCharges.push(input.fixedProductBase.label)
      estimatedTotal = null
    } else {
      lines.push({
        id: 'base',
        label: input.fixedProductBase.label,
        amount: input.fixedProductBase.amount,
        status: 'known',
      })
      estimatedTotal = input.fixedProductBase.amount
    }
  } else if (input.customSize || !input.size) {
    lines.push({
      id: 'base',
      label: 'سعر المقاس',
      amount: null,
      status: 'pending',
      note: 'مقاس حسب الطلب، وغير موجود في قائمة الأسعار الحالية.',
    })
    pendingCharges.push('سعر المقاس')
    estimatedTotal = null
  } else {
    lines.push({
      id: 'base',
      label: `سعر المقاس (${input.size.label})`,
      amount: input.size.price,
      status: 'known',
    })
    estimatedTotal = input.size.price
  }

  if (input.filling && !(input.filling.id === 'none' && input.filling.price === 0)) {
    if (input.filling.price == null) {
      lines.push({
        id: 'filling',
        label: input.filling.name,
        amount: null,
        status: input.filling.priceStatus,
      })
      pendingCharges.push(input.filling.name)
    } else {
      lines.push({
        id: 'filling',
        label: input.filling.name,
        amount: input.filling.price,
        status: 'known',
        note: input.filling.price === 0 ? 'بدون إضافة' : undefined,
      })
      if (estimatedTotal != null) estimatedTotal += input.filling.price
    }
  }

  for (const extra of input.extras) {
    if (extra.price == null) {
      lines.push({
        id: extra.id,
        label: extra.name,
        amount: null,
        status: extra.priceStatus,
        note: extra.description,
      })
      pendingCharges.push(extra.name)
    } else {
      lines.push({
        id: extra.id,
        label: extra.name,
        amount: extra.price,
        status: 'known',
      })
      if (estimatedTotal != null) estimatedTotal += extra.price
    }
  }

  for (const option of input.optionLines ?? []) {
    lines.push({
      id: option.id,
      label: option.label,
      amount: option.amount,
      status: 'known',
    })
    if (estimatedTotal != null) estimatedTotal += option.amount
  }

  if (input.serviceType === 'delivery') {
    const policy = getDeliveryPolicy()
    if (policy.fee == null) {
      lines.push({
        id: 'delivery',
        label: 'التوصيل',
        amount: null,
        status: 'outside',
        note: policy.note,
      })
    } else {
      lines.push({
        id: 'delivery',
        label: 'التوصيل',
        amount: policy.fee,
        status: 'known',
      })
      if (estimatedTotal != null) estimatedTotal += policy.fee
    }
  }

  return {
    lines,
    estimatedTotal,
    pendingCharges,
  }
}

export function knownExtrasTotal(extras: DesignExtra[]): number | null {
  if (extras.some((extra) => extra.price == null)) return null
  return extras.reduce((sum, extra) => sum + (extra.price ?? 0), 0)
}
