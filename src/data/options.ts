import type { DeliveryZone, DesignExtra, Filling } from '@/types'

export const bookingRules = {
  minAdvanceDays: 3,
  tooSoonMessage: 'الحجز يجب أن يكون قبل موعد الاستلام بـ 3 أيام على الأقل.',
} as const

/** TODO: أوقات الاستلام النهائية لم تُحدَّد بعد. */
export const timeSlots = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] as const

export const deliveryZones: DeliveryZone[] = [
  { id: 'cairo', name: 'القاهرة', enabled: true },
  { id: 'giza', name: 'الجيزة', enabled: true },
]

export const deliveryPolicy = {
  /**
   * TODO: no fixed delivery fee was provided.
   * The price sheets say Uber is paid by the customer and is outside the cake price.
   * Set `fee` to a number later if a delivery charge is added.
   */
  fee: null as number | null,
  note: 'التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.',
}

/**
 * TODO: filling prices were not provided.
 * `none` is an explicit no-extra-charge choice. Leave other prices null.
 */
export const fillings: Filling[] = [
  {
    id: 'none',
    name: 'بدون حشوة إضافية',
    description: 'التورتة بدون حشوة مضافة.',
    price: 0,
    priceStatus: 'known',
  },
  {
    id: 'nutella',
    name: 'نوتيلا',
    description: 'السعر غير محدد بعد.',
    price: null,
    priceStatus: 'pending',
  },
  {
    id: 'blueberry',
    name: 'توت أزرق',
    description: 'السعر غير محدد بعد.',
    price: null,
    priceStatus: 'pending',
  },
  {
    id: 'mango',
    name: 'مانجا',
    description: 'السعر غير محدد بعد.',
    price: null,
    priceStatus: 'pending',
  },
]

/**
 * Sugar figures are quoted after review, as printed on both price sheets.
 * Edible prints have no price yet — leave null.
 */
export const designExtras: DesignExtra[] = [
  {
    id: 'sugar-figures',
    name: 'مجسمات عجينة سكر',
    description: 'يتم تحديد السعر بعد المعاينة حسب حجم المجسم وتعقيده.',
    price: null,
    priceStatus: 'quote',
  },
  {
    id: 'edible-print',
    name: 'صور قابلة للأكل',
    description: 'السعر غير محدد بعد.',
    price: null,
    priceStatus: 'pending',
  },
]
