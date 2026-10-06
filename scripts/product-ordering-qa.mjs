/**
 * Static contract checks for configuration-driven product ordering.
 * Usage: node scripts/product-ordering-qa.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function read(...parts) {
  return readFileSync(join(...parts), 'utf8')
}

const mig = read('supabase', 'product-ordering-models.sql')
const placeOrder = read('supabase', 'order-products-offers.sql')
const types = read('src', 'types', 'products.ts')
const catalogRepo = read('src', 'services', 'catalogRepository.ts')
const productConfig = read('src', 'components', 'order', 'ProductConfigStep.tsx')
const orderWizard = read('src', 'components', 'order', 'OrderWizard.tsx')
const basicInfo = read('src', 'components', 'order', 'BasicInfoStep.tsx')
const cakeDetails = read('src', 'components', 'order', 'CakeDetailsStep.tsx')
const pricing = read('src', 'sections', 'PricingSection.tsx')
const adminProducts = read('src', 'pages', 'admin', 'AdminProductsPage.tsx')
const adminOptions = read('src', 'pages', 'admin', 'AdminOptionsLibraryPage.tsx')
const orderService = read('src', 'services', 'orderService.ts')
const validation = read('src', 'utils', 'validation.ts')

check(
  'ordering_models_enum',
  ['cake_servings', 'quantity', 'fixed_item', 'weight', 'quote', 'custom'].every((m) =>
    types.includes(`'${m}'`) && mig.includes(`'${m}'`),
  ),
)
check('no_name_inference_cupcake', !adminProducts.includes("includes('كب") && !catalogRepo.includes("includes('cupcake"))
check('no_category_donut_hardcode', !productConfig.includes("category === ") && !orderWizard.includes("donut"))
check('price_tiers_table', mig.includes('create table if not exists public.product_price_tiers'))
check('option_library_tables', mig.includes('option_definitions') && mig.includes('product_option_links'))
check('resolve_configured_price', mig.includes('order_resolve_configured_price') && mig.includes("set search_path = ''"))
check('helpers_revoked', mig.includes('revoke all on function public.order_resolve_configured_price'))
check('place_order_uses_tier', placeOrder.includes('price_tier_id') && placeOrder.includes('order_resolve_configured_price'))
check('cake_tables_not_dropped', !mig.includes('drop table public.cakes') && !mig.includes('drop table public.cake_sizes'))
check('product_config_step', productConfig.includes('showPackagePicker') && productConfig.includes('اختاري العدد'))
check('wizard_skips_cake_ui', orderWizard.includes('ProductConfigStep') && orderWizard.includes('isCakeOrdering'))
check('basic_info_servings_gated', basicInfo.includes('isCakeOrdering') && basicInfo.includes('needsServings'))
check('cake_details_uses_ordering', cakeDetails.includes('isCakeOrdering'))
check('pricing_page_dynamic_tiers', pricing.includes('priceTiers') && pricing.includes('isCakeOrdering'))
check('admin_ordering_ui', adminProducts.includes('طريقة البيع') && adminProducts.includes('PriceTierSection'))
check('admin_option_links', adminProducts.includes('OptionLinkSection') && adminProducts.includes('/admin/options'))
check('admin_options_library_page', adminOptions.includes('مكتبة الخيارات') && adminOptions.includes('option_definitions') === false && adminOptions.includes('listAdminOptionDefinitions'))
check('client_payload_sends_tier_not_price', orderService.includes('price_tier_id') && !/placeOrderPayload[\s\S]*?unit_price\s*:/.test(orderService))
check('validation_requires_tier', validation.includes('priceTierId') && validation.includes('اختاري الخيار'))
check('security_fake_tier_paths', mig.includes('invalid_tier') && mig.includes('invalid_quantity') && mig.includes('quote_only'))

const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log('\nAll product-ordering contract checks OK')
