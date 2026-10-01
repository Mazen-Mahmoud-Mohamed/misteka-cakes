import { getSupabase } from '@/lib/supabase'
import {
  mapAdminOrder,
  type AdminDateFilter,
  type AdminOrder,
  type AdminOrderQuery,
  type AdminOrderRow,
  type AdminOrderStats,
  type AdminStatusFilter,
  type StatusUpdateResult,
} from '@/types/admin'
import type { OrderStatus } from '@/types'

function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function startOfCairoWeek(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  // JS: 0=Sun … use Saturday as week start for Egypt-friendly week (optional). Monday start:
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

function applyDateFilter<T extends {
  eq: (column: string, value: string) => T
  gte: (column: string, value: string) => T
  lte: (column: string, value: string) => T
}>(query: T, filter: AdminDateFilter | undefined): T {
  if (!filter || filter === 'all') return query
  const today = cairoToday()
  if (filter === 'today') return query.eq('event_date', today)
  if (filter === 'tomorrow') return query.eq('event_date', addDaysIso(today, 1))
  if (filter === 'week') {
    const start = startOfCairoWeek(today)
    const end = addDaysIso(start, 6)
    return query.gte('event_date', start).lte('event_date', end)
  }
  return query
}

export async function listAdminOrders(options: AdminOrderQuery = {}): Promise<{
  orders: AdminOrder[]
  error: string | null
}> {
  const supabase = getSupabase()
  if (!supabase) return { orders: [], error: 'إعدادات الاتصال غير مكتملة.' }

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false })

  const status: AdminStatusFilter = options.status ?? 'all'
  if (status !== 'all') query = query.eq('status', status)

  query = applyDateFilter(query, options.date)

  const search = options.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or(
      `order_number.ilike.${pattern},customer_name.ilike.${pattern},phone.ilike.${pattern},id.ilike.${pattern}`,
    )
  }

  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) {
    return { orders: [], error: 'حدث خطأ أثناء تحميل الطلبات.' }
  }

  return {
    orders: ((data ?? []) as AdminOrderRow[]).map(mapAdminOrder),
    error: null,
  }
}

export async function getAdminOrder(id: string): Promise<{ order: AdminOrder | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { order: null, error: 'إعدادات الاتصال غير مكتملة.' }

  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
  if (error) return { order: null, error: 'حدث خطأ أثناء تحميل الطلب.' }
  if (!data) return { order: null, error: 'الطلب غير موجود.' }
  return { order: mapAdminOrder(data as AdminOrderRow), error: null }
}

export async function getAdminOrderStats(): Promise<{ stats: AdminOrderStats | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { stats: null, error: 'إعدادات الاتصال غير مكتملة.' }

  const { data, error } = await supabase.from('orders').select('status, event_date')
  if (error) return { stats: null, error: 'حدث خطأ أثناء تحميل الإحصاءات.' }

  const today = cairoToday()
  const rows = (data ?? []) as Array<{ status: OrderStatus; event_date: string }>
  const stats: AdminOrderStats = {
    total: rows.length,
    pendingReview: rows.filter((r) => r.status === 'pending_review').length,
    confirmed: rows.filter((r) => r.status === 'confirmed').length,
    inProgress: rows.filter((r) => ['preparing', 'in_production', 'ready', 'out_for_delivery'].includes(r.status)).length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    today: rows.filter((r) => String(r.event_date).slice(0, 10) === today).length,
  }
  return { stats, error: null }
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string,
): Promise<StatusUpdateResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: 'إعدادات الاتصال غير مكتملة.' }

  const { data, error } = await supabase.rpc('admin_update_order_status', {
    order_id: orderId,
    new_status: newStatus,
    reason: newStatus === 'rejected' ? (reason ?? '').trim() : null,
  })

  if (error) return { ok: false, message: 'تعذّر تحديث حالة الطلب.' }

  const result = data as { ok?: boolean; code?: string; message?: string; order?: { status?: OrderStatus } }
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code,
      message: result?.message || 'تعذّر تحديث حالة الطلب.',
    }
  }
  return {
    ok: true,
    message: 'تم تحديث حالة الطلب.',
    status: result.order?.status,
  }
}

/** Create a short-lived signed URL for a private reference object. Never public. */
export async function getReferenceSignedUrl(path: string): Promise<{ url: string | null; error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { url: null, error: 'إعدادات الاتصال غير مكتملة.' }
  if (!path) return { url: null, error: null }

  const { data, error } = await supabase.storage.from('order-references').createSignedUrl(path, 120)
  if (error || !data?.signedUrl) {
    return { url: null, error: 'تعذّر عرض الصورة المرجعية.' }
  }
  return { url: data.signedUrl, error: null }
}
