import bouquet from '@/assets/cakes/bouquet.jpeg'
import butterflies from '@/assets/cakes/butterflies.jpeg'
import flowers from '@/assets/cakes/flowers.jpeg'
import goldButterflies from '@/assets/cakes/gold-butterflies.jpeg'
import pearls from '@/assets/cakes/pearls.jpeg'
import ribbons from '@/assets/cakes/ribbons.jpeg'
import { cakes as localCakes } from '@/data/cakes'
import { deliveryPolicy, deliveryZones, designExtras, fillings } from '@/data/options'
import { basicCakePricing, pricingNotes, singleTierSizes, twoTierSizes } from '@/data/pricing'
import type { Cake, CakeSize, DeliveryZone, DesignExtra, Filling } from '@/types'

export const cakeImageMap: Record<string, string> = {
  butterflies,
  flowers,
  ribbons,
  'gold-butterflies': goldButterflies,
  pearls,
  bouquet,
}

export interface CatalogBundle {
  cakes: Cake[]
  sizes: CakeSize[]
  fillings: Filling[]
  extras: DesignExtra[]
  zones: DeliveryZone[]
  pricingNotes: string[]
  deliveryFee: number | null
  deliveryNote: string
}

export function createLocalCatalog(): CatalogBundle {
  return {
    cakes: localCakes,
    sizes: [...singleTierSizes, ...twoTierSizes],
    fillings: [...fillings],
    extras: [...designExtras],
    zones: deliveryZones.filter((zone) => zone.enabled),
    pricingNotes: [...pricingNotes],
    deliveryFee: deliveryPolicy.fee,
    deliveryNote: deliveryPolicy.note,
  }
}

export function resolveCakeImage(imageKeyOrUrl: string): string {
  if (
    imageKeyOrUrl.startsWith('http://') ||
    imageKeyOrUrl.startsWith('https://') ||
    imageKeyOrUrl.startsWith('data:') ||
    imageKeyOrUrl.startsWith('/') ||
    imageKeyOrUrl.startsWith('.')
  ) {
    return imageKeyOrUrl
  }
  return cakeImageMap[imageKeyOrUrl] ?? imageKeyOrUrl
}

export function getLocalBasicPricing() {
  return basicCakePricing
}
