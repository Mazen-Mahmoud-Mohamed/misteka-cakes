import { getSupabase } from '@/lib/supabase'
import { CAKE_IMAGE_BUCKET, isStoredCakeImage } from '@/data/localCatalog'
import { generateId } from '@/services/admin/adminCatalogService'
import type {
  OfferComponentPricing,
  OfferPricingRule,
  ProductCategoryKind,
  ProductOptionSelection,
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
  fixed_price: number | null
  price_note: string
  legacy_cake_id: string | null
  image_key: string
  image_alt: string
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

export async function deleteAdminProduct(id: string) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { data: product } = await supabase.from('products').select('legacy_cake_id').eq('id', id).maybeSingle()
  if (product?.legacy_cake_id) {
    return { ok: false, message: 'منتجات التورت المرتبطة لا تُحذف من هنا. أخفيها أو أديريها من التورت.' }
  }
  const { error: qErr, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', id)
  if (qErr) {
    return {
      ok: false,
      message: qErr.code === '23503' ? 'لا يمكن حذف منتج مستخدم في عرض. أخفيه بدلًا من ذلك.' : 'تعذّر حذف المنتج.',
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

export async function deleteCatalogMedia(path: string) {
  if (!isStoredCakeImage(path) && !path.startsWith('products/') && !path.startsWith('offers/')) return
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.storage.from(CAKE_IMAGE_BUCKET).remove([path])
  if (error) console.warn('[admin] media cleanup failed:', error.message)
}

export { generateId }
