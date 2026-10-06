export type ProductPricingMode = 'cake_sizes' | 'fixed' | 'quote'

export type ProductCategoryKind = 'standard' | 'offers'

export type ProductOptionSelection = 'toggle' | 'single' | 'multi'

export type OfferPricingRule = 'components' | 'custom_bundle'

export type OfferComponentPricing =
  | 'full_price'
  | 'percent_off'
  | 'fixed_off'
  | 'free'
  | 'included_in_bundle'

export interface ProductCategory {
  id: string
  parentId: string | null
  name: string
  description: string
  kind: ProductCategoryKind
  sortOrder: number
  enabled: boolean
}

export interface ProductImage {
  id: string
  productId: string
  image: string
  imageKey: string
  imageAlt: string
  sortOrder: number
}

export interface ProductOptionValue {
  id: string
  optionId: string
  name: string
  priceAdjustment: number
  sortOrder: number
  enabled: boolean
}

export interface ProductOption {
  id: string
  productId: string
  name: string
  description: string
  selectionType: ProductOptionSelection
  required: boolean
  sortOrder: number
  enabled: boolean
  values: ProductOptionValue[]
}

export interface Product {
  id: string
  name: string
  description: string
  categoryId: string
  pricingMode: ProductPricingMode
  fixedPrice: number | null
  priceNote: string
  legacyCakeId: string | null
  image: string
  imageAlt: string
  imageKey: string
  sortOrder: number
  enabled: boolean
  images: ProductImage[]
  options: ProductOption[]
}

export interface OfferComponent {
  id: string
  offerId: string
  productId: string | null
  categoryId: string | null
  quantity: number
  roleLabel: string
  componentPricing: OfferComponentPricing
  discountPercent: number | null
  discountAmount: number | null
  customerPicks: boolean
  sortOrder: number
}

export interface Offer {
  id: string
  name: string
  description: string
  image: string
  imageKey: string
  imageAlt: string
  badgeLabel: string
  pricingRule: OfferPricingRule
  customBundlePrice: number | null
  startsAt: string | null
  endsAt: string | null
  sortOrder: number
  enabled: boolean
  components: OfferComponent[]
}

/** True when any component uses a real discount / gift rule. */
export function offerHasDiscount(offer: Offer): boolean {
  if (offer.pricingRule === 'custom_bundle') return true
  return offer.components.some((c) =>
    c.componentPricing === 'percent_off' ||
    c.componentPricing === 'fixed_off' ||
    c.componentPricing === 'free',
  )
}

export function offerDiscountBadge(offer: Offer): string | null {
  if (!offerHasDiscount(offer)) return null
  const percent = offer.components.find((c) => c.componentPricing === 'percent_off' && c.discountPercent != null)
  if (percent?.discountPercent != null) {
    return `خصم ${percent.discountPercent}%`
  }
  if (offer.components.some((c) => c.componentPricing === 'free')) return 'هدية'
  if (offer.pricingRule === 'custom_bundle') return 'باقة'
  return offer.badgeLabel || 'عرض خاص'
}
