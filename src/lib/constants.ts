export const STORAGE_KEYS = {
  orders: 'misteka.orders.v1',
  draft: 'misteka.draft.v1',
} as const

export const REFERENCE_IMAGE = {
  maxBytes: 5 * 1024 * 1024,
  accept: ['image/jpeg', 'image/png', 'image/webp'],
  tooLarge: 'حجم الصورة أكبر من 5 ميغابايت.',
  badType: 'استخدمي صورة بصيغة JPG أو PNG أو WEBP.',
} as const

export const ORDER_REFERENCES_BUCKET = 'order-references'
