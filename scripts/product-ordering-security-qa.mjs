/**
 * Extended static security checks for ordering models / tiers / options.
 * Usage: node scripts/product-ordering-security-qa.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const mig = readFileSync(join('supabase', 'product-ordering-models.sql'), 'utf8')
const place = readFileSync(join('supabase', 'order-products-offers.sql'), 'utf8')
const baseSec = readFileSync(join('scripts', 'products-order-security-qa.mjs'), 'utf8')

check('tier_wrong_product_guard', mig.includes('product_id = p_product_id') && mig.includes('invalid_tier'))
check('fake_package_price_ignored', mig.includes('v_tier.price') && place.includes('Client price/status/total keys in payload are intentionally ignored'))
check('quantity_bounds', mig.includes('qty_min') && mig.includes('invalid_quantity'))
check('weight_requires_tier', mig.includes("tier_kind = 'weight'") && mig.includes('اختاري الوزن'))
check('package_requires_selection', mig.includes('اختاري الباقة'))
check('option_foreign_product', mig.includes('الخيار لا ينتمي لهذا المنتج') || place.includes('الخيار لا ينتمي لهذا المنتج'))
check('quote_forced_paid_blocked', mig.includes('quote_only'))
check('hidden_product_blocked', mig.includes('invalid_product') && mig.includes('enabled = true'))
check('search_path_empty_helpers', (mig.match(/set search_path = ''/g) || []).length >= 2)
check('revoke_helpers', mig.includes('from anon, authenticated'))
check('rls_tiers', mig.includes('enable row level security') && mig.includes('admin_insert_product_price_tiers'))
check('rls_option_library', mig.includes('admin_insert_option_definitions') && mig.includes('public_read_product_option_links'))
check('legacy_cake_compat_wrapper', mig.includes('order_resolve_product_price') && mig.includes('order_resolve_configured_price'))
check('base_security_script_present', baseSec.includes('place_order_ignores_client_prices_comment'))

const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log('\nAll product-ordering security contract checks OK')
