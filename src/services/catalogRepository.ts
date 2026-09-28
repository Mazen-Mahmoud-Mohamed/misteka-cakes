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

async function fetchRemoteCatalog(): Promise<CatalogBundle | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const [sizesRes, cakesRes, fillingsRes, extrasRes, zonesRes] = await Promise.all([
    supabase.from('cake_sizes').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('cakes').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('fillings').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('design_extras').select('*').eq('enabled', true).order('sort_order'),
    supabase.from('delivery_zones').select('*').eq('enabled', true).order('sort_order'),
  ])

  if (sizesRes.error || cakesRes.error || fillingsRes.error || extrasRes.error || zonesRes.error) {
    console.warn('Supabase catalog load failed; using local catalog.', {
      sizes: sizesRes.error?.message,
      cakes: cakesRes.error?.message,
      fillings: fillingsRes.error?.message,
      extras: extrasRes.error?.message,
      zones: zonesRes.error?.message,
    })
    return null
  }

  const sizes = mapSizes((sizesRes.data ?? []) as CakeSizeRow[])
  const cakes = mapCakes((cakesRes.data ?? []) as CakeRow[])
  const fillings = mapFillings((fillingsRes.data ?? []) as FillingRow[])
  const extras = mapExtras((extrasRes.data ?? []) as ExtraRow[])
  const zones = mapZones((zonesRes.data ?? []) as ZoneRow[])

  // Incomplete remote catalog → keep local MVP data rather than a broken UI.
  if (!sizes.length || !cakes.length || !fillings.length || !zones.length) {
    return null
  }

  const local = createLocalCatalog()
  return {
    cakes,
    sizes,
    fillings,
    extras: extras.length ? extras : local.extras,
    zones,
    pricingNotes: local.pricingNotes,
    deliveryFee: local.deliveryFee,
    deliveryNote: local.deliveryNote,
  }
}

export interface CatalogLoadResult {
  source: DataSource
  configured: boolean
}

/**
 * Hydrate the in-memory catalog.
 * Local data is the default. Supabase replaces it only when a complete catalog loads.
 */
export async function loadCatalog(): Promise<CatalogLoadResult> {
  const configured = isSupabaseConfigured()
  if (!configured) {
    setCatalog(createLocalCatalog(), 'local')
    return { source: 'local', configured: false }
  }

  const remote = await fetchRemoteCatalog()
  if (!remote) {
    setCatalog(createLocalCatalog(), 'local')
    return { source: 'local', configured: true }
  }

  setCatalog(remote, 'supabase')
  return { source: getCatalogSource(), configured: true }
}

export function peekCatalog() {
  return getCatalog()
}
