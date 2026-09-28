export type CakeCategory = 'birthday' | 'celebration'

export type PricingGroup = 'single' | 'two-tier'

export type ChargeStatus = 'known' | 'pending' | 'quote' | 'outside'

export type ServiceType = 'delivery' | 'pickup'

export type DesignMode = 'catalog' | 'similar' | 'custom'

export type OrderStatus = 'pending_review' | 'confirmed' | 'cancelled' | 'rejected'

export type DataSource = 'local' | 'supabase'

export interface CakeSize {
  id: string
  group: PricingGroup
  label: string
  servingsLabel: string
  servingsMin: number | null
  servingsMax: number | null
  price: number
}

export interface Cake {
  id: string
  name: string
  description: string
  image: string
  imageAlt: string
  imagePosition: string
  category: CakeCategory
  pricingGroup: PricingGroup
  basePrice: number | null
  priceNote: string
  servingInfo: string
  availableSizeIds: string[]
  fillingIds: string[]
  extraIds: string[]
}

export interface Filling {
  id: string
  name: string
  description: string
  price: number | null
  priceStatus: ChargeStatus
}

export interface DesignExtra {
  id: string
  name: string
  description: string
  price: number | null
  priceStatus: ChargeStatus
}

export interface DeliveryZone {
  id: string
  name: string
  enabled: boolean
}

export interface OrderDraft {
  serviceType: '' | ServiceType
  areaId: string
  addressNotes: string
  servings: string
  date: string
  time: string
  designMode: DesignMode
  cakeId: string
  structure: PricingGroup
  sizeId: string
  designNotes: string
  fillingId: string
  extraIds: string[]
  customerName: string
  phone: string
}

export interface OrderExtraSelection {
  id: string
  name: string
  price: number | null
  priceStatus: ChargeStatus
}

export interface Order {
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
  referenceImageStatus: 'none' | 'session-only' | 'stored'
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
  availabilitySource: DataSource
}

export interface PriceLine {
  id: string
  label: string
  amount: number | null
  status: ChargeStatus
  note?: string
}

export interface OrderTotal {
  lines: PriceLine[]
  estimatedTotal: number | null
  pendingCharges: string[]
}

export interface AvailabilityQuery {
  date: string
  time: string
}

export interface AvailabilityResult {
  status: 'conflict' | 'clear' | 'unknown'
  source: DataSource
  message: string
}
