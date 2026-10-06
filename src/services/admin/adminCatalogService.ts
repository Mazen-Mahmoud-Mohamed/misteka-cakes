import { CAKE_IMAGE_BUCKET, isStoredCakeImage } from '@/data/localCatalog'
import { getSupabase } from '@/lib/supabase'
import type { ChargeStatus, PricingGroup } from '@/types'

export type AdminCakeSizeRow = {
  id: string
  pricing_group: PricingGroup
  label: string
  servings_label: string
  servings_min: number | null
  servings_max: number | null
  price: number
  sort_order: number
  enabled: boolean
}

export type AdminCakeRow = {
  id: string
  name: string
  description: string
  image_key: string
  image_alt: string
  image_position: string
  category: string
  pricing_group: PricingGroup
  base_price: number | null
  price_note: string
  serving_info: string
  available_size_ids: string[] | null
  filling_ids: string[] | null
  extra_ids: string[] | null
  sort_order: number
  enabled: boolean
}

export type AdminFillingRow = {
  id: string
  name: string
  description: string
  price: number | null
  price_status: ChargeStatus
  sort_order: number
  enabled: boolean
}

export type AdminExtraRow = {
  id: string
  name: string
  description: string
  price: number | null
  price_status: ChargeStatus
  sort_order: number
  enabled: boolean
}

export type AdminZoneRow = {
  id: string
  name: string
  enabled: boolean
  sort_order: number
}

function fail<T>(message: string): { data: T | null; error: string } {
  return { data: null, error: message }
}

async function requireClient() {
  const supabase = getSupabase()
  if (!supabase) return { supabase: null, error: 'إعدادات الاتصال غير مكتملة.' as const }
  return { supabase, error: null as null }
}

export async function listAdminSizes() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminCakeSizeRow[]>(error!)
  const { data, error: qErr } = await supabase.from('cake_sizes').select('*').order('sort_order')
  if (qErr) return fail<AdminCakeSizeRow[]>('تعذّر تحميل المقاسات.')
  return { data: (data ?? []) as AdminCakeSizeRow[], error: null }
}

export async function upsertAdminSize(row: AdminCakeSizeRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('cake_sizes').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ المقاس.' }
  return { ok: true, message: 'تم حفظ المقاس.' }
}

export async function listAdminCakes() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminCakeRow[]>(error!)
  const { data, error: qErr } = await supabase.from('cakes').select('*').order('sort_order')
  if (qErr) return fail<AdminCakeRow[]>('تعذّر تحميل التورت.')
  return { data: (data ?? []) as AdminCakeRow[], error: null }
}

export async function listAdminFillings() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminFillingRow[]>(error!)
  const { data, error: qErr } = await supabase.from('fillings').select('*').order('sort_order')
  if (qErr) return fail<AdminFillingRow[]>('تعذّر تحميل الحشوات.')
  return { data: (data ?? []) as AdminFillingRow[], error: null }
}

export async function upsertAdminFilling(row: AdminFillingRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('fillings').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ الحشوة.' }
  return { ok: true, message: 'تم حفظ الحشوة.' }
}

export async function listAdminExtras() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminExtraRow[]>(error!)
  const { data, error: qErr } = await supabase.from('design_extras').select('*').order('sort_order')
  if (qErr) return fail<AdminExtraRow[]>('تعذّر تحميل الإضافات.')
  return { data: (data ?? []) as AdminExtraRow[], error: null }
}

export async function upsertAdminExtra(row: AdminExtraRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('design_extras').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ الإضافة.' }
  return { ok: true, message: 'تم حفظ الإضافة.' }
}

export async function listAdminZones() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<AdminZoneRow[]>(error!)
  const { data, error: qErr } = await supabase.from('delivery_zones').select('*').order('sort_order')
  if (qErr) return fail<AdminZoneRow[]>('تعذّر تحميل مناطق التوصيل.')
  return { data: (data ?? []) as AdminZoneRow[], error: null }
}

export async function upsertAdminZone(row: AdminZoneRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const { error: qErr } = await supabase.from('delivery_zones').upsert(row, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ المنطقة.' }
  return { ok: true, message: 'تم حفظ المنطقة.' }
}

export function slugifyId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_ء-ي]/g, '')
    .slice(0, 48)
}

function randomSuffix(length = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Readable, URL-safe id derived from the name, unique within `taken`. */
export function generateId(name: string, prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  const base = ascii || prefix
  if (ascii && !used.has(base)) return base
  let id = `${base}-${randomSuffix()}`
  while (used.has(id)) id = `${base}-${randomSuffix()}`
  return id
}

export const CAKE_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
export const CAKE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export function validateCakeImage(file: File): string | null {
  if (!CAKE_IMAGE_TYPES[file.type]) return 'نوع الملف غير مدعوم. استخدمي صورة JPG أو PNG أو WEBP.'
  if (file.size > CAKE_IMAGE_MAX_BYTES) return 'حجم الصورة أكبر من 5 ميجابايت.'
  return null
}

/** Uploads to the cake-images bucket as the signed-in admin; resolves with the stored path. */
export async function uploadCakeImage(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ path: string | null; error: string | null }> {
  const invalid = validateCakeImage(file)
  if (invalid) return { path: null, error: invalid }
  const supabase = getSupabase()
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabase || !url || !anonKey) return { path: null, error: 'إعدادات الاتصال غير مكتملة.' }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { path: null, error: 'انتهت الجلسة. سجّلي الدخول مرة أخرى.' }

  const path = `cakes/${Date.now().toString(36)}-${randomSuffix(8)}.${CAKE_IMAGE_TYPES[file.type]}`
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

export async function deleteCakeImage(path: string) {
  if (!isStoredCakeImage(path)) return
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.storage.from(CAKE_IMAGE_BUCKET).remove([path])
  if (error) console.warn('[admin] cake image cleanup failed:', error.message)
}
