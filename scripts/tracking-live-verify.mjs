/**
 * Live, read-mostly verification of the order-tracking RPCs (anon key only).
 * Never cancels anything: the cancel probe uses a non-existent order number.
 * Usage: node scripts/tracking-live-verify.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing ${path}`)
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

const QA_PHONE = process.env.QA_PHONE || '01012345678'
const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const env = loadEnv('.env.local')
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const bad = await sb.rpc('track_customer_orders', { p_phone: '123' })
record('track_customer_orders exists + rejects invalid phone', bad.data?.code === 'invalid_phone', bad.error?.message || JSON.stringify(bad.data))

const none = await sb.rpc('track_customer_orders', { p_phone: '01599999999' })
record('unknown phone returns empty list', none.data?.ok === true && none.data.orders.length === 0, none.error?.message || JSON.stringify(none.data))

const qa = await sb.rpc('track_customer_orders', { p_phone: `+20 ${QA_PHONE.slice(1)}` })
const orders = qa.data?.orders ?? []
const allowedKeys = ['orderNumber', 'status', 'createdAt', 'cakeName', 'designMode', 'size', 'date']
const minimal = orders.every((o) => Object.keys(o).every((k) => allowedKeys.includes(k)))
record('QA phone lookup works (+20 normalized) and returns only minimal fields', qa.data?.ok === true && minimal, qa.error?.message || `${orders.length} orders`)

if (orders[0]) {
  const d = await sb.rpc('get_customer_order', { p_phone: QA_PHONE, p_order_number: orders[0].orderNumber })
  const o = d.data?.order ?? {}
  const leaks = ['phone', 'customerName', 'addressNotes', 'notes', 'referenceImage', 'id'].filter((k) => k in o)
  record('get_customer_order returns details with owning phone, no private fields', d.data?.ok === true && leaks.length === 0 && Array.isArray(o.events), d.error?.message || `leaks=${leaks}`)
  const wrong = await sb.rpc('get_customer_order', { p_phone: '01599999999', p_order_number: orders[0].orderNumber })
  record('get_customer_order refuses a different phone', wrong.data?.ok === false && wrong.data.code === 'not_found', JSON.stringify(wrong.data))
}

const cancel = await sb.rpc('customer_cancel_order', { p_phone: QA_PHONE, p_order_number: 'MK-00000000' })
record('customer_cancel_order exists and refuses unknown order', cancel.data?.ok === false && cancel.data.code === 'not_found', cancel.error?.message || JSON.stringify(cancel.data))

const admin3 = await sb.rpc('admin_update_order_status', { order_id: 'x', new_status: 'confirmed', reason: null })
record('admin_update_order_status(order_id,new_status,reason) exists and is denied to anon', /permission denied/i.test(admin3.error?.message || ''), admin3.error?.message)

for (const table of ['orders', 'order_status_events', 'order_lookup_attempts']) {
  const r = await sb.from(table).select('*').limit(1)
  record(`anon cannot read ${table}`, /permission denied/i.test(r.error?.message || ''), r.error?.message || 'readable!')
}

console.log('\nQA_ORDERS ' + JSON.stringify(orders.map((o) => ({ n: o.orderNumber, s: o.status, created: o.createdAt, date: o.date, cake: o.cakeName, size: o.size }))))
console.log(`SUMMARY ${results.filter((r) => r.pass).length}/${results.length}`)
process.exit(results.every((r) => r.pass) ? 0 : 1)
