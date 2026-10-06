export type ProductPricingMode = 'cake_sizes' | 'fixed' | 'quote'

/** Admin/customer ordering configuration — source of truth (not product/category names). */
export type ProductOrderingModel =
  | 'cake_servings'
  | 'quantity'
  | 'fixed_item'
  | 'weight'
  | 'quote'
  | 'custom'

export type ProductPriceTierKind = 'package' | 'quantity_range' | 'weight' | 'unit'

export type ProductCategoryKind = 'standard' | 'offers'

export type ProductOptionSelection = 'toggle' | 'single' | 'multi' | 'text' | 'textarea' | 'quantity'

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
  /** Reusable definition id when sourced from option library. */
  definitionId?: string | null
  name: string
  description: string
  selectionType: ProductOptionSelection
  required: boolean
  sortOrder: number
  enabled: boolean
  values: ProductOptionValue[]
}

export interface ProductPriceTier {
  id: string
  productId: string
  tierKind: ProductPriceTierKind
  label: string
  packageQty: number | null
  qtyMin: number | null
  qtyMax: number | null
  weightGrams: number | null
  price: number
  sortOrder: number
  enabled: boolean
}

export interface Product {
  id: string
  name: string
  description: string
  categoryId: string
  /** Legacy mirror of orderingModel for older readers. */
  pricingMode: ProductPricingMode
  orderingModel: ProductOrderingModel
  fixedPrice: number | null
  priceNote: string
  legacyCakeId: string | null
  qtyMin: number | null
  qtyMax: number | null
  qtyStep: number | null
  image: string
  imageAlt: string
  imageKey: string
  sortOrder: number
  enabled: boolean
  images: ProductImage[]
  options: ProductOption[]
  priceTiers: ProductPriceTier[]
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

export interface OptionDefinition {
  id: string
  name: string
  description: string
  selectionType: ProductOptionSelection
  sortOrder: number
  enabled: boolean
  values: ProductOptionValue[]
}

export const ORDERING_MODEL_LABELS: Record<ProductOrderingModel, string> = {
  cake_servings: 'بعدد الأفراد / مقاس التورت',
  quantity: 'بالكمية / باكدجات',
  fixed_item: 'سعر ثابت للقطعة',
  weight: 'بالوزن',
  quote: 'اطلب السعر',
  custom: 'مخصص',
}

/** True when any component uses a real discount / gift rule. */
export function offerHasDiscount(offer: Offer): boolean {
  if (offer.pricingRule === 'custom_bundle') return true
  return offer.components.some(
    (c) =>
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

export function isCakeOrdering(product: Pick<Product, 'orderingModel' | 'pricingMode' | 'legacyCakeId'>): boolean {
  return (
    product.orderingModel === 'cake_servings' ||
    product.pricingMode === 'cake_sizes' ||
    Boolean(product.legacyCakeId)
  )
}

export function isQuoteOrdering(product: Pick<Product, 'orderingModel' | 'pricingMode'>): boolean {
  return product.orderingModel === 'quote' || product.pricingMode === 'quote'
}
