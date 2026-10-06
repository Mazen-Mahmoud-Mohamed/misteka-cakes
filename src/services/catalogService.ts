import { timeSlots } from '@/data/options'
import { getCatalog } from '@/services/catalogStore'
import type { Cake, CakeSize, PricingGroup } from '@/types'
import type { Offer, Product, ProductCategory } from '@/types/products'

/**
 * Synchronous catalog accessors.
 * Backed by the in-memory store (local by default, Supabase after hydration).
 * Never silently swap back to hardcoded pricing once sizes are in the store.
 */

export function listCakes(): Cake[] {
  return getCatalog().cakes
}

export function listCategories() {
  return getCatalog().categories
}

export function getCategoryLabel(id: string): string {
  return (
    getCatalog().productCategories.find((category) => category.id === id)?.name ||
    getCatalog().categories.find((category) => category.id === id)?.name ||
    ''
  )
}

export function getCake(id: string): Cake | undefined {
  return getCatalog().cakes.find((cake) => cake.id === id)
}

export function listProductCategories(): ProductCategory[] {
  return getCatalog().productCategories.filter((c) => c.enabled)
}

export function listTopProductCategories(): ProductCategory[] {
  return listProductCategories()
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function listChildProductCategories(parentId: string): ProductCategory[] {
  return listProductCategories()
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getProductCategory(id: string): ProductCategory | undefined {
  return listProductCategories().find((c) => c.id === id)
}

export function listProducts(): Product[] {
  return getCatalog().products.filter((p) => p.enabled)
}

export function getProduct(id: string): Product | undefined {
  return listProducts().find((p) => p.id === id)
}

export function listProductsInCategory(categoryId: string | 'all', subcategoryId?: string | 'all'): Product[] {
  const products = listProducts()
  if (categoryId === 'all') return products

  const category = getProductCategory(categoryId)
  if (!category) return []

  if (category.kind === 'offers') return []

  const childIds = listChildProductCategories(categoryId).map((c) => c.id)
  const allowed = new Set<string>([categoryId, ...childIds])

  let filtered = products.filter((p) => allowed.has(p.categoryId))
  if (subcategoryId && subcategoryId !== 'all') {
    filtered = filtered.filter((p) => p.categoryId === subcategoryId)
  }
  return filtered
}

export function listProductsForOfferComponent(component: {
  productId: string | null
  categoryId: string | null
  customerPicks: boolean
}): Product[] {
  if (component.productId && !component.customerPicks) {
    const product = getProduct(component.productId)
    return product ? [product] : []
  }
  if (component.productId && component.customerPicks) {
    const product = getProduct(component.productId)
    return product ? [product] : []
  }
  if (!component.categoryId) return []
  return listProductsInCategory(component.categoryId, 'all').filter((p) => p.pricingMode !== 'quote')
}

export function listOffers(): Offer[] {
  return getCatalog().offers.filter((o) => o.enabled)
}

export function getOffer(id: string): Offer | undefined {
  return listOffers().find((o) => o.id === id)
}

export function listSizes(group?: PricingGroup): CakeSize[] {
  const sizes = getCatalog().sizes
  if (group === 'single') return sizes.filter((size) => size.group === 'single')
  if (group === 'two-tier') return sizes.filter((size) => size.group === 'two-tier')
  return sizes
}

export function getSize(id: string): CakeSize | undefined {
  return getCatalog().sizes.find((size) => size.id === id)
}

/** Splits enabled sizes already loaded into the catalog store (sort_order preserved). */
export function getBasicPricing(): { single: CakeSize[]; twoTier: CakeSize[] } {
  const sizes = getCatalog().sizes
  return {
    single: sizes.filter((size) => size.group === 'single'),
    twoTier: sizes.filter((size) => size.group === 'two-tier'),
  }
}

export function getPricingNotes() {
  return getCatalog().pricingNotes
}

export function listFillings() {
  return getCatalog().fillings
}

export function getFilling(id: string) {
  return getCatalog().fillings.find((filling) => filling.id === id)
}

export function listExtras() {
  return getCatalog().extras
}

export function listZones() {
  return getCatalog().zones.filter((zone) => zone.enabled)
}

export function getZone(id: string) {
  return listZones().find((zone) => zone.id === id)
}

export function listTimeSlots() {
  return timeSlots
}

export function getDeliveryPolicy() {
  const catalog = getCatalog()
  return {
    fee: catalog.deliveryFee,
    note: catalog.deliveryNote,
  }
}
