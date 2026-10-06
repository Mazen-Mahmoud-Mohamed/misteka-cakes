import type { CakeSize } from '@/types'
import type { PricingContentItem, PricingContentSection } from '@/types/pricing'
import { isCakeOrdering, isQuoteOrdering, type Product, type ProductCategory } from '@/types/products'
import { formatEgp } from '@/utils/format'

export type ResolvedPricingRow =
  | { id: string; type: 'row'; label: string; sublabel: string; price: string; note: string }
  | { id: string; type: 'note' | 'text'; text: string }

export interface PricingSources {
  sizes: CakeSize[]
  products: Product[]
}

function withUnit(price: string, unit: string) {
  return unit.trim() ? `${price} / ${unit.trim()}` : price
}

function productPriceText(product: Product): string | null {
  if (isQuoteOrdering(product)) return 'اطلب السعر'
  if (product.fixedPrice != null) return formatEgp(product.fixedPrice)
  const prices = product.priceTiers.filter((t) => t.enabled).map((t) => t.price)
  if (prices.length) return `من ${formatEgp(Math.min(...prices))}`
  return null
}

/**
 * Turns one admin pricing item into display text.
 * Linked items always read the live catalog price; returns null when the target is hidden or missing.
 */
export function resolvePricingItem(item: PricingContentItem, sources: PricingSources): ResolvedPricingRow | null {
  switch (item.kind) {
    case 'note':
    case 'text':
      return item.label.trim() ? { id: item.id, type: item.kind, text: item.label } : null
    case 'price':
      if (item.price == null) return null
      return {
        id: item.id,
        type: 'row',
        label: item.label,
        sublabel: item.sublabel,
        price: withUnit(formatEgp(item.price), item.unit),
        note: item.note,
      }
    case 'cake_size': {
      const size = sources.sizes.find((s) => s.id === item.cakeSizeId)
      if (!size) return null
      return {
        id: item.id,
        type: 'row',
        label: item.label || size.label,
        sublabel: item.sublabel || size.servingsLabel,
        price: withUnit(formatEgp(size.price), item.unit),
        note: item.note,
      }
    }
    case 'product': {
      const product = sources.products.find((p) => p.id === item.productId && p.enabled)
      if (!product) return null
      const price = productPriceText(product)
      if (!price) return null
      const unit = item.unit || (product.orderingModel === 'quantity' && product.fixedPrice != null ? 'قطعة' : '')
      return {
        id: item.id,
        type: 'row',
        label: item.label || product.name,
        sublabel: item.sublabel,
        price: isQuoteOrdering(product) ? price : withUnit(price, unit),
        note: item.note,
      }
    }
    case 'product_tier': {
      for (const product of sources.products) {
        if (!product.enabled) continue
        const tier = product.priceTiers.find((t) => t.id === item.priceTierId && t.enabled)
        if (!tier) continue
        const unit = item.unit || (tier.tierKind === 'quantity_range' || tier.tierKind === 'unit' ? 'قطعة' : '')
        return {
          id: item.id,
          type: 'row',
          label: item.label || `${product.name} — ${tier.label}`,
          sublabel: item.sublabel,
          price: withUnit(formatEgp(tier.price), unit),
          note: item.note,
        }
      }
      return null
    }
  }
}

function linked(
  id: string,
  sectionId: string,
  sortOrder: number,
  link: Pick<PricingContentItem, 'kind' | 'cakeSizeId' | 'productId' | 'priceTierId'>,
): PricingContentItem {
  return { id, sectionId, label: '', sublabel: '', price: null, unit: '', note: '', sortOrder, ...link }
}

/**
 * Default layout used only when the pricing_sections table is not available yet.
 * Mirrors the seed in supabase/pricing-content.sql so both paths render the same page.
 */
export function deriveDefaultPricingSections(
  sources: PricingSources & { productCategories: ProductCategory[]; notes: readonly string[] },
): PricingContentSection[] {
  const sections: PricingContentSection[] = []
  const sizeSection = (id: string, title: string, description: string, group: CakeSize['group'], sort: number) => {
    const items = sources.sizes
      .filter((s) => s.group === group)
      .map((s, i) => linked(`pi-size-${s.id}`, id, i, { kind: 'cake_size', cakeSizeId: s.id, productId: null, priceTierId: null }))
    if (items.length) sections.push({ id, title, description, width: 'half', sortOrder: sort, items })
  }
  sizeSection('ps-cakes-single', 'التورت — دور واحد', '', 'single', 10)
  sizeSection('ps-cakes-two-tier', 'التورت — دورين', 'عدد الأفراد تقريبي، كما في قائمة الأسعار.', 'two-tier', 20)

  const enabledCategories = sources.productCategories.filter((c) => c.enabled)
  const roots = enabledCategories
    .filter((c) => c.parentId === null && c.kind !== 'offers' && c.id !== 'cat-cakes')
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const root of roots) {
    const allowed = new Set([root.id, ...enabledCategories.filter((c) => c.parentId === root.id).map((c) => c.id)])
    const sectionId = `ps-cat-${root.id}`
    const items: PricingContentItem[] = []
    const products = sources.products
      .filter((p) => p.enabled && allowed.has(p.categoryId) && !isCakeOrdering(p))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const product of products) {
      const tiers = product.priceTiers.filter(
        (t) => t.enabled && (t.tierKind === 'package' || t.tierKind === 'weight' || t.tierKind === 'quantity_range'),
      )
      if (tiers.length) {
        for (const tier of tiers) {
          items.push(
            linked(`pi-tier-${tier.id}`, sectionId, items.length, {
              kind: 'product_tier',
              cakeSizeId: null,
              productId: null,
              priceTierId: tier.id,
            }),
          )
        }
      } else if (product.fixedPrice != null || isQuoteOrdering(product)) {
        items.push(
          linked(`pi-product-${product.id}`, sectionId, items.length, {
            kind: 'product',
            cakeSizeId: null,
            productId: product.id,
            priceTierId: null,
          }),
        )
      }
    }
    if (items.length) {
      sections.push({ id: sectionId, title: root.name, description: '', width: 'full', sortOrder: 100 + root.sortOrder, items })
    }
  }

  if (sources.notes.length) {
    sections.push({
      id: 'ps-notes',
      title: 'ملاحظات',
      description: '',
      width: 'full',
      sortOrder: 1000,
      items: sources.notes.map((text, i) => ({
        ...linked(`pi-note-${i + 1}`, 'ps-notes', i, { kind: 'note', cakeSizeId: null, productId: null, priceTierId: null }),
        label: text,
      })),
    })
  }
  return sections
}
