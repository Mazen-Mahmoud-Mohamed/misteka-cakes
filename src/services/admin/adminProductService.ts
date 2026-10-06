import { getSupabase } from '@/lib/supabase'
import { CAKE_IMAGE_BUCKET, isStoredCakeImage } from '@/data/localCatalog'
import { generateId } from '@/services/admin/adminCatalogService'
import type {
  OfferComponentPricing,
  OfferPricingRule,
  ProductCategoryKind,
  ProductOptionSelection,
  ProductOrderingModel,
  ProductPricingMode,
} from '@/types/products'

function fail<T>(message: string): { data: T | null; error: string } {
  return { data: null, error: message }
}

async function requireClient() {
  const supabase = getSupabase()
  if (!supabase) return { supabase: null, error: 'إعدادات الاتصال غير مكتملة.' as const }
  return { supabase, error: null as null }
}

export type AdminProductCategoryRow = {
  id: string
  parent_id: string | null
  name: string
  description: string
  kind: ProductCategoryKind
  sort_order: number
  enabled: boolean
}

export type AdminProductRow = {
  id: string
  name: string
  description: string
  category_id: string
  pricing_mode: ProductPricingMode
  ordering_model?: ProductOrderingModel
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

export type AdminProductPriceTierRow = {
  id: string
  product_id: string
  tier_kind: 'package' | 'quantity_range' | 'weight' | 'unit'
  label: string
  package_qty: number | null
  qty_min: number | null
  qty_max: number | null
  weight_grams: number | null
  price: number
  sort_order: number
  enabled: boolean
}

export type AdminOptionDefinitionRow = {
  id: string
  name: string
  description: string
  selection_type: ProductOptionSelection
  sort_order: number
  enabled: boolean
}

export type AdminOptionDefinitionValueRow = {
  id: string
  definition_id: string
  name: string
  price_adjustment: number
  sort_order: number
  enabled: boolean
}

export type AdminProductOptionLinkRow = {
  id: string
  product_id: string
  definition_id: string
  required: boolean
  sort_order: number
  enabled: boolean
}

export type AdminProductImageRow = {
  id: string
  product_id: string
  image_key: string
  image_alt: string
  sort_order: number
}

export type AdminProductOptionRow = {
  id: string
  product_id: string
  name: string
  description: string
  selection_type: ProductOptionSelection
  required: boolean
  sort_order: number
  enabled: boolean
}

export type AdminProductOptionValueRow = {
  id: string
  option_id: string
  name: string
  price_adjustment: number
  sort_order: number
  enabled: boolean
}

export type AdminOfferRow = {
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

export type AdminOfferComponentRow = {
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

export async function listAdminProductCategories() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductCategoryRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('product_categories')
    .select('id, parent_id, name, description, kind, sort_order, enabled')
    .order('sort_order')
  if (qErr) return fail<AdminProductCategoryRow[]>('تعذّر تحميل التصنيفات.')
  return { data: (data ?? []) as AdminProductCategoryRow[], error: null }
}

export async function upsertAdminProductCategory(row: AdminProductCategoryRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_categories').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ التصنيف.' }
  return { ok: true, message: 'تم حفظ التصنيف.' }
}

export async function deleteAdminProductCategory(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { count: childCount } = await supabase
    .from('product_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id)
  if (childCount && childCount > 0) {
    return { ok: false, message: 'لا يمكن حذف تصنيف يحتوي تصنيفات فرعية. انقليها أو أخفيه.' }
  }
  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if (productCount && productCount > 0) {
    return { ok: false, message: 'لا يمكن حذف تصنيف مرتبط بمنتجات. أخفيه بدلًا من ذلك.' }
  }
  const { error: qErr, count } = await supabase.from('product_categories').delete({ count: 'exact' }).eq('id', id)
  if (qErr) {
    return {
      ok: false,
      message: qErr.code === '23503' ? 'لا يمكن حذف تصنيف مستخدم. أخفيه بدلًا من ذلك.' : 'تعذّر حذف التصنيف.',
    }
  }
  if (!count) return { ok: false, message: 'تعذّر حذف التصنيف.' }
  return { ok: true, message: 'تم حذف التصنيف.' }
}

export async function listAdminCategoryProductCounts() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<Record<string, number>>(error!)
  const { data, error: qErr } = await supabase.from('products').select('category_id')
  if (qErr) return fail<Record<string, number>>('تعذّر تحميل أعداد المنتجات.')
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = (row as { category_id: string }).category_id
    counts[id] = (counts[id] ?? 0) + 1
  }
  return { data: counts, error: null }
}

export async function listAdminProducts() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductRow[]>(error!)
  const { data, error: qErr } = await supabase.from('products').select('*').order('sort_order')
  if (qErr) return fail<AdminProductRow[]>('تعذّر تحميل المنتجات.')
  return { data: (data ?? []) as AdminProductRow[], error: null }
}

export async function upsertAdminProduct(row: AdminProductRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('products').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: qErr.message.includes('cake_sizes') ? 'منتجات التورت تحتاج ربطًا بتورتة.' : 'تعذّر حفظ المنتج.' }
  return { ok: true, message: 'تم حفظ المنتج.' }
}

/** Per-cake configuration kept in public.cakes (read by the customer cake flow and place_order). */
export type AdminCakeConfig = {
  pricing_group: 'single' | 'two-tier'
  serving_info: string
  available_size_ids: string[]
  filling_ids: string[]
  extra_ids: string[]
  base_price: number | null
  image_position: string
}

export async function getAdminCakeConfig(cakeId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminCakeConfig>(error!)
  const { data, error: qErr } = await supabase
    .from('cakes')
    .select('pricing_group, serving_info, available_size_ids, filling_ids, extra_ids, base_price, image_position')
    .eq('id', cakeId)
    .maybeSingle()
  if (qErr) return fail<AdminCakeConfig>('تعذّر تحميل إعدادات التورتة.')
  if (!data) return { data: null, error: null }
  const row = data as AdminCakeConfig
  return {
    data: {
      ...row,
      available_size_ids: row.available_size_ids ?? [],
      filling_ids: row.filling_ids ?? [],
      extra_ids: row.extra_ids ?? [],
    },
    error: null,
  }
}

/**
 * Saves a cake product: public.cakes first (products.legacy_cake_id references it),
 * then the products row. Name, image, category and visibility are written to both.
 */
export async function upsertAdminCakeProduct(row: AdminProductRow, config: AdminCakeConfig) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const cakeId = row.legacy_cake_id || row.id
  const { error: cakeErr } = await supabase.from('cakes').upsert(
    {
      id: cakeId,
      name: row.name,
      description: row.description,
      image_key: row.image_key,
      image_alt: row.image_alt || row.name,
      image_position: config.image_position || 'center',
      category: row.category_id,
      pricing_group: config.pricing_group,
      base_price: config.base_price,
      price_note: row.price_note,
      serving_info: config.serving_info,
      available_size_ids: config.available_size_ids,
      filling_ids: config.filling_ids,
      extra_ids: config.extra_ids,
      sort_order: row.sort_order,
      enabled: row.enabled,
    },
    { onConflict: 'id' },
  )
  if (cakeErr) {
    return {
      ok: false,
      message: cakeErr.code === '23503' ? 'اختاري تصنيفًا فرعيًا تحت التورت.' : 'تعذّر حفظ إعدادات التورتة.',
    }
  }
  const { error: qErr } = await supabase
    .from('products')
    .upsert({ ...row, legacy_cake_id: cakeId, ordering_model: 'cake_servings', pricing_mode: 'cake_sizes' }, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ المنتج.' }
  return { ok: true, message: 'تم حفظ المنتج.' }
}

export const PRODUCT_HAS_HISTORY_MESSAGE = 'لا يمكن حذف منتج له طلبات سابقة. يمكنك إخفاؤه بدلًا من حذفه.'

/** Product ids referenced by any historical order (orders.product_id or order_items.product_id). */
export async function listAdminProductIdsWithOrders() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<Set<string>>(error!)
  const [ordersRes, itemsRes] = await Promise.all([
    supabase.from('orders').select('product_id').not('product_id', 'is', null),
    supabase.from('order_items').select('product_id').not('product_id', 'is', null),
  ])
  if (ordersRes.error || itemsRes.error) return fail<Set<string>>('تعذّر التحقق من الطلبات السابقة.')
  const ids = new Set<string>()
  for (const row of [...(ordersRes.data ?? []), ...(itemsRes.data ?? [])]) {
    const id = (row as { product_id: string | null }).product_id
    if (id) ids.add(id)
  }
  return { data: ids, error: null }
}

async function productHasOrderHistory(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  id: string,
): Promise<boolean | null> {
  const [ordersRes, itemsRes] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('product_id', id),
    supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
  ])
  if (ordersRes.error || itemsRes.error || ordersRes.count == null || itemsRes.count == null) return null
  return ordersRes.count > 0 || itemsRes.count > 0
}

export async function deleteAdminProduct(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('legacy_cake_id')
    .eq('id', id)
    .maybeSingle()
  if (productErr || !product) return { ok: false, message: 'تعذّر حذف المنتج.' }
  if (product.legacy_cake_id) {
    return { ok: false, message: 'التورت لا تُحذف حتى لا تتأثر الطلبات السابقة. أخفيها بدلًا من ذلك.' }
  }
  const hasHistory = await productHasOrderHistory(supabase, id)
  if (hasHistory === null) return { ok: false, message: 'تعذّر التحقق من الطلبات السابقة. لم يتم الحذف.' }
  if (hasHistory) return { ok: false, message: PRODUCT_HAS_HISTORY_MESSAGE }
  const { error: qErr, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', id)
  if (qErr) {
    return {
      ok: false,
      message: qErr.message.includes('product_has_order_history')
        ? PRODUCT_HAS_HISTORY_MESSAGE
        : qErr.code === '23503'
          ? 'لا يمكن حذف منتج مستخدم في عرض. أخفيه بدلًا من ذلك.'
          : 'تعذّر حذف المنتج.',
    }
  }
  if (!count) return { ok: false, message: 'تعذّر حذف المنتج.' }
  return { ok: true, message: 'تم حذف المنتج.' }
}

export async function listAdminProductImages(productId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductImageRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
  if (qErr) return fail<AdminProductImageRow[]>('تعذّر تحميل الصور.')
  return { data: (data ?? []) as AdminProductImageRow[], error: null }
}

export async function upsertAdminProductImage(row: AdminProductImageRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_images').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ الصورة.' }
  return { ok: true, message: 'تم حفظ الصورة.' }
}

export async function deleteAdminProductImage(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_images').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف الصورة.' }
  return { ok: true, message: 'تم حذف الصورة.' }
}

export async function listAdminProductOptions(productId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductOptionRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('product_options')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
  if (qErr) return fail<AdminProductOptionRow[]>('تعذّر تحميل الخيارات.')
  return { data: (data ?? []) as AdminProductOptionRow[], error: null }
}

export async function upsertAdminProductOption(row: AdminProductOptionRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_options').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ الخيار.' }
  return { ok: true, message: 'تم حفظ الخيار.' }
}

export async function deleteAdminProductOption(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_options').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف الخيار.' }
  return { ok: true, message: 'تم حذف الخيار.' }
}

export async function listAdminOptionValues(optionId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductOptionValueRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('product_option_values')
    .select('*')
    .eq('option_id', optionId)
    .order('sort_order')
  if (qErr) return fail<AdminProductOptionValueRow[]>('تعذّر تحميل قيم الخيار.')
  return { data: (data ?? []) as AdminProductOptionValueRow[], error: null }
}

export async function upsertAdminOptionValue(row: AdminProductOptionValueRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_option_values').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ قيمة الخيار.' }
  return { ok: true, message: 'تم حفظ قيمة الخيار.' }
}

export async function deleteAdminOptionValue(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_option_values').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف قيمة الخيار.' }
  return { ok: true, message: 'تم حذف قيمة الخيار.' }
}

export async function listAdminOffers() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminOfferRow[]>(error!)
  const { data, error: qErr } = await supabase.from('offers').select('*').order('sort_order')
  if (qErr) return fail<AdminOfferRow[]>('تعذّر تحميل العروض.')
  return { data: (data ?? []) as AdminOfferRow[], error: null }
}

export async function upsertAdminOffer(row: AdminOfferRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('offers').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ العرض.' }
  return { ok: true, message: 'تم حفظ العرض.' }
}

export async function deleteAdminOffer(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr, count } = await supabase.from('offers').delete({ count: 'exact' }).eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف العرض.' }
  if (!count) return { ok: false, message: 'تعذّر حذف العرض.' }
  return { ok: true, message: 'تم حذف العرض.' }
}

export async function listAdminOfferComponents(offerId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminOfferComponentRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('offer_components')
    .select('*')
    .eq('offer_id', offerId)
    .order('sort_order')
  if (qErr) return fail<AdminOfferComponentRow[]>('تعذّر تحميل مكوّنات العرض.')
  return { data: (data ?? []) as AdminOfferComponentRow[], error: null }
}

export async function upsertAdminOfferComponent(row: AdminOfferComponentRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('offer_components').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ مكوّن العرض.' }
  return { ok: true, message: 'تم حفظ مكوّن العرض.' }
}

export async function deleteAdminOfferComponent(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('offer_components').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف مكوّن العرض.' }
  return { ok: true, message: 'تم حذف مكوّن العرض.' }
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function randomSuffix(length = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Upload under products/ or offers/ in cake-images bucket. */
export async function uploadCatalogMedia(
  file: File,
  folder: 'products' | 'offers',
  onProgress: (percent: number) => void,
): Promise<{ path: string | null; error: string | null }> {
  if (!IMAGE_TYPES[file.type]) return { path: null, error: 'نوع الملف غير مدعوم. استخدمي صورة JPG أو PNG أو WEBP.' }
  if (file.size > 5 * 1024 * 1024) return { path: null, error: 'حجم الصورة أكبر من 5 ميجابايت.' }
  const supabase = getSupabase()
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabase || !url || !anonKey) return { path: null, error: 'إعدادات الاتصال غير مكتملة.' }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { path: null, error: 'انتهت الجلسة. سجّلي الدخول مرة أخرى.' }

  const path = `${folder}/${Date.now().toString(36)}-${randomSuffix()}.${IMAGE_TYPES[file.type]}`
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${url}/storage/v1/object/${CAKE_IMAGE_BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ path, error: null })
      else resolve({ path: null, error: 'تعذّر رفع الصورة. حاولي مرة أخرى.' })
    }
    xhr.onerror = () => resolve({ path: null, error: 'تعذّر رفع الصورة. تحققي من الاتصال.' })
    xhr.send(file)
  })
}

export async function listAdminProductPriceTiers(productId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductPriceTierRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('product_price_tiers')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
  if (qErr) return fail<AdminProductPriceTierRow[]>('تعذّر تحميل شرائح السعر.')
  return { data: (data ?? []) as AdminProductPriceTierRow[], error: null }
}

export async function upsertAdminProductPriceTier(row: AdminProductPriceTierRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_price_tiers').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ شريحة السعر.' }
  return { ok: true, message: 'تم حفظ شريحة السعر.' }
}

export async function deleteAdminProductPriceTier(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_price_tiers').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف شريحة السعر.' }
  return { ok: true, message: 'تم حذف شريحة السعر.' }
}

export async function listAdminOptionDefinitions() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminOptionDefinitionRow[]>(error!)
  const { data, error: qErr } = await supabase.from('option_definitions').select('*').order('sort_order')
  if (qErr) return fail<AdminOptionDefinitionRow[]>('تعذّر تحميل مكتبة الخيارات.')
  return { data: (data ?? []) as AdminOptionDefinitionRow[], error: null }
}

export async function upsertAdminOptionDefinition(row: AdminOptionDefinitionRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('option_definitions').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ الخيار.' }
  return { ok: true, message: 'تم حفظ الخيار.' }
}

export async function deleteAdminOptionDefinition(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('option_definitions').delete().eq('id', id)
  if (qErr) {
    return {
      ok: false,
      message: qErr.code === '23503' ? 'الخيار مرتبط بمنتجات. افصليه أولًا أو أخفيه.' : 'تعذّر حذف الخيار.',
    }
  }
  return { ok: true, message: 'تم حذف الخيار.' }
}

export async function listAdminOptionDefinitionValues(definitionId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminOptionDefinitionValueRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('option_definition_values')
    .select('*')
    .eq('definition_id', definitionId)
    .order('sort_order')
  if (qErr) return fail<AdminOptionDefinitionValueRow[]>('تعذّر تحميل قيم الخيار.')
  return { data: (data ?? []) as AdminOptionDefinitionValueRow[], error: null }
}

export async function upsertAdminOptionDefinitionValue(row: AdminOptionDefinitionValueRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('option_definition_values').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ قيمة الخيار.' }
  return { ok: true, message: 'تم حفظ قيمة الخيار.' }
}

export async function deleteAdminOptionDefinitionValue(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('option_definition_values').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر حذف قيمة الخيار.' }
  return { ok: true, message: 'تم حذف قيمة الخيار.' }
}

export async function listAdminProductOptionLinks(productId: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminProductOptionLinkRow[]>(error!)
  const { data, error: qErr } = await supabase
    .from('product_option_links')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
  if (qErr) return fail<AdminProductOptionLinkRow[]>('تعذّر تحميل روابط الخيارات.')
  return { data: (data ?? []) as AdminProductOptionLinkRow[], error: null }
}

export async function upsertAdminProductOptionLink(row: AdminProductOptionLinkRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_option_links').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر ربط الخيار بالمنتج.' }
  return { ok: true, message: 'تم ربط الخيار.' }
}

export async function deleteAdminProductOptionLink(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('product_option_links').delete().eq('id', id)
  if (qErr) return { ok: false, message: 'تعذّر فك ربط الخيار.' }
  return { ok: true, message: 'تم فك الربط.' }
}

export async function deleteCatalogMedia(path: string) {
  if (!isStoredCakeImage(path) && !path.startsWith('products/') && !path.startsWith('offers/')) return
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.storage.from(CAKE_IMAGE_BUCKET).remove([path])
  if (error) console.warn('[admin] media cleanup failed:', error.message)
}

export { generateId }
