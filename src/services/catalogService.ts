import { cakes } from '@/data/cakes'
import { deliveryPolicy, deliveryZones, designExtras, fillings, timeSlots } from '@/data/options'
import { basicCakePricing, pricingNotes, singleTierSizes, twoTierSizes } from '@/data/pricing'
import type { Cake, CakeSize, PricingGroup } from '@/types'

/**
 * Catalog reads stay behind these functions.
 * They return the local lists until the Supabase tables are filled.
 * Replace the function bodies later; keep the return types.
 */

export function listCakes(): Cake[] {
  return cakes
}

export function getCake(id: string): Cake | undefined {
  return cakes.find((cake) => cake.id === id)
}

export function listSizes(group?: PricingGroup): CakeSize[] {
  if (group === 'single') return singleTierSizes
  if (group === 'two-tier') return twoTierSizes
  return [...singleTierSizes, ...twoTierSizes]
}

export function getSize(id: string): CakeSize | undefined {
  return listSizes().find((size) => size.id === id)
}

export function getBasicPricing() {
  return basicCakePricing
}

export function getPricingNotes() {
  return pricingNotes
}

export function listFillings() {
  return fillings
}

export function getFilling(id: string) {
  return fillings.find((filling) => filling.id === id)
}

export function listExtras() {
  return designExtras
}

export function listZones() {
  return deliveryZones.filter((zone) => zone.enabled)
}

export function getZone(id: string) {
  return listZones().find((zone) => zone.id === id)
}

export function listTimeSlots() {
  return timeSlots
}

export function getDeliveryPolicy() {
  return deliveryPolicy
}
