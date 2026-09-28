import { ORDER_REFERENCES_BUCKET, STORAGE_KEYS } from '@/lib/constants'
import { getSupabase } from '@/lib/supabase'
import { getCake, getDeliveryPolicy, getFilling, getSize, getZone, listExtras } from '@/services/catalogService'
import { formatArabicDate, formatTimeLabel } from '@/utils/dates'
import { calculateOrderTotal, knownExtrasTotal } from '@/services/pricingService'
import type { DataSource, Order, OrderDraft, OrderTotal } from '@/types'
import { normalizeDigits } from '@/utils/phone'

export interface SummaryView {
  customerName: string
  phone: string
  cakeName: string
  sizeLabel: string
  servingsLabel: string
  fillingName: string
  extraNames: string[]
  areaLabel: string
  serviceLabel: string
  dateLabel: string
  timeLabel: string
  notes: string
  addressNotes: string
  lines: OrderTotal['lines']
  estimatedTotal: number | null
  pendingCharges: string[]
}

export interface BuiltOrder {
  order: Order
  total: OrderTotal
}

export function toSummaryView(draft: OrderDraft): SummaryView {
  const total = quoteDraft(draft)
  const customSize = draft.sizeId === 'custom'
  const size = customSize ? null : getSize(draft.sizeId)
  const filling = getFilling(draft.fillingId)
  const cake = draft.cakeId ? getCake(draft.cakeId) : undefined
  const zone = draft.areaId ? getZone(draft.areaId) : undefined
  const extras = listExtras().filter((extra) => draft.extraIds.includes(extra.id))

  return {
    customerName: draft.customerName.trim(),
    phone: draft.phone.trim(),
    cakeName: draft.designMode === 'custom' ? 'تصميم مخصص' : (cake?.name ?? 'لم يُحدَّد'),
    sizeLabel: customSize ? 'مقاس حسب الطلب' : (size?.label ?? 'لم يُحدَّد'),
    servingsLabel: draft.servings ? `${draft.servings} فرد` : 'لم يُحدَّد',
    fillingName: filling?.name ?? 'لم يُحدَّد',
    extraNames: extras.map((extra) => extra.name),
    areaLabel: draft.serviceType === 'delivery' ? (zone?.name ?? 'لم تُحدَّد') : 'استلام',
    serviceLabel: draft.serviceType === 'delivery' ? 'توصيل' : draft.serviceType === 'pickup' ? 'استلام' : 'لم تُحدَّد',
    dateLabel: draft.date ? formatArabicDate(draft.date) : 'لم يُحدَّد',
    timeLabel: draft.time ? formatTimeLabel(draft.time) : 'لم يُحدَّد',
    notes: draft.designNotes.trim(),
    addressNotes: draft.addressNotes.trim(),
    lines: total.lines,
    estimatedTotal: total.estimatedTotal,
    pendingCharges: total.pendingCharges,
  }
}

export function quoteDraft(draft: OrderDraft): OrderTotal {
  const customSize = draft.sizeId === 'custom'
  const size = customSize ? null : getSize(draft.sizeId) ?? null
  const filling = getFilling(draft.fillingId) ?? null
  const extras = listExtras().filter((extra) => draft.extraIds.includes(extra.id))
  return calculateOrderTotal({
    size,
    customSize,
    filling,
    extras,
    serviceType: draft.serviceType,
  })
}

function createIds(): { id: string; orderNumber: string } {
  const id = crypto.randomUUID()
  const orderNumber = `MK-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  return { id, orderNumber }
}

export function buildOrder(
  draft: OrderDraft,
  availabilitySource: DataSource,
  referenceImageStatus: Order['referenceImageStatus'],
): BuiltOrder {
  const { id, orderNumber } = createIds()
  const total = quoteDraft(draft)
  const customSize = draft.sizeId === 'custom'
  const size = customSize ? null : getSize(draft.sizeId)
  const filling = getFilling(draft.fillingId)
  const extras = listExtras().filter((extra) => draft.extraIds.includes(extra.id))
  const cake = draft.cakeId ? getCake(draft.cakeId) : undefined
  const zone = draft.areaId ? getZone(draft.areaId) : undefined
  const knownExtras = knownExtrasTotal(extras)

  const order: Order = {
    id,
    orderNumber,
    customerName: draft.customerName.trim(),
    phone: normalizeDigits(draft.phone),
    area: draft.serviceType === 'delivery' ? (zone?.name ?? null) : null,
    areaId: draft.serviceType === 'delivery' ? (zone?.id ?? null) : null,
    addressNotes: draft.addressNotes.trim(),
    serviceType: draft.serviceType === 'pickup' ? 'pickup' : 'delivery',
    cakeId: draft.designMode === 'custom' ? null : cake?.id ?? null,
    cakeName: draft.designMode === 'custom' ? null : cake?.name ?? null,
    designMode: draft.designMode,
    customDesign: draft.designMode !== 'catalog',
    referenceImage: null,
    referenceImageStatus,
    servings: Number(draft.servings),
    size: customSize ? 'مقاس حسب الطلب' : (size?.label ?? ''),
    sizeId: draft.sizeId,
    date: draft.date,
    time: draft.time,
    filling: filling?.name ?? '',
    fillingId: filling?.id ?? '',
    fillingPrice: filling?.price ?? null,
    extras: extras.map((extra) => ({
      id: extra.id,
      name: extra.name,
      price: extra.price,
      priceStatus: extra.priceStatus,
    })),
    notes: draft.designNotes.trim(),
    basePrice: size?.price ?? null,
    extrasPrice: knownExtras,
    deliveryPrice: draft.serviceType === 'delivery' ? getDeliveryPolicy().fee : null,
    totalPrice: total.estimatedTotal,
    pendingCharges: total.pendingCharges,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    availabilitySource,
  }

  return { order, total }
}

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

function saveLocalOrder(order: Order) {
  const orders = readLocalOrders()
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify([order, ...orders]))
}

function toRow(order: Order) {
  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_name: order.customerName,
    phone: order.phone,
    area: order.area,
    address_notes: order.addressNotes,
    service_type: order.serviceType,
    cake_id: order.cakeId,
    design_mode: order.designMode,
    custom_design: order.customDesign,
    reference_image: order.referenceImage,
    servings: order.servings,
    size: order.size,
    event_date: order.date,
    event_time: order.time,
    filling: order.filling,
    extras: order.extras,
    notes: order.notes,
    base_price: order.basePrice,
    filling_price: order.fillingPrice,
    extras_price: order.extrasPrice,
    delivery_price: order.deliveryPrice,
    total_price: order.totalPrice,
    pending_charges: order.pendingCharges,
    status: order.status,
    created_at: order.createdAt,
  }
}

export interface SubmitResult {
  ok: boolean
  message: string
  order?: Order
  source?: DataSource
}

export async function submitOrder(order: Order, referenceFile: File | null): Promise<SubmitResult> {
  const supabase = getSupabase()
  const nextOrder: Order = { ...order }

  if (!supabase) {
    saveLocalOrder(nextOrder)
    return {
      ok: true,
      source: 'local',
      order: nextOrder,
      message: 'تم حفظ الملخص على هذا الجهاز فقط. الطلب لم يُرسل إلى مستيكا لأن حفظ الطلبات غير مربوط بعد، وهذا ليس تأكيدًا للموعد.',
    }
  }

  if (referenceFile) {
    const path = `${order.id}/${referenceFile.name}`
    const { error } = await supabase.storage.from(ORDER_REFERENCES_BUCKET).upload(path, referenceFile, {
      upsert: false,
    })
    if (error) {
      nextOrder.referenceImage = null
      nextOrder.referenceImageStatus = 'session-only'
    } else {
      nextOrder.referenceImage = path
      nextOrder.referenceImageStatus = 'stored'
    }
  }

  const { error } = await supabase.from('orders').insert(toRow(nextOrder))
  if (error) {
    return { ok: false, message: 'تعذّر حفظ الطلب. حاولي مرة أخرى.' }
  }

  const imageNote =
    referenceFile && nextOrder.referenceImageStatus !== 'stored'
      ? ' الصورة لم تُرفع، ويمكن إرسالها عند التواصل.'
      : ''

  return {
    ok: true,
    source: 'supabase',
    order: nextOrder,
    message: `وصل طلبك وهو قيد المراجعة. الموعد لا يُعد مؤكدًا إلا بعد المراجعة.${imageNote}`,
  }
}
