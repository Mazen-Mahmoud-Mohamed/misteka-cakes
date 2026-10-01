/**
 * Cancels (never deletes) pending QA orders placed with the dummy QA phone
 * used by qa-audit.mjs / live-supabase-test.mjs. Goes through the public
 * customer_cancel_order RPC, so the server's pending_review-only rule applies.
 * Usage: node scripts/cancel-qa-orders.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

const QA_PHONE = '01012345678'
const dryRun = process.argv.includes('--dry-run')

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing ${path}`)
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

const env = loadEnv('.env.local')
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const cancelled = []
for (;;) {
  const list = await sb.rpc('track_customer_orders', { p_phone: QA_PHONE })
  if (list.data?.code === 'rate_limited') {
    console.log('rate limited, waiting 10 minutes…')
    await sleep(10 * 60 * 1000 + 5000)
    continue
  }
  if (!list.data?.ok) throw new Error(JSON.stringify(list.error || list.data))
  const pending = list.data.orders.filter((o) => o.status === 'pending_review')
  if (!pending.length || dryRun) {
    console.log(`pending QA orders: ${pending.length}`)
    break
  }
  for (const o of pending) {
    const r = await sb.rpc('customer_cancel_order', { p_phone: QA_PHONE, p_order_number: o.orderNumber })
    if (r.data?.code === 'rate_limited') break
    console.log(`${o.orderNumber} ${o.date} → ${r.data?.ok ? 'cancelled' : JSON.stringify(r.data)}`)
    if (r.data?.ok) cancelled.push(o.orderNumber)
  }
}
console.log(`CANCELLED ${cancelled.length}: ${cancelled.join(', ')}`)
