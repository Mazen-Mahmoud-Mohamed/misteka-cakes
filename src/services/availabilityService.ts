import { STORAGE_KEYS } from '@/lib/constants'
import { getSupabase } from '@/lib/supabase'
import type { AvailabilityQuery, AvailabilityResult, Order } from '@/types'

const LOCAL_CLEAR = 'لم نجد تعارضًا ظاهرًا لهذا الموعد بعد. يبقى التأكيد بعد مراجعة الطلب.'
const LIVE_CLEAR = 'لا يظهر تعارض لهذا الموعد. يبقى الطلب قيد المراجعة حتى التأكيد.'
const CONFLICT = 'هذا الموعد متعارض مع حجز موجود. اختاري وقتًا آخر.'
const UNKNOWN = 'تعذّر التحقق من الموعد الآن، لذلك لا يمكن المتابعة.'

function readLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.orders)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Order[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function localConflict(query: AvailabilityQuery): boolean {
  return readLocalOrders().some(
    (order) =>
      order.date === query.date &&
      order.time === query.time &&
      order.status !== 'cancelled' &&
      order.status !== 'rejected',
  )
}

export async function checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
  const supabase = getSupabase()

  if (!supabase) {
    return localConflict(query)
      ? { status: 'conflict', source: 'local', message: CONFLICT }
      : { status: 'clear', source: 'local', message: LOCAL_CLEAR }
  }

  const { data, error } = await supabase.rpc('slot_is_taken', {
    slot_date: query.date,
    slot_time: query.time,
  })

  if (error || typeof data !== 'boolean') {
    return { status: 'unknown', source: 'supabase', message: UNKNOWN }
  }

  return data
    ? { status: 'conflict', source: 'supabase', message: CONFLICT }
    : { status: 'clear', source: 'supabase', message: LIVE_CLEAR }
}
