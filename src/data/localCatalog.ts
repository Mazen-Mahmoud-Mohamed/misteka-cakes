import bouquet from '@/assets/cakes/bouquet.jpeg'
import butterflies from '@/assets/cakes/butterflies.jpeg'
import flowers from '@/assets/cakes/flowers.jpeg'
import goldButterflies from '@/assets/cakes/gold-butterflies.jpeg'
import pearls from '@/assets/cakes/pearls.jpeg'
import ribbons from '@/assets/cakes/ribbons.jpeg'
import { cakes as localCakes, localCategories } from '@/data/cakes'
import { deliveryPolicy, deliveryZones, designExtras, fillings } from '@/data/options'
import { basicCakePricing, pricingNotes, singleTierSizes, twoTierSizes } from '@/data/pricing'
import type { Cake, CakeCategoryInfo, CakeSize, DeliveryZone, DesignExtra, Filling } from '@/types'

export const cakeImageMap: Record<string, string> = {
  butterflies,
  flowers,
  ribbons,
  'gold-butterflies': goldButterflies,
  pearls,
  bouquet,
}

export const CAKE_IMAGE_BUCKET = 'cake-images'

export interface CatalogBundle {
  cakes: Cake[]
  categories: CakeCategoryInfo[]
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
    categories: [...localCategories],
    sizes: [...singleTierSizes, ...twoTierSizes],
    fillings: [...fillings],
    extras: [...designExtras],
    zones: deliveryZones.filter((zone) => zone.enabled),
    pricingNotes: [...pricingNotes],
    deliveryFee: deliveryPolicy.fee,
    deliveryNote: deliveryPolicy.note,
  }
}

/** True when `image_key` points at an uploaded file in the cake-images bucket. */
export function isStoredCakeImage(imageKey: string): boolean {
  return imageKey.startsWith('cakes/')
}

/**
 * `image_key` is either a bundled asset key (e.g. `butterflies`), a storage path
 * in the public cake-images bucket (`cakes/<id>.webp`), or an absolute URL.
 */
export function resolveCakeImage(imageKeyOrUrl: string): string {
  if (
    imageKeyOrUrl.startsWith('http://') ||
    imageKeyOrUrl.startsWith('https://') ||
    imageKeyOrUrl.startsWith('data:') ||
    imageKeyOrUrl.startsWith('blob:') ||
    imageKeyOrUrl.startsWith('/') ||
    imageKeyOrUrl.startsWith('.')
  ) {
    return imageKeyOrUrl
  }
  if (isStoredCakeImage(imageKeyOrUrl)) {
    const base = import.meta.env.VITE_SUPABASE_URL
    if (base) return `${base}/storage/v1/object/public/${CAKE_IMAGE_BUCKET}/${imageKeyOrUrl}`
  }
  return cakeImageMap[imageKeyOrUrl] ?? imageKeyOrUrl
}

export function getLocalBasicPricing() {
  return basicCakePricing
}
