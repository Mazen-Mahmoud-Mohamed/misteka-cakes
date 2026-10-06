/**
 * Static security contract checks for order payload + SQL.
 * Usage: node scripts/products-order-security-qa.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const orderService = readFileSync(join('src', 'services', 'orderService.ts'), 'utf8')
const sql = readFileSync(join('supabase', 'order-products-offers.sql'), 'utf8')
const productsSql = readFileSync(join('supabase', 'products-system.sql'), 'utf8')
const offerPage = readFileSync(join('src', 'pages', 'OfferDetailPage.tsx'), 'utf8')
const productCard = readFileSync(join('src', 'components', 'catalog', 'ProductCard.tsx'), 'utf8')

const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const payloadFn = orderService.slice(orderService.indexOf('function placeOrderPayload'))
check(
  'placeOrderPayload_no_prices',
  !/(unit_price|total_price|base_price|fixed_price|discount_percent)\s*:/.test(payloadFn.split('async function uploadReference')[0] || payloadFn),
)
check('placeOrderPayload_sends_order_kind', orderService.includes('order_kind: kind') && orderService.includes('option_value_ids'))
check('place_order_ignores_client_prices_comment', sql.includes('Client price/status/total keys in payload are intentionally ignored'))
check('place_order_branches', sql.includes("v_order_kind = 'product'") && sql.includes("v_order_kind = 'offer'") && sql.includes('LEGACY CAKE ORDER'))
check('order_items_table', sql.includes('create table if not exists public.order_items'))
check('option_foreign_product_rejected', sql.includes('الخيار لا ينتمي لهذا المنتج'))
check('offer_expired_rejected', sql.includes('offer_expired'))
check('offer_future_rejected', sql.includes('offer_not_started'))
check('quote_only_rejected', sql.includes('quote_only') && sql.includes('طلب سعر'))
check('helpers_search_path_empty', /order_resolve_product_price[\s\S]*?set search_path = ''/.test(sql) && /order_resolve_option_lines[\s\S]*?set search_path = ''/.test(sql))
check('place_order_search_path_empty', /create or replace function public\.place_order[\s\S]*?set search_path = ''/.test(sql))
check('helpers_revoked_from_anon', sql.includes('revoke all on function public.order_resolve_product_price(text, text) from anon, authenticated'))
check('customer_picks_category_enforced', sql.includes('المنتج خارج تصنيف العرض'))
check('invalid_quantity_guard', sql.includes('invalid_quantity') && sql.includes('v_quantity > 99'))
check('products_public_requires_enabled_category', productsSql.includes('c.enabled = true'))
check('admin_counts_requires_admin', productsSql.includes('if not public.is_admin()'))
check('offer_ui_customer_picks', offerPage.includes('اختاري الصنف') && offerPage.includes('listProductsForOfferComponent'))
check('quote_ui_blocks_checkout', productCard.includes('اطلب السعر') && productCard.includes('socialLinks.whatsapp'))
check('gift_and_percent_math_present', sql.includes("component_pricing = 'free'") && sql.includes("component_pricing = 'percent_off'"))

const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log('\nAll products-order security contract checks OK')
