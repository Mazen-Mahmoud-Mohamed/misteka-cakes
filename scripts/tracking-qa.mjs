/**
 * Rendered + functional QA for customer order tracking (#/track-order).
 * Supabase is fully intercepted. The mock RPCs mirror the server rules in
 * supabase/order-tracking.sql: phone-scoped lookups, details require phone +
 * order number, cancellation only while pending_review.
 *
 * Usage: QA_BASE=http://127.0.0.1:4198 node scripts/tracking-qa.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:4198'
const OUT = 'qa-output/tracking'
mkdirSync(OUT, { recursive: true })

const issues = []
const passes = []
const note = (d) => {
  issues.push(d)
  console.log(`[FAIL] ${d}`)
}
const ok = (d) => {
  passes.push(d)
  console.log(`[PASS] ${d}`)
}

const PHONE = '01012345678'
const OTHER_PHONE = '01198765432'
const STATUSES = ['pending_review', 'confirmed', 'preparing', 'in_production', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled']
const FLOW = ['pending_review', 'confirmed', 'preparing', 'in_production', 'ready', 'out_for_delivery', 'delivered']

function fixtures() {
  const orders = STATUSES.map((status, i) => {
    const reachedIdx = FLOW.includes(status) ? FLOW.indexOf(status) : 1
    const events = FLOW.slice(0, reachedIdx + 1).map((s, k) => ({ status: s, at: `2026-09-2${k}T10:00:00Z` }))
    if (!FLOW.includes(status)) events.push({ status, at: '2026-09-28T12:00:00Z' })
    return {
      id: `id-${i}`,
      order_number: `MK-0000000${i}`,
      phone: PHONE,
      customer_name: 'سارة أحمد',
      address_notes: 'سري: شارع التسعين',
      notes: 'ملاحظة خاصة',
      status,
      created_at: `2026-09-${10 + i}T09:00:00Z`,
      cake_name: i % 3 === 2 ? null : 'تورتة الفراشات',
      design_mode: i % 3 === 2 ? 'custom' : 'catalog',
      size: '20 سم',
      servings: 15,
      filling: 'فانيليا بالفراولة',
      extras: ['ورق ذهب'],
      service_type: 'delivery',
      area: 'القاهرة',
      event_date: '2026-10-20',
      event_time: '16:00',
      total_price: 950,
      pending_charges: [],
      rejection_reason: status === 'rejected' ? 'الموعد المطلوب محجوز بالكامل' : null,
      cancelled_by: status === 'cancelled' ? 'admin' : null,
      events,
    }
  })
  orders.push({ ...orders[0], id: 'other', order_number: 'MK-FFFFFFFF', phone: OTHER_PHONE, customer_name: 'عميل آخر' })
  return orders
}

function detail(o) {
  return {
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at,
    cakeName: o.cake_name,
    designMode: o.design_mode,
    size: o.size,
    servings: o.servings,
    filling: o.filling,
    extras: o.extras,
    serviceType: o.service_type,
    area: o.area,
    date: o.event_date,
    time: o.event_time,
    totalPrice: o.total_price,
    pendingCharges: o.pending_charges,
    rejectionReason: o.status === 'rejected' ? o.rejection_reason : null,
    cancelledBy: o.status === 'cancelled' ? o.cancelled_by : null,
    canCancel: o.status === 'pending_review',
    events: o.events,
  }
}

async function mockSupabase(context, opts = {}) {
  const db = fixtures()
  const log = { rpc: [], directOrders: 0 }
  const state = { fail: opts.fail || false }

  await context.route(/\/(auth|rest|storage)\/v1\//, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const notFound = { ok: false, code: 'not_found', message: 'لم نجد طلبًا بهذه البيانات.' }

    if (path.includes('/rest/v1/orders')) {
      log.directOrders++
      return json({ message: 'permission denied for table orders' }, 401)
    }
    if (path.endsWith('/rpc/track_customer_orders')) {
      const body = req.postDataJSON()
      log.rpc.push({ fn: 'track', ...body })
      if (state.fail) return json({ message: 'boom' }, 500)
      const rows = db
        .filter((o) => o.phone === body.p_phone)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((o) => ({ orderNumber: o.order_number, status: o.status, createdAt: o.created_at, cakeName: o.cake_name, designMode: o.design_mode, size: o.size, date: o.event_date }))
      return json({ ok: true, orders: rows })
    }
    if (path.endsWith('/rpc/get_customer_order')) {
      const body = req.postDataJSON()
      log.rpc.push({ fn: 'get', ...body })
      const o = db.find((x) => x.order_number === body.p_order_number && x.phone === body.p_phone)
      return json(o ? { ok: true, order: detail(o) } : notFound)
    }
    if (path.endsWith('/rpc/customer_cancel_order')) {
      const body = req.postDataJSON()
      log.rpc.push({ fn: 'cancel', ...body })
      const o = db.find((x) => x.order_number === body.p_order_number && x.phone === body.p_phone)
      if (!o) return json(notFound)
      if (o.status !== 'pending_review')
        return json({ ok: false, code: 'not_cancellable', message: 'لا يمكن إلغاء الطلب بعد بدء مراجعته.', status: o.status })
      o.status = 'cancelled'
      o.cancelled_by = 'customer'
      o.events.push({ status: 'cancelled', at: new Date().toISOString() })
      return json({ ok: true, status: 'cancelled' })
    }
    // Catalog tables etc. are irrelevant for this page.
    return json([])
  })
  return { db, log, state }
}

async function measure(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const overflow = document.documentElement.scrollWidth > vw + 1
    const offenders = overflow
      ? [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && (r.right > vw + 1 || r.left < -1)
          })
          .slice(0, 5)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`)
      : []
    return { overflow, offenders }
  })
}

async function lookup(page, phone = PHONE) {
  await page.fill('#track-phone', phone)
  await page.getByRole('button', { name: 'عرض طلباتي' }).click()
}

async function openOrder(page, number) {
  await page.getByRole('button', { name: `عرض تفاصيل الطلب ${number}` }).click()
  await page.getByRole('heading', { name: number }).waitFor({ timeout: 5000 })
}

async function main() {
  const browser = await chromium.launch()

  // --- Functional flow -------------------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const { log, state } = await mockSupabase(context)
  const page = await context.newPage()
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })

  const navLink = page.locator('header nav[aria-label="التنقل الرئيسي"]').getByRole('link', { name: 'متابعة الطلب' })
  if (await navLink.isVisible()) ok('desktop navbar has «متابعة الطلب»')
  else note('desktop navbar link missing')
  await navLink.click()
  await page.waitForURL(/#\/track-order$/)
  ok('navbar link opens #/track-order')
  await page.screenshot({ path: join(OUT, 'initial-1280.png'), fullPage: true })

  await page.getByRole('button', { name: 'عرض طلباتي' }).click()
  if ((await page.locator('#track-phone-error').count()) && log.rpc.length === 0) ok('invalid phone is rejected before any RPC call')
  else note('invalid phone validation missing')

  state.fail = true
  await lookup(page)
  await page.getByText('تعذّر عرض الطلبات').waitFor({ timeout: 5000 })
  ok('error state renders with retry')
  await page.screenshot({ path: join(OUT, 'error-1280.png'), fullPage: true })
  state.fail = false
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click()
  await page.getByText(`وجدنا ${STATUSES.length} طلبات`).waitFor({ timeout: 5000 })
  ok('retry recovers and lists orders')

  await lookup(page, '٠١٠٠٠٠٠٠٠٠٠')
  await page.getByText('لا توجد طلبات بهذا الرقم').waitFor({ timeout: 5000 })
  if (log.rpc.at(-1)?.p_phone === '01000000000') ok('no-match state; Arabic digits normalized to 01000000000')
  else note(`normalized phone sent: ${log.rpc.at(-1)?.p_phone}`)
  await page.screenshot({ path: join(OUT, 'no-match-1280.png'), fullPage: true })

  await lookup(page, '+20 101 234 5678')
  await page.getByText(`وجدنا ${STATUSES.length} طلبات`).waitFor({ timeout: 5000 })
  const listText = await page.locator('main').innerText()
  if (log.rpc.at(-1)?.p_phone === PHONE) ok('+20 prefix normalized to the stored 01… format')
  else note(`+20 normalization: ${log.rpc.at(-1)?.p_phone}`)
  if (!listText.includes('MK-FFFFFFFF') && !listText.includes('عميل آخر')) ok('another customer’s order is not listed')
  else note('unrelated order leaked into list')
  if (!listText.includes('سارة') && !listText.includes('سري') && !listText.includes('ملاحظة خاصة')) ok('list shows no name/address/notes')
  else note('list exposes private fields')
  const cards = await page.locator('main ul > li button').count()
  if (cards === STATUSES.length) ok(`multiple orders listed (${cards}) with reference, date, status and summary`)
  else note(`list cards=${cards}`)
  await page.screenshot({ path: join(OUT, 'list-1280.png'), fullPage: true })

  // Per-status details: timeline states, cancel availability.
  for (const [i, status] of STATUSES.entries()) {
    const number = `MK-0000000${i}`
    await openOrder(page, number)
    const text = await page.locator('main').innerText()
    const stages = await page.locator('ol[aria-label="مراحل الطلب"] > li').evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-stage'), el.getAttribute('data-state')]),
    )
    const cancelBtn = await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).count()
    const expectCancel = status === 'pending_review'
    const states = Object.fromEntries(stages)
    let timelineOk
    if (status === 'rejected' || status === 'cancelled') {
      timelineOk = stages.at(-1)?.[0] === status && stages.at(-1)?.[1] === 'terminal' && stages.slice(0, -1).every(([, s]) => s === 'completed')
    } else if (status === 'delivered') {
      timelineOk = stages.every(([, s]) => s === 'completed')
    } else {
      const idx = FLOW.indexOf(status)
      timelineOk =
        states[status] === 'current' &&
        FLOW.slice(0, idx).every((s) => states[s] === 'completed') &&
        FLOW.slice(idx + 1).every((s) => states[s] === 'upcoming')
    }
    const detailsOk = ['التصميم', 'نوع التصميم', 'المقاس', 'عدد الأفراد', 'الحشوة', 'الإضافات', 'الخدمة', 'منطقة التوصيل', 'التاريخ', 'الوقت', 'الإجمالي الحالي'].every((l) => text.includes(l))
    const privateOk = !text.includes('سارة') && !text.includes('سري') && !text.includes('ملاحظة خاصة')
    if (timelineOk && detailsOk && privateOk && (cancelBtn === 1) === expectCancel)
      ok(`${status}: details + timeline (${stages.map(([, s]) => s[0]).join('')}) + cancel ${expectCancel ? 'available' : 'hidden'}`)
    else note(`${status}: timeline=${timelineOk} details=${detailsOk} private=${privateOk} cancelBtn=${cancelBtn} ${JSON.stringify(stages)}`)
    if (status === 'rejected') {
      if (text.includes('تم رفض الطلب') && text.includes('السبب: الموعد المطلوب محجوز بالكامل')) ok('rejected order shows «تم رفض الطلب» + السبب from DB')
      else note('rejection reason not shown')
    }
    if (['pending_review', 'in_production', 'delivered', 'rejected'].includes(status))
      await page.screenshot({ path: join(OUT, `details-${status}-1280.png`), fullPage: true })
    await page.getByRole('button', { name: 'العودة إلى طلباتي' }).click()
  }

  // Cancel flow on the pending order.
  await openOrder(page, 'MK-00000000')
  await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await page.screenshot({ path: join(OUT, 'cancel-confirm-1280.png') })
  await dialog.getByRole('button', { name: 'تراجع' }).click()
  if (!(await page.locator('dialog[open]').count()) && !log.rpc.some((r) => r.fn === 'cancel')) ok('cancel dialog «تراجع» closes without calling the RPC')
  else note('تراجع did not close cleanly')
  await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).click()
  await dialog.getByRole('button', { name: 'نعم، ألغي الطلب' }).click()
  await page.getByText('تم إلغاء الطلب بنجاح.').waitFor({ timeout: 5000 })
  const afterText = await page.locator('main').innerText()
  const cancelCall = log.rpc.find((r) => r.fn === 'cancel')
  if (cancelCall?.p_phone === PHONE && cancelCall?.p_order_number === 'MK-00000000' && !afterText.includes('نعم، ألغي') && (await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).count()) === 0)
    ok('cancel succeeds via customer_cancel_order; cancelled order cannot be cancelled/reopened again')
  else note(`cancel flow: ${JSON.stringify(cancelCall)}`)
  await page.screenshot({ path: join(OUT, 'cancelled-success-1280.png'), fullPage: true })

  if (log.directOrders === 0) ok('no direct /rest/v1/orders requests from the customer site')
  else note(`direct orders requests: ${log.directOrders}`)
  await context.close()

  // --- Responsive / mobile nav ---------------------------------------------
  for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 860 } })
    await mockSupabase(ctx)
    const p = await ctx.newPage()
    await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    if (width < 1024) {
      await p.getByRole('button', { name: 'فتح القائمة' }).click()
      await p.locator('#mobile-nav').getByRole('link', { name: 'متابعة الطلب' }).click()
    } else {
      await p.locator('header nav[aria-label="التنقل الرئيسي"]').getByRole('link', { name: 'متابعة الطلب' }).click()
    }
    await p.waitForURL(/#\/track-order$/)
    const m1 = await measure(p)
    await lookup(p)
    await p.getByText(`وجدنا ${STATUSES.length} طلبات`).waitFor({ timeout: 5000 })
    const m2 = await measure(p)
    await openOrder(p, 'MK-00000007')
    const m3 = await measure(p)
    const header = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    if (!m1.overflow && !m2.overflow && !m3.overflow && header) ok(`${width}px: nav link works; form/list/details have no horizontal overflow`)
    else note(`${width}px overflow: ${JSON.stringify([m1, m2, m3])}`)
    if ([360, 390, 768, 1440].includes(width)) await p.screenshot({ path: join(OUT, `details-rejected-${width}.png`), fullPage: true })
    await ctx.close()
  }

  await browser.close()
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ passes, issues }, null, 2))
  console.log(`\n${passes.length} passed, ${issues.length} failed`)
  process.exit(issues.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
