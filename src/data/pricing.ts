import type { CakeSize } from '@/types'

/**
 * Source of truth: reference/basic-prices-2.jpeg
 * Single-tier sheet. Servings are copied as printed ("يكفي").
 * 14, 16, 18 and 20 are single counts. 24, 26 and 30 are ranges.
 */
export const singleTierSizes: CakeSize[] = [
  { id: 'single-14', group: 'single', label: '14 سم', servingsLabel: '4 أفراد', servingsMin: 4, servingsMax: 4, price: 500 },
  { id: 'single-16', group: 'single', label: '16 سم', servingsLabel: '7 أفراد', servingsMin: 7, servingsMax: 7, price: 600 },
  { id: 'single-18', group: 'single', label: '18 سم', servingsLabel: '10 أفراد', servingsMin: 10, servingsMax: 10, price: 700 },
  { id: 'single-20', group: 'single', label: '20 سم', servingsLabel: '15 فرد', servingsMin: 15, servingsMax: 15, price: 800 },
  { id: 'single-24', group: 'single', label: '24 سم', servingsLabel: '20 - 23 فرد', servingsMin: 20, servingsMax: 23, price: 1100 },
  { id: 'single-26', group: 'single', label: '26 سم', servingsLabel: '25 - 27 فرد', servingsMin: 25, servingsMax: 27, price: 1350 },
  { id: 'single-30', group: 'single', label: '30 سم', servingsLabel: '30 - 35 فرد', servingsMin: 30, servingsMax: 35, price: 1700 },
]

/**
 * Source of truth: reference/basic-prices-1.jpeg
 * Two-tier sheet. Servings are marked approximate on the sheet.
 * The last row is printed as 50+.
 */
export const twoTierSizes: CakeSize[] = [
  { id: 'tier-14-20', group: 'two-tier', label: '14 فوق × 20 تحت', servingsLabel: '20 فرد', servingsMin: 20, servingsMax: 20, price: 1500 },
  { id: 'tier-18-24', group: 'two-tier', label: '18 فوق × 24 تحت', servingsLabel: '30 فرد', servingsMin: 30, servingsMax: 30, price: 1800 },
  { id: 'tier-20-26', group: 'two-tier', label: '20 فوق × 26 تحت', servingsLabel: '35 فرد', servingsMin: 35, servingsMax: 35, price: 2200 },
  { id: 'tier-24-30', group: 'two-tier', label: '24 فوق × 30 تحت', servingsLabel: '50+ فرد', servingsMin: 50, servingsMax: null, price: 2600 },
]

export const basicCakePricing = {
  single: singleTierSizes,
  twoTier: twoTierSizes,
}

export const pricingNotes = [
  'يمكن تنفيذ جميع المقاسات حسب طلب العميل.',
  'التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.',
  'المجسمات والتصاميم الخاصة يتم تحديد سعرها بعد المعاينة حسب حجم التصميم وتعقيده.',
] as const
