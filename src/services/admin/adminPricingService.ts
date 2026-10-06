import { getSupabase } from '@/lib/supabase'
import type { PricingItemKind, PricingSectionWidth } from '@/types/pricing'

export type AdminPricingSectionRow = {
  id: string
  title: string
  description: string
  width: PricingSectionWidth
  sort_order: number
  enabled: boolean
}

export type AdminPricingItemRow = {
  id: string
  section_id: string
  item_kind: PricingItemKind
  label: string
  sublabel: string
  price: number | null
  unit: string
  note: string
  cake_size_id: string | null
  product_id: string | null
  price_tier_id: string | null
  sort_order: number
  enabled: boolean
}

type Result<T> = { data: T | null; error: string | null; missing?: boolean }

const MISSING_TABLE = /pricing_(sections|items)|PGRST205|42P01/

function requireClient() {
  return getSupabase()
}

export async function listAdminPricingContent(): Promise<
  Result<{ sections: AdminPricingSectionRow[]; items: AdminPricingItemRow[] }>
> {
  const supabase = requireClient()
  if (!supabase) return { data: null, error: 'إعدادات الاتصال غير مكتملة.' }
  const [sectionsRes, itemsRes] = await Promise.all([
    supabase.from('pricing_sections').select('*').order('sort_order'),
    supabase.from('pricing_items').select('*').order('sort_order'),
  ])
  const err = sectionsRes.error ?? itemsRes.error
  if (err) {
    const missing = MISSING_TABLE.test(`${err.code ?? ''} ${err.message}`)
    return {
      data: null,
      missing,
      error: missing ? 'جداول صفحة الأسعار غير مُفعّلة بعد في قاعدة البيانات.' : 'تعذّر تحميل محتوى الأسعار.',
    }
  }
  return {
    data: {
      sections: (sectionsRes.data ?? []) as AdminPricingSectionRow[],
      items: ((itemsRes.data ?? []) as AdminPricingItemRow[]).map((row) => ({
        ...row,
        price: row.price == null ? null : Number(row.price),
      })),
    },
    error: null,
  }
}

export async function upsertAdminPricingSection(row: AdminPricingSectionRow) {
  const supabase = requireClient()
  if (!supabase) return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }
  const { error } = await supabase.from('pricing_sections').upsert(row, { onConflict: 'id' })
  if (error) return { ok: false, message: 'تعذّر حفظ القسم.' }
  return { ok: true, message: 'تم حفظ القسم.' }
}

export async function deleteAdminPricingSection(id: string) {
  const supabase = requireClient()
  if (!supabase) return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }
  const { error, count } = await supabase.from('pricing_sections').delete({ count: 'exact' }).eq('id', id)
  if (error || !count) return { ok: false, message: 'تعذّر حذف القسم.' }
  return { ok: true, message: 'تم حذف القسم.' }
}

export async function upsertAdminPricingItem(row: AdminPricingItemRow) {
  const supabase = requireClient()
  if (!supabase) return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }
  const { error } = await supabase.from('pricing_items').upsert(row, { onConflict: 'id' })
  if (error) return { ok: false, message: 'تعذّر حفظ البند.' }
  return { ok: true, message: 'تم حفظ البند.' }
}

export async function deleteAdminPricingItem(id: string) {
  const supabase = requireClient()
  if (!supabase) return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }
  const { error, count } = await supabase.from('pricing_items').delete({ count: 'exact' }).eq('id', id)
  if (error || !count) return { ok: false, message: 'تعذّر حذف البند.' }
  return { ok: true, message: 'تم حذف البند.' }
}

/** Swaps sort_order between two rows of the same table (used for move up / move down). */
export async function swapAdminPricingOrder(
  table: 'pricing_sections' | 'pricing_items',
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number },
) {
  const supabase = requireClient()
  if (!supabase) return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }
  const aOrder = a.sort_order === b.sort_order ? b.sort_order + 1 : b.sort_order
  const [r1, r2] = await Promise.all([
    supabase.from(table).update({ sort_order: aOrder }).eq('id', a.id),
    supabase.from(table).update({ sort_order: a.sort_order }).eq('id', b.id),
  ])
  if (r1.error || r2.error) return { ok: false, message: 'تعذّر تغيير الترتيب.' }
  return { ok: true, message: 'تم تغيير الترتيب.' }
}

export async function listAllAdminPriceTiers() {
  const supabase = requireClient()
  if (!supabase) return { data: null, error: 'إعدادات الاتصال غير مكتملة.' }
  const { data, error } = await supabase
    .from('product_price_tiers')
    .select('id, product_id, tier_kind, label, price, enabled, sort_order')
    .order('sort_order')
  if (error) return { data: null, error: 'تعذّر تحميل أسعار المنتجات.' }
  return {
    data: (data ?? []) as Array<{
      id: string
      product_id: string
      tier_kind: string
      label: string
      price: number
      enabled: boolean
      sort_order: number
    }>,
    error: null,
  }
}
