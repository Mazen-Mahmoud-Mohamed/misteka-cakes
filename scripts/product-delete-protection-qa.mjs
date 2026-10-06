/**
 * Static checks: products with order history are hide-only (service, Admin UI, database).
 * Usage: node scripts/product-delete-protection-qa.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const read = (...p) => readFileSync(join(...p), 'utf8')

const svc = read('src', 'services', 'admin', 'adminProductService.ts')
const page = read('src', 'pages', 'admin', 'AdminProductsPage.tsx')
const mig = read('supabase', 'product-delete-protection.sql')
const test = read('supabase', 'tests', 'product-delete-protection.test.sql')

const fn = svc.slice(svc.indexOf('export async function deleteAdminProduct(id: string)'))
const fnBody = fn.slice(0, fn.search(/\r?\n\}\r?\n/) + 2)
const at = (s) => fnBody.indexOf(s)

// Service
check('svc_message', svc.includes("'لا يمكن حذف منتج له طلبات سابقة. يمكنك إخفاؤه بدلًا من حذفه.'"))
check('svc_checks_orders', svc.includes(".from('orders').select('id', { count: 'exact', head: true }).eq('product_id', id)"))
check('svc_checks_order_items', svc.includes(".from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id)"))
check('svc_cake_guard_first', at('legacy_cake_id') > -1 && at('legacy_cake_id') < at(".delete("))
check('svc_history_before_delete', at('productHasOrderHistory(supabase, id)') > -1 && at('productHasOrderHistory(supabase, id)') < at(".delete("))
check('svc_fail_closed', fnBody.includes('if (hasHistory === null)') && fnBody.includes('لم يتم الحذف'))
check('svc_offer_fk_message_kept', fnBody.includes("qErr.code === '23503'"))
check('svc_maps_db_trigger', fnBody.includes("product_has_order_history"))

// UI
check('ui_loads_history', page.includes('listAdminProductIdsWithOrders()') && page.includes('setWithHistory'))
check('ui_unknown_history_is_protected', page.includes('withHistory === null ||'))
check('ui_hide_only_title', page.includes('له طلبات سابقة — يمكن إخفاؤه ولا يمكن حذفه'))
check('ui_badge', (page.match(/له طلبات سابقة<\/AdminBadge>/g) ?? []).length === 2)
{
  const block = page.slice(page.indexOf('hasHistory(crud.original) ? ('), page.indexOf('حذف المنتج\n'))
  check('ui_delete_button_only_without_history', block.includes(') : (') && block.indexOf('setConfirmDelete(true)') > block.indexOf(') : ('))
}
check('ui_confirm_text', page.includes('الحذف النهائي متاح فقط للمنتجات التي ليس لها طلبات سابقة'))
check('ui_hide_switch_present', page.includes('id="product-enabled"') && page.includes('ظاهر في الموقع'))

// Database
check('db_trigger_before_delete', mig.includes('before delete on public.products'))
check('db_checks_all_sources', ['o.product_id = old.id', 'i.product_id = old.id', 'o.cake_id = old.legacy_cake_id'].every((s) => mig.includes(s)))
check('db_no_fk_on_history', !/alter table public\.(orders|order_items)/i.test(mig) && !/references public\.products/i.test(mig))
check('db_no_order_writes', !/(insert into|update|delete from)\s+public\.(orders|order_items)/i.test(mig))
check('db_search_path', (mig.match(/set search_path = ''/g) ?? []).length === 2)
check('db_revoked', mig.includes('revoke all on function public.products_block_delete_with_history() from public, anon, authenticated'))
check('db_message', mig.includes("raise exception 'product_has_order_history'"))
check('db_test_rolls_back', test.trim().endsWith('rollback;') && !/insert into public\.(orders|order_items)/i.test(test))
check('db_test_cases', ['A_has_orders_ref', 'B_has_order_items_ref', 'C_delete_without_history_allowed', 'D_offer_product_protected', 'E_cake_with_history_rejected', 'F_hidden_still_undeletable'].every((n) => test.includes(n)))

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
