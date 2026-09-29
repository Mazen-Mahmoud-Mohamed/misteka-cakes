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
  category: 'birthday' | 'celebration'
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

export async function upsertAdminCake(row: AdminCakeRow) {
  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false, message: error! }
  const payload = {
    ...row,
    available_size_ids: row.available_size_ids ?? [],
    filling_ids: row.filling_ids ?? [],
    extra_ids: row.extra_ids ?? [],
  }
  const { error: qErr } = await supabase.from('cakes').upsert(payload, { onConflict: 'id' })
  if (qErr) return { ok: false, message: 'تعذّر حفظ التورتة.' }
  return { ok: true, message: 'تم حفظ التورتة.' }
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
