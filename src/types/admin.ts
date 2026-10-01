import type { ChargeStatus, DesignMode, OrderExtraSelection, OrderStatus, PriceLine, ServiceType } from '@/types'

/** Server row as returned from public.orders (snake_case). */
export interface AdminOrderRow {
  id: string
  order_number: string
  customer_name: string
  phone: string
  area: string | null
  area_id: string | null
  address_notes: string
  service_type: ServiceType
  cake_id: string | null
  cake_name: string | null
  design_mode: DesignMode
  custom_design: boolean
  reference_image: string | null
  servings: number
  size: string
  size_id: string
  event_date: string
  event_time: string
  filling: string
  filling_id: string | null
  filling_price: number | null
  extras: unknown
  notes: string
  base_price: number | null
  extras_price: number | null
  delivery_price: number | null
  total_price: number | null
  pending_charges: unknown
  price_lines: unknown
  status: OrderStatus
  created_at: string
}

export interface AdminOrder {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  area: string | null
  areaId: string | null
  addressNotes: string
  serviceType: ServiceType
  cakeId: string | null
  cakeName: string | null
  designMode: DesignMode
  customDesign: boolean
  referenceImage: string | null
  servings: number
  size: string
  sizeId: string
  date: string
  time: string
  filling: string
  fillingId: string
  fillingPrice: number | null
  extras: OrderExtraSelection[]
  notes: string
  basePrice: number | null
  extrasPrice: number | null
  deliveryPrice: number | null
  totalPrice: number | null
  pendingCharges: string[]
  priceLines: PriceLine[]
  status: OrderStatus
  createdAt: string
}

export type AdminStatusFilter = 'all' | OrderStatus

export type AdminDateFilter = 'all' | 'today' | 'tomorrow' | 'week'

export interface AdminOrderQuery {
  status?: AdminStatusFilter
  date?: AdminDateFilter
  search?: string
  limit?: number
}

export interface AdminOrderStats {
  total: number
  pendingReview: number
  confirmed: number
  rejected: number
  cancelled: number
  today: number
}

export interface StatusUpdateResult {
  ok: boolean
  code?: string
  message: string
  status?: OrderStatus
}

function asExtras(value: unknown): OrderExtraSelection[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      price: row.price == null ? null : Number(row.price),
      priceStatus: (row.priceStatus as ChargeStatus) ?? 'pending',
    }
  })
}

function asPriceLines(value: unknown): PriceLine[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      label: String(row.label ?? ''),
      amount: row.amount == null ? null : Number(row.amount),
      status: (row.status as ChargeStatus) ?? 'pending',
      note: row.note == null ? undefined : String(row.note),
    }
  })
}

function asPending(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item))
}

export function mapAdminOrder(row: AdminOrderRow): AdminOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    phone: row.phone,
    area: row.area,
    areaId: row.area_id,
    addressNotes: row.address_notes ?? '',
    serviceType: row.service_type,
    cakeId: row.cake_id,
    cakeName: row.cake_name,
    designMode: row.design_mode,
    customDesign: row.custom_design,
    referenceImage: row.reference_image,
    servings: Number(row.servings),
    size: row.size,
    sizeId: row.size_id,
    date: String(row.event_date).slice(0, 10),
    time: row.event_time,
    filling: row.filling ?? '',
    fillingId: row.filling_id ?? '',
    fillingPrice: row.filling_price == null ? null : Number(row.filling_price),
    extras: asExtras(row.extras),
    notes: row.notes ?? '',
    basePrice: row.base_price == null ? null : Number(row.base_price),
    extrasPrice: row.extras_price == null ? null : Number(row.extras_price),
    deliveryPrice: row.delivery_price == null ? null : Number(row.delivery_price),
    totalPrice: row.total_price == null ? null : Number(row.total_price),
    pendingCharges: asPending(row.pending_charges),
    priceLines: asPriceLines(row.price_lines),
    status: row.status,
    createdAt: row.created_at,
  }
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_review: 'قيد المراجعة',
  confirmed: 'مؤكد',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
}
