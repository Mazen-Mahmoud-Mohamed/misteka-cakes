import { createLocalCatalog, resolveCakeImage, type CatalogBundle } from '@/data/localCatalog'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCatalog, getCatalogSource, setCatalog } from '@/services/catalogStore'
import type { Cake, CakeSize, ChargeStatus, DataSource, DeliveryZone, DesignExtra, Filling, PricingGroup } from '@/types'

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
    imageAlt: row.image_alt,
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

type RemoteCatalogResult =
  | { ok: true; bundle: CatalogBundle }
  | { ok: false; error: string }

async function fetchRemoteCatalog(): Promise<RemoteCatalogResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'إعدادات الاتصال غير مكتملة.' }

  const [sizesRes, cakesRes, fillingsRes, extrasRes, zonesRes] = await Promise.all([
    supabase.from('cake_sizes').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('cakes').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('fillings').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('design_extras').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('delivery_zones').select('*').eq('enabled', true).order('sort_order'),
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

  if (cakesRes.error || fillingsRes.error || extrasRes.error || zonesRes.error) {
    console.warn('Supabase catalog partial load; keeping remote sizes.', {
      cakes: cakesRes.error?.message,
      fillings: fillingsRes.error?.message,
      extras: extrasRes.error?.message,
      zones: zonesRes.error?.message,
    })
  }

  const local = createLocalCatalog()
  const cakes = !cakesRes.error && (cakesRes.data?.length ?? 0) > 0 ? mapCakes((cakesRes.data ?? []) as CakeRow[]) : local.cakes
  const fillings =
    !fillingsRes.error && (fillingsRes.data?.length ?? 0) > 0 ? mapFillings((fillingsRes.data ?? []) as FillingRow[]) : local.fillings
  const extras =
    !extrasRes.error && (extrasRes.data?.length ?? 0) > 0 ? mapExtras((extrasRes.data ?? []) as ExtraRow[]) : local.extras
  const zones = !zonesRes.error && (zonesRes.data?.length ?? 0) > 0 ? mapZones((zonesRes.data ?? []) as ZoneRow[]) : local.zones

  return {
    ok: true,
    bundle: {
      cakes,
      sizes,
      fillings,
      extras,
      zones,
      pricingNotes: local.pricingNotes,
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
