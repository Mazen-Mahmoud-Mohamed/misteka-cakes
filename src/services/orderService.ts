import { ORDER_REFERENCES_BUCKET, REFERENCE_IMAGE, STORAGE_KEYS } from '@/lib/constants'
import { getSupabase } from '@/lib/supabase'
import { getCake, getDeliveryPolicy, getFilling, getOffer, getProduct, getSize, getZone, listExtras } from '@/services/catalogService'
import { formatArabicDate, formatTimeLabel } from '@/utils/dates'
import { calculateOrderTotal, knownExtrasTotal } from '@/services/pricingService'
import type {
  ChargeStatus,
  DataSource,
  DesignMode,
  Order,
  OrderDraft,
  OrderExtraSelection,
  OrderTotal,
  PriceLine,
  ServiceType,
} from '@/types'
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
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const offer = draft.offerId ? getOffer(draft.offerId) : undefined
  const zone = draft.areaId ? getZone(draft.areaId) : undefined
  const extras = listExtras().filter((extra) => draft.extraIds.includes(extra.id))

  const cakeName = offer
    ? `عرض: ${offer.name}`
    : product && !cake
      ? product.name
      : draft.designMode === 'custom'
        ? 'تصميم مخصص'
        : (cake?.name ?? 'لم يُحدَّد')

  const optionNotes = product
    ? product.options
        .flatMap((opt) => opt.values.filter((v) => draft.optionValueIds.includes(v.id)).map((v) => `${opt.name}: ${v.name}`))
        .join('، ')
    : ''

  return {
    customerName: draft.customerName.trim(),
    phone: draft.phone.trim(),
    cakeName,
    sizeLabel: product && product.pricingMode !== 'cake_sizes'
      ? product.pricingMode === 'fixed'
        ? 'سعر ثابت'
        : 'يُحدَّد لاحقًا'
      : customSize
        ? 'مقاس حسب الطلب'
        : (size?.label ?? 'لم يُحدَّد'),
    servingsLabel: draft.servings ? `${draft.servings} فرد` : 'لم يُحدَّد',
    fillingName: filling?.name ?? 'لم يُحدَّد',
    extraNames: [
      ...extras.map((extra) => extra.name),
      ...(optionNotes ? [optionNotes] : []),
    ],
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
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const offer = draft.offerId ? getOffer(draft.offerId) : undefined
  const isConfiguredProduct = Boolean(product && product.orderingModel !== 'cake_servings' && product.pricingMode !== 'cake_sizes' && !draft.cakeId)

  const customSize = draft.sizeId === 'custom'
  const size = customSize ? null : getSize(draft.sizeId) ?? null
  const filling = isConfiguredProduct ? null : getFilling(draft.fillingId) ?? null
  const extras = isConfiguredProduct ? [] : listExtras().filter((extra) => draft.extraIds.includes(extra.id))
  const qty = Math.max(Number(draft.quantity) || 1, 1)
  const tier = product?.priceTiers.find((t) => t.id === draft.priceTierId)

  const optionLines =
    product?.options.flatMap((opt) =>
      opt.values
        .filter((v) => draft.optionValueIds.includes(v.id))
        .map((v) => ({
          id: v.id,
          label: `${opt.name}: ${v.name}`,
          amount:
            tier?.tierKind === 'package' || product.orderingModel === 'fixed_item' || product.orderingModel === 'weight'
              ? v.priceAdjustment
              : v.priceAdjustment * qty,
        })),
    ) ?? []

  let fixedProductBase: { label: string; amount: number | null; pending?: boolean } | null = null
  if (offer?.pricingRule === 'custom_bundle' && offer.customBundlePrice != null) {
    fixedProductBase = { label: `باقة: ${offer.name}`, amount: offer.customBundlePrice }
  } else if (isConfiguredProduct && product) {
    if (product.orderingModel === 'quote') {
      fixedProductBase = { label: product.name, amount: null, pending: true }
    } else if (tier) {
      const amount =
        tier.tierKind === 'package' || tier.tierKind === 'weight' ? tier.price : tier.price * qty
      fixedProductBase = { label: `${product.name}${tier.label ? ` — ${tier.label}` : ''}`, amount }
    } else if (product.orderingModel === 'fixed_item' && product.fixedPrice != null) {
      fixedProductBase = { label: product.name, amount: product.fixedPrice }
    } else if (product.fixedPrice != null) {
      fixedProductBase = { label: product.name, amount: product.fixedPrice * qty }
    } else {
      fixedProductBase = { label: product.name, amount: null, pending: true }
    }
  }

  return calculateOrderTotal({
    size: isConfiguredProduct || offer?.pricingRule === 'custom_bundle' ? null : size,
    customSize: isConfiguredProduct || offer?.pricingRule === 'custom_bundle' ? false : customSize,
    filling,
    extras,
    serviceType: draft.serviceType,
    optionLines,
    fixedProductBase,
  })
}

function createIds(): { id: string; orderNumber: string } {
  const id = crypto.randomUUID()
  const orderNumber = `MK-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  return { id, orderNumber }
}

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export function plannedReferencePath(orderId: string, file: File | null): string | null {
  if (!file) return null
  return `${orderId}/reference.${extensionFor(file)}`
}

export function buildOrder(
  draft: OrderDraft,
  availabilitySource: DataSource,
  referenceImageStatus: Order['referenceImageStatus'],
  referenceImagePath: string | null = null,
): BuiltOrder {
  const { id, orderNumber } = createIds()
  const total = quoteDraft(draft)
  const product = draft.productId ? getProduct(draft.productId) : undefined
  const offer = draft.offerId ? getOffer(draft.offerId) : undefined
  const orderKind: Order['orderKind'] = offer
    ? 'offer'
    : product && (product.pricingMode !== 'cake_sizes' || !draft.cakeId)
      ? 'product'
      : 'cake'

  // Prefer legacy cake path when ordering a cake-linked product via cakeId.
  const useProductPath = orderKind === 'product'
  const useOfferPath = orderKind === 'offer'
  const isNonCakeProduct = useProductPath

  const effectiveSizeId = isNonCakeProduct || (offer && !draft.sizeId) ? (draft.sizeId || 'custom') : draft.sizeId
  const customSize = effectiveSizeId === 'custom'
  const size = customSize ? null : getSize(effectiveSizeId)
  const filling = isNonCakeProduct || useOfferPath ? null : getFilling(draft.fillingId)
  const extras = isNonCakeProduct || useOfferPath ? [] : listExtras().filter((extra) => draft.extraIds.includes(extra.id))
  const cake = draft.cakeId ? getCake(draft.cakeId) : undefined
  const zone = draft.areaId ? getZone(draft.areaId) : undefined
  const knownExtras = knownExtrasTotal(extras)

  const offerSelections =
    offer?.components.map((component) => ({
      componentId: component.id,
      productId:
        draft.offerPicks[component.id] ||
        component.productId ||
        draft.productId ||
        draft.cakeId ||
        '',
      sizeId: draft.sizeId || undefined,
      optionValueIds: draft.optionValueIds,
    })) ?? []

  const order: Order = {
    id,
    orderNumber,
    customerName: draft.customerName.trim(),
    phone: normalizeDigits(draft.phone),
    area: draft.serviceType === 'delivery' ? (zone?.name ?? null) : null,
    areaId: draft.serviceType === 'delivery' ? (zone?.id ?? null) : null,
    addressNotes: draft.addressNotes.trim(),
    serviceType: draft.serviceType === 'pickup' ? 'pickup' : 'delivery',
    cakeId: useProductPath || useOfferPath || draft.designMode === 'custom' ? null : cake?.id ?? null,
    cakeName: useProductPath
      ? product?.name ?? null
      : useOfferPath
        ? offer?.name ?? null
        : draft.designMode === 'custom'
          ? null
          : cake?.name ?? null,
    designMode: useProductPath || useOfferPath ? 'catalog' : draft.designMode,
    customDesign: useProductPath || useOfferPath ? false : draft.designMode !== 'catalog',
    referenceImage: referenceImagePath,
    referenceImageStatus,
    servings: Number(draft.servings) || 1,
    size: customSize ? (useProductPath || useOfferPath ? 'منتج' : 'مقاس حسب الطلب') : (size?.label ?? ''),
    sizeId: effectiveSizeId,
    date: draft.date,
    time: draft.time,
    filling: filling?.name ?? (useProductPath || useOfferPath ? '—' : ''),
    fillingId: filling?.id ?? (useProductPath || useOfferPath ? 'none' : ''),
    fillingPrice: filling?.price ?? null,
    extras: extras.map((extra) => ({
      id: extra.id,
      name: extra.name,
      price: extra.price,
      priceStatus: extra.priceStatus,
    })),
    // Customer notes only — product/offer identity is sent as IDs, priced server-side.
    notes: draft.designNotes.trim(),
    // Local preview totals only; Supabase submit ignores these and recomputes.
    basePrice: size?.price ?? (product?.pricingMode === 'fixed' ? product.fixedPrice : null),
    extrasPrice: knownExtras,
    deliveryPrice: draft.serviceType === 'delivery' ? getDeliveryPolicy().fee : null,
    totalPrice: total.estimatedTotal,
    pendingCharges: total.pendingCharges,
    priceLines: total.lines,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    availabilitySource,
    orderKind,
    productId: useProductPath ? draft.productId || product?.id || null : null,
    offerId: useOfferPath ? draft.offerId || null : null,
    offerName: useOfferPath ? offer?.name ?? null : null,
    quantity: Number(draft.quantity) > 0 ? Number(draft.quantity) : 1,
    priceTierId: draft.priceTierId || null,
    optionValueIds: draft.optionValueIds ?? [],
    offerSelections: useOfferPath ? offerSelections : [],
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

export interface SubmitResult {
  ok: boolean
  message: string
  order?: Order
  source?: DataSource
  conflict?: boolean
}

interface PlaceOrderResponse {
  ok: boolean
  code?: string
  message?: string
  order?: Record<string, unknown>
}

function mapRpcOrder(raw: Record<string, unknown>, availabilitySource: DataSource, referenceStatus: Order['referenceImageStatus']): Order {
  const extrasRaw = Array.isArray(raw.extras) ? raw.extras : []
  const extras: OrderExtraSelection[] = extrasRaw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      price: row.price == null ? null : Number(row.price),
      priceStatus: (row.priceStatus as ChargeStatus) ?? 'pending',
    }
  })

  const linesRaw = Array.isArray(raw.priceLines) ? raw.priceLines : []
  const priceLines: PriceLine[] = linesRaw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      label: String(row.label ?? ''),
      amount: row.amount == null ? null : Number(row.amount),
      status: (row.status as ChargeStatus) ?? 'pending',
      note: row.note == null ? undefined : String(row.note),
    }
  })

  const pending = Array.isArray(raw.pendingCharges)
    ? raw.pendingCharges.map((item) => String(item))
    : []

  return {
    id: String(raw.id),
    orderNumber: String(raw.orderNumber),
    customerName: String(raw.customerName ?? ''),
    phone: String(raw.phone ?? ''),
    area: raw.area == null ? null : String(raw.area),
    areaId: raw.areaId == null ? null : String(raw.areaId),
    addressNotes: String(raw.addressNotes ?? ''),
    serviceType: raw.serviceType as ServiceType,
    cakeId: raw.cakeId == null ? null : String(raw.cakeId),
    cakeName: raw.cakeName == null ? null : String(raw.cakeName),
    designMode: raw.designMode as DesignMode,
    customDesign: Boolean(raw.customDesign),
    referenceImage: raw.referenceImage == null ? null : String(raw.referenceImage),
    referenceImageStatus: referenceStatus,
    servings: Number(raw.servings ?? 0),
    size: String(raw.size ?? ''),
    sizeId: String(raw.sizeId ?? ''),
    date: String(raw.date ?? ''),
    time: String(raw.time ?? ''),
    filling: String(raw.filling ?? ''),
    fillingId: String(raw.fillingId ?? ''),
    fillingPrice: raw.fillingPrice == null ? null : Number(raw.fillingPrice),
    extras,
    notes: String(raw.notes ?? ''),
    basePrice: raw.basePrice == null ? null : Number(raw.basePrice),
    extrasPrice: raw.extrasPrice == null ? null : Number(raw.extrasPrice),
    deliveryPrice: raw.deliveryPrice == null ? null : Number(raw.deliveryPrice),
    totalPrice: raw.totalPrice == null ? null : Number(raw.totalPrice),
    pendingCharges: pending,
    priceLines,
    status: 'pending_review',
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    availabilitySource,
    orderKind: (raw.orderKind as Order['orderKind']) ?? 'cake',
    productId: raw.productId == null ? null : String(raw.productId),
    offerId: raw.offerId == null ? null : String(raw.offerId),
    offerName: raw.offerName == null ? null : String(raw.offerName),
  }
}

function placeOrderPayload(order: Order, referencePath: string | null) {
  const kind = order.orderKind ?? 'cake'
  // IDs + customer fields only. Never send prices, discounts, or totals.
  const base = {
    id: order.id,
    order_kind: kind,
    customer_name: order.customerName,
    phone: order.phone,
    service_type: order.serviceType,
    area_id: order.areaId,
    address_notes: order.addressNotes,
    design_mode: order.designMode,
    servings: order.servings,
    event_date: order.date,
    event_time: order.time,
    notes: order.notes,
    reference_image: referencePath,
  }

  if (kind === 'product') {
    return {
      ...base,
      product_id: order.productId,
      quantity: order.quantity ?? 1,
      price_tier_id: order.priceTierId || null,
      option_value_ids: order.optionValueIds ?? [],
      size_id: order.sizeId || null,
    }
  }

  if (kind === 'offer') {
    return {
      ...base,
      offer_id: order.offerId,
      offer_selections: (order.offerSelections ?? []).map((sel) => ({
        component_id: sel.componentId,
        product_id: sel.productId,
        size_id: sel.sizeId || null,
        option_value_ids: sel.optionValueIds ?? [],
      })),
    }
  }

  return {
    ...base,
    cake_id: order.cakeId,
    size_id: order.sizeId,
    filling_id: order.fillingId,
    extra_ids: order.extras.map((extra) => extra.id),
  }
}

async function uploadReference(orderId: string, file: File, path: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  if (!REFERENCE_IMAGE.accept.some((type) => type === file.type)) return false
  if (file.size > REFERENCE_IMAGE.maxBytes) return false
  if (!orderId || path !== plannedReferencePath(orderId, file)) return false

  const { error } = await supabase.storage.from(ORDER_REFERENCES_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  return !error
}

async function clearReferencePath(orderId: string, expectedPath: string) {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.rpc('clear_order_reference_image', {
    order_id: orderId,
    expected_path: expectedPath,
  })
}

function messageForCode(code: string | undefined, fallback?: string): string {
  switch (code) {
    case 'order_conflict':
      return 'تعذّر حفظ الطلب. أعيدي المحاولة.'
    case 'invalid_service':
      return 'اختاري التوصيل أو الاستلام.'
    case 'invalid_design_mode':
      return 'نوع التصميم غير صالح.'
    case 'invalid_servings':
      return 'اكتبي عدد الأفراد بالأرقام.'
    case 'invalid_date':
      return 'اختاري تاريخ الاستلام.'
    case 'slot_taken':
      return 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.'
    case 'invalid_cake':
      return 'التصميم المختار غير متاح.'
    case 'invalid_size':
      return 'المقاس المختار غير متاح.'
    case 'invalid_filling':
      return 'الحشوة المختارة غير متاحة.'
    case 'invalid_extra':
      return 'إحدى إضافات التصميم غير متاحة.'
    case 'invalid_area':
      return 'اختاري منطقة التوصيل. التوصيل حاليًا داخل القاهرة والجيزة فقط.'
    case 'date_too_soon':
      return 'الحجز يجب أن يكون قبل موعد الاستلام بـ 3 أيام على الأقل.'
    case 'invalid_time':
      return 'اختاري وقتًا صالحًا.'
    case 'invalid_phone':
      return 'اكتبي رقم موبايل مصري صحيح.'
    case 'invalid_customer':
      return 'اكتبي الاسم بشكل صحيح.'
    case 'quote_only':
      return 'هذا المنتج يتطلب طلب سعر، وليس طلبًا مدفوعًا.'
    case 'invalid_product':
      return 'المنتج المختار غير متاح.'
    case 'invalid_product_price':
      return 'سعر المنتج غير مُعد.'
    case 'invalid_option':
      return 'خيار غير صالح.'
    case 'missing_required_option':
      return fallback || 'اختاري الخيارات المطلوبة.'
    case 'invalid_quantity':
      return 'الكمية غير صالحة.'
    case 'invalid_offer':
      return 'العرض غير متاح.'
    case 'offer_expired':
      return 'انتهت صلاحية العرض.'
    case 'offer_not_started':
      return 'العرض لم يبدأ بعد.'
    case 'missing_offer_selection':
      return 'اختاري منتجًا ضمن العرض.'
    case 'invalid_offer_selection':
      return 'اختيار العرض غير صالح.'
    case 'invalid_order_kind':
      return 'نوع الطلب غير صالح.'
    case 'invalid_reference':
      return 'تعذّر إرفاق الصورة المرجعية.'
    case 'invalid_notes':
      return 'الملاحظات أطول من المسموح.'
    default:
      return fallback || 'تعذّر حفظ الطلب. حاولي مرة أخرى.'
  }
}

/**
 * Persist an order.
 * Local mode trusts the client snapshot (browser-only).
 * Supabase mode sends selections only; place_order recomputes prices and validates FKs.
 */
export async function submitOrder(order: Order, referenceFile: File | null): Promise<SubmitResult> {
  const supabase = getSupabase()
  const plannedPath = plannedReferencePath(order.id, referenceFile)
  const localOrder: Order = {
    ...order,
    referenceImage: plannedPath,
    referenceImageStatus: referenceFile ? 'session-only' : 'none',
    priceLines: order.priceLines ?? [],
    status: 'pending_review',
  }

  if (!supabase) {
    saveLocalOrder(localOrder)
    return {
      ok: true,
      source: 'local',
      order: localOrder,
      message:
        'تم حفظ الملخص على هذا الجهاز فقط. الطلب لم يُرسل إلى مستكة لأن حفظ الطلبات غير مربوط بعد، وهذا ليس تأكيدًا للموعد. طلبك ليس مؤكدًا.',
    }
  }

  const { data, error } = await supabase.rpc('place_order', {
    payload: placeOrderPayload(order, plannedPath),
  })

  if (error) {
    return { ok: false, message: 'تعذّر حفظ الطلب. حاولي مرة أخرى.' }
  }

  const result = data as PlaceOrderResponse
  if (!result?.ok || !result.order) {
    const conflict = result?.code === 'slot_taken'
    return {
      ok: false,
      conflict,
      message: messageForCode(result?.code, result?.message),
    }
  }

  let referenceStatus: Order['referenceImageStatus'] = referenceFile ? 'session-only' : 'none'
  if (referenceFile && plannedPath) {
    const uploaded = await uploadReference(order.id, referenceFile, plannedPath)
    if (uploaded) {
      referenceStatus = 'stored'
    } else {
      await clearReferencePath(order.id, plannedPath)
      referenceStatus = 'session-only'
    }
  }

  const saved = mapRpcOrder(result.order, 'supabase', referenceStatus)
  saved.referenceImage = referenceStatus === 'stored' ? plannedPath : null

  const imageNote =
    referenceFile && referenceStatus !== 'stored'
      ? ' الصورة لم تُرفع، ويمكن إرسالها عند التواصل.'
      : ''

  return {
    ok: true,
    source: 'supabase',
    order: saved,
    message: `طلبك قيد المراجعة. الموعد لا يُعد مؤكدًا إلا بعد المراجعة.${imageNote}`,
  }
}

export type { PriceLine }
