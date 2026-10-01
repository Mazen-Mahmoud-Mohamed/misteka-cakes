import { getSupabase } from '@/lib/supabase'
import type { DesignMode, OrderStatus, ServiceType } from '@/types'
import { isOrderStatus } from '@/utils/orderStatus'
import { normalizeDigits } from '@/utils/phone'

export interface TrackedOrderSummary {
  orderNumber: string
  status: OrderStatus
  createdAt: string
  cakeName: string | null
  designMode: DesignMode
  size: string
  date: string
}

export interface TrackedOrderEvent {
  status: OrderStatus
  at: string
}

export interface TrackedOrder {
  orderNumber: string
  status: OrderStatus
  createdAt: string
  cakeName: string | null
  designMode: DesignMode
  size: string
  servings: number
  filling: string
  extras: string[]
  serviceType: ServiceType
  area: string | null
  date: string
  time: string
  totalPrice: number | null
  pendingCharges: string[]
  rejectionReason: string | null
  cancelledBy: 'customer' | 'admin' | null
  canCancel: boolean
  events: TrackedOrderEvent[]
}

type Failure = { ok: false; code: string; message: string }

const OFFLINE: Failure = { ok: false, code: 'offline', message: 'خدمة متابعة الطلبات غير متاحة حاليًا.' }
const NETWORK: Failure = { ok: false, code: 'network', message: 'تعذّر الاتصال. تأكدي من الإنترنت ثم أعيدي المحاولة.' }

/** Same normalization the order form applies before place_order; +20 prefixes are folded to 0. */
export function normalizeTrackingPhone(value: string): string {
  const digits = normalizeDigits(value)
  if (digits.startsWith('0020')) return `0${digits.slice(4)}`
  if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`
  return digits
}

function failure(data: unknown): Failure {
  const row = (data ?? {}) as { code?: string; message?: string }
  return { ok: false, code: row.code ?? 'error', message: row.message ?? 'حدث خطأ غير متوقع. أعيدي المحاولة.' }
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : []
}

function mapSummary(row: Record<string, unknown>): TrackedOrderSummary | null {
  if (!isOrderStatus(row.status)) return null
  return {
    orderNumber: str(row.orderNumber),
    status: row.status,
    createdAt: str(row.createdAt),
    cakeName: row.cakeName == null ? null : str(row.cakeName),
    designMode: (row.designMode as DesignMode) ?? 'custom',
    size: str(row.size),
    date: str(row.date).slice(0, 10),
  }
}

function mapOrder(row: Record<string, unknown>): TrackedOrder | null {
  if (!isOrderStatus(row.status)) return null
  const events = Array.isArray(row.events)
    ? (row.events as Array<Record<string, unknown>>)
        .filter((e) => isOrderStatus(e.status))
        .map((e) => ({ status: e.status as OrderStatus, at: str(e.at) }))
    : []
  return {
    orderNumber: str(row.orderNumber),
    status: row.status,
    createdAt: str(row.createdAt),
    cakeName: row.cakeName == null ? null : str(row.cakeName),
    designMode: (row.designMode as DesignMode) ?? 'custom',
    size: str(row.size),
    servings: Number(row.servings) || 0,
    filling: str(row.filling),
    extras: asStrings(row.extras),
    serviceType: row.serviceType === 'delivery' ? 'delivery' : 'pickup',
    area: row.area == null ? null : str(row.area),
    date: str(row.date).slice(0, 10),
    time: str(row.time),
    totalPrice: row.totalPrice == null ? null : Number(row.totalPrice),
    pendingCharges: asStrings(row.pendingCharges),
    rejectionReason: row.rejectionReason == null ? null : str(row.rejectionReason),
    cancelledBy: row.cancelledBy === 'customer' || row.cancelledBy === 'admin' ? row.cancelledBy : null,
    canCancel: row.canCancel === true,
    events,
  }
}

export async function lookupOrdersByPhone(
  phone: string,
): Promise<{ ok: true; orders: TrackedOrderSummary[] } | Failure> {
  const supabase = getSupabase()
  if (!supabase) return OFFLINE
  const { data, error } = await supabase.rpc('track_customer_orders', { p_phone: normalizeTrackingPhone(phone) })
  if (error) return NETWORK
  const result = data as { ok?: boolean; orders?: unknown }
  if (!result?.ok) return failure(data)
  const rows = Array.isArray(result.orders) ? (result.orders as Array<Record<string, unknown>>) : []
  return { ok: true, orders: rows.map(mapSummary).filter((o): o is TrackedOrderSummary => o !== null) }
}

export async function getTrackedOrder(
  phone: string,
  orderNumber: string,
): Promise<{ ok: true; order: TrackedOrder } | Failure> {
  const supabase = getSupabase()
  if (!supabase) return OFFLINE
  const { data, error } = await supabase.rpc('get_customer_order', {
    p_phone: normalizeTrackingPhone(phone),
    p_order_number: orderNumber,
  })
  if (error) return NETWORK
  const result = data as { ok?: boolean; order?: Record<string, unknown> }
  const order = result?.ok && result.order ? mapOrder(result.order) : null
  return order ? { ok: true, order } : failure(data)
}

export async function cancelTrackedOrder(phone: string, orderNumber: string): Promise<{ ok: true } | Failure> {
  const supabase = getSupabase()
  if (!supabase) return OFFLINE
  const { data, error } = await supabase.rpc('customer_cancel_order', {
    p_phone: normalizeTrackingPhone(phone),
    p_order_number: orderNumber,
  })
  if (error) return NETWORK
  return (data as { ok?: boolean })?.ok ? { ok: true } : failure(data)
}
