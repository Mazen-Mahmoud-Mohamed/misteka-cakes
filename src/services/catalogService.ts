import { timeSlots } from '@/data/options'
import { getCatalog } from '@/services/catalogStore'
import type { Cake, CakeSize, PricingGroup } from '@/types'

/**
 * Synchronous catalog accessors.
 * Backed by the in-memory store (local by default, Supabase after hydration).
 * Never silently swap back to hardcoded pricing once sizes are in the store.
 */

export function listCakes(): Cake[] {
  return getCatalog().cakes
}

export function getCake(id: string): Cake | undefined {
  return getCatalog().cakes.find((cake) => cake.id === id)
}

export function listSizes(group?: PricingGroup): CakeSize[] {
  const sizes = getCatalog().sizes
  if (group === 'single') return sizes.filter((size) => size.group === 'single')
  if (group === 'two-tier') return sizes.filter((size) => size.group === 'two-tier')
  return sizes
}

export function getSize(id: string): CakeSize | undefined {
  return getCatalog().sizes.find((size) => size.id === id)
}

/** Splits enabled sizes already loaded into the catalog store (sort_order preserved). */
export function getBasicPricing(): { single: CakeSize[]; twoTier: CakeSize[] } {
  const sizes = getCatalog().sizes
  return {
    single: sizes.filter((size) => size.group === 'single'),
    twoTier: sizes.filter((size) => size.group === 'two-tier'),
  }
}

export function getPricingNotes() {
  return getCatalog().pricingNotes
}

export function listFillings() {
  return getCatalog().fillings
}

export function getFilling(id: string) {
  return getCatalog().fillings.find((filling) => filling.id === id)
}

export function listExtras() {
  return getCatalog().extras
}

export function listZones() {
  return getCatalog().zones.filter((zone) => zone.enabled)
}

export function getZone(id: string) {
  return listZones().find((zone) => zone.id === id)
}

export function listTimeSlots() {
  return timeSlots
}

export function getDeliveryPolicy() {
  const catalog = getCatalog()
  return {
    fee: catalog.deliveryFee,
    note: catalog.deliveryNote,
  }
}
