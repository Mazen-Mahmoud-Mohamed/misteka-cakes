/**
 * Static contract checks for the unified Admin structure:
 * categories tree, products-only list, cake config inside the product editor,
 * options library, offers, and Admin-managed public pricing.
 * Usage: node scripts/dashboard-structure-qa.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const read = (...parts) => readFileSync(join(...parts), 'utf8')

const shell = read('src', 'components', 'admin', 'AdminShell.tsx')
const app = read('src', 'App.tsx')
const categories = read('src', 'pages', 'admin', 'AdminCategoriesPage.tsx')
const products = read('src', 'pages', 'admin', 'AdminProductsPage.tsx')
const productService = read('src', 'services', 'admin', 'adminProductService.ts')
const catalogAdmin = read('src', 'services', 'admin', 'adminCatalogService.ts')
const pricingAdmin = read('src', 'pages', 'admin', 'AdminPricingPage.tsx')
const pricingAdminService = read('src', 'services', 'admin', 'adminPricingService.ts')
const pricingSection = read('src', 'sections', 'PricingSection.tsx')
const pricingContent = read('src', 'services', 'pricingContent.ts')
const catalogService = read('src', 'services', 'catalogService.ts')
const catalogRepo = read('src', 'services', 'catalogRepository.ts')
const mig = read('supabase', 'pricing-content.sql')

// --- Navigation -----------------------------------------------------------
const contentGroup = shell.slice(shell.indexOf("label: 'المحتوى'"), shell.indexOf("label: 'إعدادات التورت التفصيلية'"))
const order = ['المنتجات', 'التصنيفات', 'مكتبة الخيارات', 'العروض والباقات', 'الأسعار', 'آراء العملاء']
const positions = order.map((label) => contentGroup.indexOf(`label: '${label}'`))
check('nav_content_order', positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), positions.join(','))
check('nav_cake_settings_group', shell.includes("label: 'إعدادات التورت التفصيلية'"))
check('nav_no_legacy_cake_list', !shell.includes("to: '/admin/cakes'"))
check('legacy_cake_route_redirects', app.includes('path="cakes"') && app.includes('Navigate to="/admin/products?category=cat-cakes"'))
check('legacy_cake_page_removed', !existsSync(join('src', 'pages', 'admin', 'AdminCakesPage.tsx')))
check('pricing_route', app.includes('path="pricing" element={<AdminPricingPage />}'))
for (const path of ['sizes', 'fillings', 'extras', 'options', 'offers', 'reviews', 'categories', 'products']) {
  check(`route_${path}`, app.includes(`path="${path}"`))
}

// --- Categories -----------------------------------------------------------
check('categories_tree', categories.includes('flattenTree') && categories.includes('depth'))
check('categories_add_sub', categories.includes('إضافة تصنيف فرعي تحت') && categories.includes('startNew(row.id)'))
check('categories_counts_include_children', categories.includes('treeCountLabel'))
check('categories_reorder', categories.includes('move(row, -1)') && categories.includes('move(row, 1)'))
check('categories_quick_visibility', categories.includes('setVisibility(row, true)') && categories.includes('إخفاء التصنيف؟'))
check('categories_delete_guard', productService.includes('لا يمكن حذف تصنيف يحتوي تصنيفات فرعية') && productService.includes('مرتبط بمنتجات'))
check('categories_offers_protected', categories.includes('OFFERS_ID') && categories.includes('قسم العروض لا يُحذف'))

// --- Products ---------------------------------------------------------------
check('products_filter_top', products.includes("searchParams.get('category')"))
check('products_filter_sub', products.includes("searchParams.get('sub')"))
check('products_filter_model', products.includes('modelFilter'))
check('products_filter_visibility', products.includes('CatalogToolbar'))
check('products_row_price_summary', products.includes('priceSummary(row)') && products.includes('بدون سعر'))
check(
  'products_editor_sections',
  ['البيانات العامة', 'طريقة البيع', 'التسعير', 'إعدادات التورتة'].every((h) => products.includes(h)) &&
    products.includes('OptionLinkSection'),
)
check('cake_config_only_for_cake', products.includes('{isCake ? (') && products.includes('<CakeConfigSection'))
check('cake_config_requires_size', products.includes('اختاري مقاسًا واحدًا على الأقل'))
check('cake_requires_cake_subcategory', products.includes('التورت تحتاج تصنيفًا فرعيًا'))
{
  const fn = productService.slice(productService.indexOf('export async function upsertAdminCakeProduct'))
  const cakeAt = fn.indexOf(".from('cakes').upsert")
  const productAt = fn.search(/\.from\('products'\)\s*\.upsert\(\{ \.\.\.row, legacy_cake_id: cakeId/)
  check('cake_save_writes_cakes_then_product', cakeAt > -1 && productAt > cakeAt)
}
check('cake_products_not_deletable', productService.includes('التورت لا تُحذف حتى لا تتأثر الطلبات السابقة'))
check('no_reverse_cake_sync', !catalogAdmin.includes('upsertAdminCake(') && !catalogAdmin.includes("from('cake_categories')"))
check(
  'no_technical_terms_in_product_ui',
  [products, pricingAdmin, categories].every(
    (src) => !/['"`][^'"`\n]*[\u0600-\u06FF][^'"`\n]*(legacy|ordering_model|pricing_mode|cake_servings|tier_kind|RLS|SQL)[^'"`\n]*['"`]/.test(src),
  ),
)

// --- Pricing content: migration -------------------------------------------
check('mig_additive', !/drop\s+table/i.test(mig) && !/delete\s+from/i.test(mig) && !/truncate/i.test(mig))
check('mig_no_catalog_writes', !/(update|insert into)\s+public\.(cakes|cake_sizes|products|product_price_tiers|offers|orders)\b/i.test(mig))
check('mig_tables', mig.includes('create table if not exists public.pricing_sections') && mig.includes('create table if not exists public.pricing_items'))
check('mig_rls_enabled', mig.includes('alter table public.pricing_sections enable row level security') && mig.includes('alter table public.pricing_items enable row level security'))
check('mig_public_read_enabled_only', mig.includes('using (enabled = true)') && mig.includes('s.enabled = true'))
check('mig_admin_writes', ['insert', 'update', 'delete'].every((op) => mig.includes(`admin_${op}_pricing_sections`) && mig.includes(`admin_${op}_pricing_items`)))
check('mig_anon_select_only', mig.includes('grant select on table public.pricing_sections to anon') && !/grant[^;]*(insert|update|delete)[^;]*to anon/i.test(mig))
check('mig_functions_search_path', [...mig.matchAll(/create or replace function[\s\S]*?\$\$;/g)].every((m) => m[0].includes("set search_path = ''")))
check('mig_linked_rows_store_no_price', mig.includes("when 'cake_size' then cake_size_id is not null and price is null"))
check('mig_seed_idempotent', (mig.match(/on conflict \(id\) do nothing/g) ?? []).length >= 5 && !mig.includes('do update'))

// --- Pricing content: client ------------------------------------------------
check('public_pricing_single_renderer', pricingSection.includes('listPricingSections') && pricingSection.includes('resolvePricingItem'))
check('public_pricing_no_hardcoded_cake', !pricingSection.includes('getBasicPricing') && !pricingSection.includes('PriceList') && !pricingSection.includes('singleTitle'))
check('old_pricing_paths_removed', !catalogService.includes('getBasicPricing') && !catalogService.includes('getPricingNotes') && !existsSync(join('src', 'components', 'pricing', 'PriceList.tsx')))
check('linked_prices_live', pricingContent.includes('size.price') && pricingContent.includes('tier.price') && pricingContent.includes('product.fixedPrice'))
check('hidden_targets_skipped', pricingContent.includes('p.enabled') && pricingContent.includes('t.enabled'))
check('fallback_only_when_tables_missing', catalogRepo.includes('pricingSectionsRes.error || pricingItemsRes.error') && catalogRepo.includes('deriveDefaultPricingSections'))
check('checkout_never_reads_pricing_content', !read('src', 'services', 'orderService.ts').includes('pricing_') && !read('supabase', 'order-products-offers.sql').includes('pricing_items'))
check('admin_pricing_kinds', ['cake_size', 'product', 'product_tier', 'price', 'note', 'text'].every((k) => pricingAdmin.includes(`${k}:`)))
check('admin_pricing_reorder_visibility', pricingAdmin.includes('swapAdminPricingOrder') && pricingAdmin.includes('ظاهر في صفحة الأسعار'))
check('admin_pricing_missing_table_state', pricingAdminService.includes('missing') && pricingAdmin.includes('صفحة الأسعار غير مُفعّلة بعد'))
check('admin_pricing_normalizes_shape', pricingAdmin.includes('normalizeItem') && pricingAdmin.includes("price: kind === 'price' ? item.price : null"))

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
