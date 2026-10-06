import { cakes as localCakes, localCategories } from '@/data/cakes'
import type {
  Offer,
  Product,
  ProductCategory,
  ProductOption,
} from '@/types/products'

/** Local taxonomy mirroring the production seed (no fake product prices). */
export const localProductCategories: ProductCategory[] = [
  { id: 'cat-cakes', parentId: null, name: 'التورت', description: 'تورت حسب المقاس والحشوة', kind: 'standard', sortOrder: 10, enabled: true },
  { id: 'cat-cupcakes', parentId: null, name: 'كب كيك', description: '', kind: 'standard', sortOrder: 20, enabled: true },
  { id: 'cat-cakepops', parentId: null, name: 'كيك بوبس', description: '', kind: 'standard', sortOrder: 30, enabled: true },
  { id: 'cat-donuts', parentId: null, name: 'دونتس', description: '', kind: 'standard', sortOrder: 40, enabled: true },
  { id: 'cat-cookies', parentId: null, name: 'كوكيز', description: '', kind: 'standard', sortOrder: 50, enabled: true },
  { id: 'cat-offers', parentId: null, name: 'العروض والباقات', description: 'عروض وباقات ترويجية', kind: 'offers', sortOrder: 60, enabled: true },
  { id: 'birthday', parentId: 'cat-cakes', name: 'أعياد ميلاد', description: '', kind: 'standard', sortOrder: 10, enabled: true },
  { id: 'celebration', parentId: 'cat-cakes', name: 'مناسبات', description: '', kind: 'standard', sortOrder: 20, enabled: true },
  { id: 'cupcake-chocolate', parentId: 'cat-cupcakes', name: 'شوكولاتة', description: '', kind: 'standard', sortOrder: 10, enabled: true },
  { id: 'cupcake-vanilla', parentId: 'cat-cupcakes', name: 'فانيليا', description: '', kind: 'standard', sortOrder: 20, enabled: true },
  { id: 'cupcake-red-velvet', parentId: 'cat-cupcakes', name: 'ريد فلفيت', description: '', kind: 'standard', sortOrder: 30, enabled: true },
  { id: 'cakepop-chocolate', parentId: 'cat-cakepops', name: 'شوكولاتة', description: '', kind: 'standard', sortOrder: 10, enabled: true },
  { id: 'cakepop-vanilla', parentId: 'cat-cakepops', name: 'فانيليا', description: '', kind: 'standard', sortOrder: 20, enabled: true },
  { id: 'donut-dark-chocolate', parentId: 'cat-donuts', name: 'شوكولاتة بني', description: '', kind: 'standard', sortOrder: 10, enabled: true },
  { id: 'donut-white-chocolate', parentId: 'cat-donuts', name: 'شوكولاتة بيضاء', description: '', kind: 'standard', sortOrder: 20, enabled: true },
  { id: 'cookie-american', parentId: 'cat-cookies', name: 'أمريكان كوكيز', description: '', kind: 'standard', sortOrder: 10, enabled: true },
]

/** Products derived from existing local cakes — no invented catalog items. */
export function createLocalProducts(): Product[] {
  return localCakes.map((cake, index) => ({
    id: cake.id,
    name: cake.name,
    description: cake.description,
    categoryId: cake.category,
    pricingMode: 'cake_sizes' as const,
    fixedPrice: null,
    priceNote: cake.priceNote,
    legacyCakeId: cake.id,
    image: cake.image,
    imageAlt: cake.imageAlt,
    imageKey: cake.id,
    sortOrder: (index + 1) * 10,
    enabled: true,
    images: [
      {
        id: `${cake.id}-img-1`,
        productId: cake.id,
        image: cake.image,
        imageKey: cake.id,
        imageAlt: cake.imageAlt,
        sortOrder: 0,
      },
    ],
    options: [] as ProductOption[],
  }))
}

export function createLocalOffers(): Offer[] {
  return []
}

/** Legacy cake category list remains available for cake admin / order paths. */
export function legacyCategoriesFromProducts(): typeof localCategories {
  return localProductCategories
    .filter((c) => c.parentId === 'cat-cakes' && c.enabled)
    .map((c) => ({ id: c.id, name: c.name }))
}
