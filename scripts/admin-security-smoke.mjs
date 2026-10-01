/**
 * Phase 3 security smoke checks (anon key only).
 * Never prints secrets.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing ${path}`)
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    out[m[1].trim()] = m[2].trim()
  }
  return out
}

const results = []
function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const env = loadEnv('.env.local')
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

  const select = await supabase.from('orders').select('id').limit(1)
  record('anon_select_orders_denied', Boolean(select.error), select.error?.message || 'readable')

  const update = await supabase.from('orders').update({ status: 'confirmed' }).eq('id', '00000000-0000-0000-0000-000000000000')
  record('anon_update_orders_denied', Boolean(update.error), update.error?.message || 'updated')

  const del = await supabase.from('orders').delete().eq('id', '00000000-0000-0000-0000-000000000000')
  record('anon_delete_orders_denied', Boolean(del.error), del.error?.message || 'deleted')

  const adminRpc = await supabase.rpc('admin_update_order_status', {
    order_id: 'x',
    new_status: 'confirmed',
  })
  // Before migration: function missing. After migration without auth: forbidden or auth error.
  const adminBlocked =
    Boolean(adminRpc.error) ||
    adminRpc.data?.ok === false ||
    adminRpc.data?.code === 'forbidden'
  record('anon_admin_status_rpc_blocked', adminBlocked, adminRpc.error?.message || JSON.stringify(adminRpc.data))

  const isAdmin = await supabase.rpc('is_admin')
  record(
    'anon_is_admin_false_or_denied',
    Boolean(isAdmin.error) || isAdmin.data === false || isAdmin.data == null,
    isAdmin.error?.message || String(isAdmin.data),
  )

  const list = await supabase.storage.from('order-references').list()
  record('anon_storage_list_empty_or_denied', Boolean(list.error) || (list.data?.length ?? 0) === 0, list.error?.message || `count=${list.data?.length}`)

  // Order tracking (supabase/order-tracking.sql). Before the migration is applied
  // the RPCs are missing, which is reported but still safe.
  for (const table of ['order_status_events', 'order_lookup_attempts']) {
    const res = await supabase.from(table).select('*').limit(1)
    record(`anon_select_${table}_denied`, Boolean(res.error) || (res.data?.length ?? 0) === 0, res.error?.message || `rows=${res.data?.length}`)
  }

  const missing = (err) => /Could not find the function|does not exist/i.test(err?.message || '')
  const track = await supabase.rpc('track_customer_orders', { p_phone: '01599999999' })
  record(
    'anon_track_unknown_phone_returns_nothing',
    missing(track.error) || (track.data?.ok === true && track.data.orders.length === 0) || track.data?.code === 'rate_limited',
    missing(track.error) ? 'migration not applied yet' : JSON.stringify(track.data),
  )

  const details = await supabase.rpc('get_customer_order', { p_phone: '01599999999', p_order_number: 'MK-00000000' })
  record(
    'anon_details_require_matching_phone',
    missing(details.error) || details.data?.ok === false,
    missing(details.error) ? 'migration not applied yet' : JSON.stringify(details.data),
  )

  const cancel = await supabase.rpc('customer_cancel_order', { p_phone: '01599999999', p_order_number: 'MK-00000000' })
  record(
    'anon_cancel_requires_matching_phone',
    missing(cancel.error) || cancel.data?.ok === false,
    missing(cancel.error) ? 'migration not applied yet' : JSON.stringify(cancel.data),
  )

  const failed = results.filter((r) => !r.pass)
  console.log(`\nSUMMARY ${results.filter((r) => r.pass).length}/${results.length}`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
