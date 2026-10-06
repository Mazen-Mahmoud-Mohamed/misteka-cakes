import { createLocalCatalog, resolveCakeImage, type CatalogBundle } from '@/data/localCatalog'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCatalog, getCatalogSource, setCatalog } from '@/services/catalogStore'
import type { Cake, CakeCategoryInfo, CakeSize, ChargeStatus, DataSource, DeliveryZone, DesignExtra, Filling, PricingGroup } from '@/types'
import type {
  Offer,
  OfferComponent,
  OfferComponentPricing,
  OfferPricingRule,
  Product,
  ProductCategory,
  ProductCategoryKind,
  ProductImage,
  ProductOption,
  ProductOptionSelection,
  ProductOptionValue,
  ProductOrderingModel,
  ProductPriceTier,
  ProductPriceTierKind,
  ProductPricingMode,
} from '@/types/products'
import { pricingNotes } from '@/data/pricing'
import { deriveDefaultPricingSections } from '@/services/pricingContent'
import type { PricingContentSection, PricingItemKind, PricingSectionWidth } from '@/types/pricing'

interface PricingSectionRow {
  id: string
  title: string
  description: string
  width: PricingSectionWidth
  sort_order: number
}

interface PricingItemRow {
  id: string
  section_id: string
  item_kind: PricingItemKind
  label: string
  sublabel: string
  price: number | string | null
  unit: string
  note: string
  cake_size_id: string | null
  product_id: string | null
  price_tier_id: string | null
  sort_order: number
}

function mapPricingSections(sections: PricingSectionRow[], items: PricingItemRow[]): PricingContentSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description ?? '',
    width: section.width === 'half' ? 'half' : 'full',
    sortOrder: section.sort_order,
    items: items
      .filter((item) => item.section_id === section.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        sectionId: item.section_id,
        kind: item.item_kind,
        label: item.label ?? '',
        sublabel: item.sublabel ?? '',
        price: item.price == null ? null : Number(item.price),
        unit: item.unit ?? '',
        note: item.note ?? '',
        cakeSizeId: item.cake_size_id,
        productId: item.product_id,
        priceTierId: item.price_tier_id,
        sortOrder: item.sort_order,
      })),
  }))
}

interface CakeSizeRow {
  id: string
  pricing_group: PricingGroup
  label: string
  servings_label: string
  servings_min: number | null
  servings_max: number | null
  price: number
  sort_order: number
}

interface CakeRow {
  id: string
  name: string
  description: string
  image_key: string
  image_alt: string
  image_position: string
  category: Cake['category']
  pricing_group: PricingGroup
  base_price: number | null
  price_note: string
  serving_info: string
  available_size_ids: string[] | null
  filling_ids: string[] | null
  extra_ids: string[] | null
  sort_order: number
}

interface FillingRow {
  id: string
  name: string
  description: string
  price: number | null
  price_status: ChargeStatus
  sort_order: number
}

interface ExtraRow {
  id: string
  name: string
  description: string
  price: number | null
  price_status: ChargeStatus
  sort_order: number
}

interface ZoneRow {
  id: string
  name: string
  enabled: boolean
  sort_order: number
}

interface ProductCategoryRow {
  id: string
  parent_id: string | null
  name: string
  description: string
  kind: ProductCategoryKind
  sort_order: number
  enabled: boolean
}

interface ProductRow {
  id: string
  name: string
  description: string
  category_id: string
  pricing_mode: ProductPricingMode
  ordering_model?: ProductOrderingModel | null
  fixed_price: number | null
  price_note: string
  legacy_cake_id: string | null
  qty_min?: number | null
  qty_max?: number | null
  qty_step?: number | null
  image_key: string
  image_alt: string
  sort_order: number
  enabled: boolean
}

interface ProductPriceTierRow {
  id: string
  product_id: string
  tier_kind: ProductPriceTierKind
  label: string
  package_qty: number | null
  qty_min: number | null
  qty_max: number | null
  weight_grams: number | null
  price: number
  sort_order: number
  enabled: boolean
}

interface ProductOptionLinkRow {
  id: string
  product_id: string
  definition_id: string
  required: boolean
  sort_order: number
  enabled: boolean
}

interface OptionDefinitionRow {
  id: string
  name: string
  description: string
  selection_type: ProductOptionSelection
  sort_order: number
  enabled: boolean
}

interface OptionDefinitionValueRow {
  id: string
  definition_id: string
  name: string
  price_adjustment: number
  sort_order: number
  enabled: boolean
}

interface ProductOptionLinkValueOverrideRow {
  id: string
  link_id: string
  definition_value_id: string
  price_adjustment: number
  enabled: boolean | null
}

interface ProductImageRow {
  id: string
  product_id: string
  image_key: string
  image_alt: string
  sort_order: number
}

interface ProductOptionRow {
  id: string
  product_id: string
  name: string
  description: string
  selection_type: ProductOptionSelection
  required: boolean
  sort_order: number
  enabled: boolean
}

interface ProductOptionValueRow {
  id: string
  option_id: string
  name: string
  price_adjustment: number
  sort_order: number
  enabled: boolean
}

interface OfferRow {
  id: string
  name: string
  description: string
  image_key: string
  image_alt: string
  badge_label: string
  pricing_rule: OfferPricingRule
  custom_bundle_price: number | null
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  enabled: boolean
}

interface OfferComponentRow {
  id: string
  offer_id: string
  product_id: string | null
  category_id: string | null
  quantity: number
  role_label: string
  component_pricing: OfferComponentPricing
  discount_percent: number | null
  discount_amount: number | null
  customer_picks: boolean
  sort_order: number
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function mapSizes(rows: CakeSizeRow[]): CakeSize[] {
  return rows.map((row) => ({
    id: row.id,
    group: row.pricing_group,
    label: row.label,
    servingsLabel: row.servings_label,
    servingsMin: row.servings_min,
    servingsMax: row.servings_max,
    price: Number(row.price),
  }))
}

function mapCakes(rows: CakeRow[]): Cake[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    image: resolveCakeImage(row.image_key),
    imageAlt: row.image_alt.trim() || row.name,
    imagePosition: row.image_position,
    category: row.category,
    pricingGroup: row.pricing_group,
    basePrice: row.base_price == null ? null : Number(row.base_price),
    priceNote: row.price_note,
    servingInfo: row.serving_info,
    availableSizeIds: asStringArray(row.available_size_ids),
    fillingIds: asStringArray(row.filling_ids),
    extraIds: asStringArray(row.extra_ids),
  }))
}

function mapFillings(rows: FillingRow[]): Filling[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price == null ? null : Number(row.price),
    priceStatus: row.price_status,
  }))
}

function mapExtras(rows: ExtraRow[]): DesignExtra[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price == null ? null : Number(row.price),
    priceStatus: row.price_status,
  }))
}

function mapZones(rows: ZoneRow[]): DeliveryZone[] {
  return rows
    .filter((row) => row.enabled)
    .map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
    }))
}

function mapProductCategories(rows: ProductCategoryRow[]): ProductCategory[] {
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description ?? '',
    kind: row.kind,
    sortOrder: row.sort_order,
    enabled: row.enabled,
  }))
}

function mapProductImages(rows: ProductImageRow[]): ProductImage[] {
  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    imageKey: row.image_key,
    image: resolveCakeImage(row.image_key),
    imageAlt: row.image_alt.trim() || '',
    sortOrder: row.sort_order,
  }))
}

function mapOptionValues(rows: ProductOptionValueRow[]): ProductOptionValue[] {
  return rows.map((row) => ({
    id: row.id,
    optionId: row.option_id,
    name: row.name,
    priceAdjustment: Number(row.price_adjustment),
    sortOrder: row.sort_order,
    enabled: row.enabled,
  }))
}

function mapOptions(rows: ProductOptionRow[], valuesByOption: Map<string, ProductOptionValue[]>): ProductOption[] {
  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    name: row.name,
    description: row.description ?? '',
    selectionType: row.selection_type,
    required: row.required,
    sortOrder: row.sort_order,
    enabled: row.enabled,
    values: (valuesByOption.get(row.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
  }))
}

function inferOrderingModel(row: ProductRow): ProductOrderingModel {
  if (row.ordering_model) return row.ordering_model
  if (row.pricing_mode === 'cake_sizes' || row.legacy_cake_id) return 'cake_servings'
  if (row.pricing_mode === 'quote') return 'quote'
  return 'fixed_item'
}

function mapPriceTiers(rows: ProductPriceTierRow[]): ProductPriceTier[] {
  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    tierKind: row.tier_kind,
    label: row.label,
    packageQty: row.package_qty,
    qtyMin: row.qty_min,
    qtyMax: row.qty_max,
    weightGrams: row.weight_grams,
    price: Number(row.price),
    sortOrder: row.sort_order,
    enabled: row.enabled,
  }))
}

function mapProducts(
  rows: ProductRow[],
  imagesByProduct: Map<string, ProductImage[]>,
  optionsByProduct: Map<string, ProductOption[]>,
  tiersByProduct: Map<string, ProductPriceTier[]>,
): Product[] {
  return rows.map((row) => {
    const imageKey = row.image_key ?? ''
    const image = imageKey ? resolveCakeImage(imageKey) : ''
    const images = (imagesByProduct.get(row.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    const options = (optionsByProduct.get(row.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    const priceTiers = (tiersByProduct.get(row.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    const orderingModel = inferOrderingModel(row)
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      categoryId: row.category_id,
      pricingMode: row.pricing_mode,
      orderingModel,
      fixedPrice: row.fixed_price == null ? null : Number(row.fixed_price),
      priceNote: row.price_note ?? '',
      legacyCakeId: row.legacy_cake_id,
      qtyMin: row.qty_min ?? null,
      qtyMax: row.qty_max ?? null,
      qtyStep: row.qty_step ?? null,
      image: image || images[0]?.image || '',
      imageAlt: row.image_alt.trim() || row.name,
      imageKey,
      sortOrder: row.sort_order,
      enabled: row.enabled,
      images:
        images.length > 0
          ? images
          : imageKey
            ? [
                {
                  id: `${row.id}-img-1`,
                  productId: row.id,
                  imageKey,
                  image: resolveCakeImage(imageKey),
                  imageAlt: row.image_alt.trim() || row.name,
                  sortOrder: 0,
                },
              ]
            : [],
      options,
      priceTiers,
    }
  })
}

function mapOfferComponents(rows: OfferComponentRow[]): OfferComponent[] {
  return rows.map((row) => ({
    id: row.id,
    offerId: row.offer_id,
    productId: row.product_id,
    categoryId: row.category_id,
    quantity: row.quantity,
    roleLabel: row.role_label ?? '',
    componentPricing: row.component_pricing,
    discountPercent: row.discount_percent == null ? null : Number(row.discount_percent),
    discountAmount: row.discount_amount == null ? null : Number(row.discount_amount),
    customerPicks: row.customer_picks,
    sortOrder: row.sort_order,
  }))
}

function mapOffers(rows: OfferRow[], componentsByOffer: Map<string, OfferComponent[]>): Offer[] {
  return rows.map((row) => {
    const imageKey = row.image_key ?? ''
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      imageKey,
      image: imageKey ? resolveCakeImage(imageKey) : '',
      imageAlt: row.image_alt.trim() || row.name,
      badgeLabel: row.badge_label ?? '',
      pricingRule: row.pricing_rule,
      customBundlePrice: row.custom_bundle_price == null ? null : Number(row.custom_bundle_price),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      sortOrder: row.sort_order,
      enabled: row.enabled,
      components: (componentsByOffer.get(row.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    }
  })
}

/** Top-level local categories + cake categories nested under cat-cakes. */
function synthesizeProductCategories(cakeCategories: CakeCategoryInfo[], localTops: ProductCategory[]): ProductCategory[] {
  const tops = localTops.filter((category) => category.parentId === null)
  const cakeChildren: ProductCategory[] = cakeCategories.map((category, index) => ({
    id: category.id,
    parentId: 'cat-cakes',
    name: category.name,
    description: '',
    kind: 'standard',
    sortOrder: (index + 1) * 10,
    enabled: true,
  }))
  return [...tops, ...cakeChildren]
}

/** Products derived from cakes when the products table is unavailable. */
function synthesizeProductsFromCakes(cakes: Cake[]): Product[] {
  return cakes.map((cake, index) => ({
    id: cake.id,
    name: cake.name,
    description: cake.description,
    categoryId: cake.category,
    pricingMode: 'cake_sizes' as const,
    orderingModel: 'cake_servings' as const,
    fixedPrice: null,
    priceNote: cake.priceNote,
    legacyCakeId: cake.id,
    qtyMin: null,
    qtyMax: null,
    qtyStep: null,
    image: cake.image,
    imageAlt: cake.imageAlt,
    imageKey: '',
    sortOrder: (index + 1) * 10,
    enabled: true,
    images: [
      {
        id: `${cake.id}-img-1`,
        productId: cake.id,
        image: cake.image,
        imageKey: '',
        imageAlt: cake.imageAlt,
        sortOrder: 0,
      },
    ],
    options: [] as ProductOption[],
    priceTiers: [],
  }))
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  return map
}

type RemoteCatalogResult =
  | { ok: true; bundle: CatalogBundle }
  | { ok: false; error: string }

async function fetchRemoteCatalog(): Promise<RemoteCatalogResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'إعدادات الاتصال غير مكتملة.' }

  const [
    sizesRes,
    cakesRes,
    fillingsRes,
    extrasRes,
    zonesRes,
    categoriesRes,
    productCategoriesRes,
    productsRes,
    productImagesRes,
    productOptionsRes,
    productOptionValuesRes,
    offersRes,
    offerComponentsRes,
    priceTiersRes,
    optionDefsRes,
    optionDefValuesRes,
    optionLinksRes,
    optionOverridesRes,
    pricingSectionsRes,
    pricingItemsRes,
  ] = await Promise.all([
    supabase.from('cake_sizes').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('cakes').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('fillings').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('design_extras').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('delivery_zones').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('cake_categories').select('id, name').eq('enabled', true).order('sort_order'),
    supabase.from('product_categories').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('products').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('product_images').select('*').order('sort_order'),
    supabase.from('product_options').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('product_option_values').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('offers').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('offer_components').select('*').order('sort_order'),
    supabase.from('product_price_tiers').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('option_definitions').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('option_definition_values').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('product_option_links').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('product_option_link_value_overrides').select('*'),
    supabase.from('pricing_sections').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('pricing_items').select('*').eq('enabled', true).order('sort_order'),
  ])

  // Sizes are the source of truth for /pricing — fail closed if they do not load.
  if (sizesRes.error) {
    console.warn('Supabase cake_sizes load failed.', sizesRes.error.message)
    return { ok: false, error: 'تعذّر تحميل المقاسات والأسعار.' }
  }

  const sizes = mapSizes((sizesRes.data ?? []) as CakeSizeRow[])
  if (!sizes.length) {
    return { ok: false, error: 'لا توجد مقاسات مفعّلة للعرض.' }
  }

  if (
    cakesRes.error ||
    fillingsRes.error ||
    extrasRes.error ||
    zonesRes.error ||
    categoriesRes.error ||
    productCategoriesRes.error ||
    productsRes.error ||
    productImagesRes.error ||
    productOptionsRes.error ||
    productOptionValuesRes.error ||
    offersRes.error ||
    offerComponentsRes.error
  ) {
    console.warn('Supabase catalog partial load; keeping remote sizes.', {
      cakes: cakesRes.error?.message,
      fillings: fillingsRes.error?.message,
      extras: extrasRes.error?.message,
      zones: zonesRes.error?.message,
      categories: categoriesRes.error?.message,
      productCategories: productCategoriesRes.error?.message,
      products: productsRes.error?.message,
      productImages: productImagesRes.error?.message,
      productOptions: productOptionsRes.error?.message,
      productOptionValues: productOptionValuesRes.error?.message,
      offers: offersRes.error?.message,
      offerComponents: offerComponentsRes.error?.message,
    })
  }

  const local = createLocalCatalog()
  const categories = categoriesRes.error ? local.categories : ((categoriesRes.data ?? []) as CakeCategoryInfo[])
  const visibleCategoryIds = new Set(categories.map((category) => category.id))
  const remoteCakes = !cakesRes.error && (cakesRes.data?.length ?? 0) > 0 ? mapCakes((cakesRes.data ?? []) as CakeRow[]) : null
  const cakes = remoteCakes
    ? categoriesRes.error
      ? remoteCakes
      : remoteCakes.filter((cake) => visibleCategoryIds.has(cake.category))
    : local.cakes
  const fillings =
    !fillingsRes.error && (fillingsRes.data?.length ?? 0) > 0 ? mapFillings((fillingsRes.data ?? []) as FillingRow[]) : local.fillings
  const extras =
    !extrasRes.error && (extrasRes.data?.length ?? 0) > 0 ? mapExtras((extrasRes.data ?? []) as ExtraRow[]) : local.extras
  const zones = !zonesRes.error && (zonesRes.data?.length ?? 0) > 0 ? mapZones((zonesRes.data ?? []) as ZoneRow[]) : local.zones

  const remoteProductCategories =
    !productCategoriesRes.error && (productCategoriesRes.data?.length ?? 0) > 0
      ? mapProductCategories((productCategoriesRes.data ?? []) as ProductCategoryRow[])
      : null
  const productCategories =
    remoteProductCategories ??
    synthesizeProductCategories(
      categories,
      local.productCategories.filter((category) => category.parentId === null),
    )

  const valueRows = !productOptionValuesRes.error ? ((productOptionValuesRes.data ?? []) as ProductOptionValueRow[]) : []
  const optionRows = !productOptionsRes.error ? ((productOptionsRes.data ?? []) as ProductOptionRow[]) : []
  const imageRows = !productImagesRes.error ? ((productImagesRes.data ?? []) as ProductImageRow[]) : []
  const tierRows = !priceTiersRes.error ? ((priceTiersRes.data ?? []) as ProductPriceTierRow[]) : []
  const defRows = !optionDefsRes.error ? ((optionDefsRes.data ?? []) as OptionDefinitionRow[]) : []
  const defValueRows = !optionDefValuesRes.error
    ? ((optionDefValuesRes.data ?? []) as OptionDefinitionValueRow[])
    : []
  const linkRows = !optionLinksRes.error ? ((optionLinksRes.data ?? []) as ProductOptionLinkRow[]) : []
  const overrideRows = !optionOverridesRes.error
    ? ((optionOverridesRes.data ?? []) as ProductOptionLinkValueOverrideRow[])
    : []

  const valuesByOption = groupBy(mapOptionValues(valueRows), (value) => value.optionId)
  const mappedOptions = mapOptions(optionRows, valuesByOption)
  const optionsByProduct = groupBy(mappedOptions, (option) => option.productId)

  // Merge reusable library options linked to products
  const defValuesByDef = groupBy(
    defValueRows.map((row) => ({
      id: row.id,
      optionId: row.definition_id,
      name: row.name,
      priceAdjustment: Number(row.price_adjustment),
      sortOrder: row.sort_order,
      enabled: row.enabled,
    })),
    (v) => v.optionId,
  )
  const overridesByLink = groupBy(overrideRows, (o) => o.link_id)
  for (const link of linkRows) {
    const def = defRows.find((d) => d.id === link.definition_id)
    if (!def) continue
    const overrides = overridesByLink.get(link.id) ?? []
    const values = (defValuesByDef.get(def.id) ?? [])
      .filter((v) => {
        const ov = overrides.find((o) => o.definition_value_id === v.id)
        if (ov?.enabled === false) return false
        return v.enabled
      })
      .map((v) => {
        const ov = overrides.find((o) => o.definition_value_id === v.id)
        return {
          ...v,
          optionId: link.id,
          priceAdjustment: ov ? Number(ov.price_adjustment) : v.priceAdjustment,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const linked: ProductOption = {
      id: link.id,
      productId: link.product_id,
      definitionId: def.id,
      name: def.name,
      description: def.description ?? '',
      selectionType: def.selection_type,
      required: link.required,
      sortOrder: link.sort_order,
      enabled: link.enabled,
      values,
    }
    const list = optionsByProduct.get(link.product_id) ?? []
    list.push(linked)
    optionsByProduct.set(link.product_id, list)
  }

  const tiersByProduct = groupBy(mapPriceTiers(tierRows), (tier) => tier.productId)
  const imagesByProduct = groupBy(mapProductImages(imageRows), (image) => image.productId)

  const remoteProducts =
    !productsRes.error && (productsRes.data?.length ?? 0) > 0
      ? mapProducts((productsRes.data ?? []) as ProductRow[], imagesByProduct, optionsByProduct, tiersByProduct)
      : null
  const products = remoteProducts ?? synthesizeProductsFromCakes(cakes)

  const componentRows = !offerComponentsRes.error ? ((offerComponentsRes.data ?? []) as OfferComponentRow[]) : []
  const componentsByOffer = groupBy(mapOfferComponents(componentRows), (component) => component.offerId)
  const offers =
    !offersRes.error && (offersRes.data?.length ?? 0) > 0
      ? mapOffers((offersRes.data ?? []) as OfferRow[], componentsByOffer)
      : local.offers

  // Before supabase/pricing-content.sql is applied the tables are missing; derive the same default layout.
  const pricingSections =
    pricingSectionsRes.error || pricingItemsRes.error
      ? deriveDefaultPricingSections({ sizes, products, productCategories, notes: pricingNotes })
      : mapPricingSections(
          (pricingSectionsRes.data ?? []) as PricingSectionRow[],
          (pricingItemsRes.data ?? []) as PricingItemRow[],
        )

  return {
    ok: true,
    bundle: {
      cakes,
      categories,
      productCategories,
      products,
      offers,
      sizes,
      fillings,
      extras,
      zones,
      pricingSections,
      deliveryFee: local.deliveryFee,
      deliveryNote: local.deliveryNote,
    },
  }
}

export interface CatalogLoadResult {
  source: DataSource
  configured: boolean
  error?: string
}

/**
 * Hydrate the in-memory catalog.
 * When Supabase is configured, enabled cake_sizes from Supabase are required for pricing.
 */
export async function loadCatalog(): Promise<CatalogLoadResult> {
  const configured = isSupabaseConfigured()
  if (!configured) {
    setCatalog(createLocalCatalog(), 'local')
    return { source: 'local', configured: false }
  }

  const remote = await fetchRemoteCatalog()
  if (!remote.ok) {
    // Keep any previously loaded remote catalog when a refresh fails.
    if (getCatalogSource() !== 'supabase') {
      setCatalog(createLocalCatalog(), 'local')
    }
    return { source: getCatalogSource(), configured: true, error: remote.error }
  }

  setCatalog(remote.bundle, 'supabase')
  return { source: 'supabase', configured: true }
}

export function peekCatalog() {
  return getCatalog()
}
