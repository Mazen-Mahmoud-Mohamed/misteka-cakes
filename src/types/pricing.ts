export type PricingItemKind = 'price' | 'note' | 'text' | 'cake_size' | 'product' | 'product_tier'

export type PricingSectionWidth = 'full' | 'half'

export interface PricingContentItem {
  id: string
  sectionId: string
  kind: PricingItemKind
  label: string
  sublabel: string
  price: number | null
  unit: string
  note: string
  cakeSizeId: string | null
  productId: string | null
  priceTierId: string | null
  sortOrder: number
}

export interface PricingContentSection {
  id: string
  title: string
  description: string
  width: PricingSectionWidth
  sortOrder: number
  items: PricingContentItem[]
}

export const LINKED_PRICING_KINDS: PricingItemKind[] = ['cake_size', 'product', 'product_tier']
