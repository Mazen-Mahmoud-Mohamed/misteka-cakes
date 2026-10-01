import type { OrderStatus, ServiceType } from '@/types'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_review: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  preparing: 'جاري التجهيز',
  in_production: 'جاري التصنيع',
  ready: 'جاهز',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
}

export const ORDER_STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[]

export const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'rejected', 'cancelled']

/** Main lifecycle; pickup orders skip «خرج للتوصيل». Mirrors supabase/order-tracking.sql. */
export function lifecycleFor(serviceType: ServiceType): OrderStatus[] {
  const flow: OrderStatus[] = ['pending_review', 'confirmed', 'preparing', 'in_production', 'ready', 'out_for_delivery', 'delivered']
  return serviceType === 'delivery' ? flow : flow.filter((s) => s !== 'out_for_delivery')
}

/** Admin transitions allowed by admin_update_order_status(). */
export function nextAdminStatuses(status: OrderStatus, serviceType: ServiceType): OrderStatus[] {
  switch (status) {
    case 'pending_review':
      return ['confirmed', 'rejected', 'cancelled']
    case 'confirmed':
      return ['preparing', 'cancelled']
    case 'preparing':
      return ['in_production', 'cancelled']
    case 'in_production':
      return ['ready']
    case 'ready':
      return serviceType === 'delivery' ? ['out_for_delivery'] : ['delivered']
    case 'out_for_delivery':
      return ['delivered']
    default:
      return []
  }
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && value in STATUS_LABELS
}
