/**
 * Rendered + functional QA for the admin dashboard.
 * Every Supabase request (auth, REST, RPC, storage) is intercepted and served
 * from in-memory fixtures — the live project is never contacted.
 *
 * Usage: QA_BASE=http://127.0.0.1:4198 node scripts/admin-ui-qa.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:4198'
const OUT = 'qa-output/admin'
mkdirSync(OUT, { recursive: true })

const issues = []
const passes = []
const note = (detail) => {
  issues.push(detail)
  console.log(`[FAIL] ${detail}`)
}
const ok = (detail) => {
  passes.push(detail)
  console.log(`[PASS] ${detail}`)
}

const cairoToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function shift(days) {
  const [y, m, d] = cairoToday.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

function fixtures() {
  const order = (n, status, patch = {}) => ({
    id: `00000000-0000-0000-0000-00000000000${n}`,
    order_number: `MS-2610-00${n}`,
    customer_name: ['سارة أحمد', 'منى خالد', 'ريم محمود', 'هبة السيد', 'نور علي', 'دينا حسن', 'ياسمين عادل', 'مريم فؤاد', 'إيمان سمير'][n - 1],
    phone: `0100${n}23456${n}`,
    area: n % 3 === 0 ? null : n % 2 ? 'القاهرة' : 'الجيزة',
    area_id: null,
    address_notes: n % 3 === 0 ? '' : 'شارع التسعين، عمارة 12، الدور الرابع',
    service_type: n % 3 === 0 ? 'pickup' : 'delivery',
    cake_id: n % 4 === 0 ? null : 'butterflies',
    cake_name: n % 4 === 0 ? null : ['تورتة الفراشات', 'تورتة الورد', 'تورتة اللؤلؤ'][n % 3],
    design_mode: n % 4 === 0 ? 'custom' : 'catalog',
    custom_design: n % 4 === 0,
    reference_image: n === 1 ? 'orders/ref-1.jpeg' : null,
    servings: [10, 15, 20, 25, 30, 7, 4, 35, 50][n - 1],
    size: ['18 سم', '20 سم', '24 سم', '26 سم', '30 سم', '16 سم', '14 سم', '20 فوق × 26 تحت', '24 فوق × 30 تحت'][n - 1],
    size_id: 'single-18',
    event_date: [cairoToday, cairoToday, shift(1), shift(3), shift(5), shift(-2), shift(-5), shift(7), shift(9)][n - 1],
    event_time: ['14:00:00', '18:30:00', '12:00:00', '16:00:00', '11:00:00', '19:00:00', '13:00:00', '17:00:00', '15:00:00'][n - 1],
    filling: 'فانيليا بالفراولة',
    filling_id: 'vanilla-strawberry',
    filling_price: 0,
    extras: n % 2 ? [{ id: 'gold-leaf', name: 'ورق ذهب', price: null, priceStatus: 'quote' }, { id: 'topper', name: 'توبر اسم', price: 150, priceStatus: 'known' }] : [],
    notes: n === 1 ? 'التورتة لعيد ميلاد ٥ سنين، اللون الوردي الفاتح مع فراشات ذهبية.\nالاسم: ليلى' : '',
    base_price: [700, 800, 1100, 1350, 1700, 600, 500, 2200, 2600][n - 1],
    extras_price: null,
    delivery_price: null,
    total_price: n === 4 ? null : [850, 800, 1250, null, 1850, 600, 500, 2200, 2750][n - 1],
    pending_charges: n % 2 ? ['ورق ذهب'] : [],
    price_lines: [
      { id: 'base', label: 'سعر التورتة', amount: [700, 800, 1100, 1350, 1700, 600, 500, 2200, 2600][n - 1], status: 'known' },
      { id: 'filling', label: 'الحشوة', amount: 0, status: 'known' },
      { id: 'delivery', label: 'التوصيل', amount: null, status: 'outside', note: 'عبر أوبر على حساب العميل' },
    ],
    status,
    created_at: new Date(Date.now() - n * 3600_000 * 7).toISOString(),
    ...patch,
  })
  const size = (id, group, label, servings, price, sort, enabled = true) => ({
    id, pricing_group: group, label, servings_label: servings, servings_min: null, servings_max: null, price, sort_order: sort, enabled,
  })
  return {
    orders: [
      order(1, 'pending_review'), order(2, 'pending_review'), order(3, 'confirmed'), order(4, 'pending_review'),
      order(5, 'confirmed'), order(6, 'rejected'), order(7, 'cancelled'), order(8, 'confirmed'), order(9, 'confirmed'),
    ],
    cake_sizes: [
      size('single-14', 'single', '14 سم', '4 أفراد', 500, 10), size('single-16', 'single', '16 سم', '7 أفراد', 600, 20),
      size('single-18', 'single', '18 سم', '10 أفراد', 700, 30), size('single-20', 'single', '20 سم', '15 فرد', 800, 40),
      size('single-24', 'single', '24 سم', '20 - 23 فرد', 1100, 50), size('single-26', 'single', '26 سم', '25 - 27 فرد', 1350, 60),
      size('single-30', 'single', '30 سم', '30 - 35 فرد', 1700, 70, false),
      size('two-14-20', 'two-tier', '14 فوق × 20 تحت', '20 فرد', 1500, 80), size('two-18-24', 'two-tier', '18 فوق × 24 تحت', '30 فرد', 1800, 90),
      size('two-20-26', 'two-tier', '20 فوق × 26 تحت', '35 فرد', 2200, 100), size('two-24-30', 'two-tier', '24 فوق × 30 تحت', '50+ فرد', 2600, 110),
    ],
    cakes: [
      ['butterflies', 'تورتة الفراشات', 'birthday'], ['flowers', 'تورتة الورد', 'celebration'], ['ribbons', 'تورتة الفيونكات', 'birthday'],
      ['gold-butterflies', 'الفراشات الذهبية', 'birthday'], ['pearls', 'تورتة اللؤلؤ', 'celebration'], ['bouquet', 'بوكيه الورد', 'celebration'],
    ].map(([id, name, category], i) => ({
      id, name, description: 'تصميم ناعم بلمسات يدوية.', image_key: id, image_alt: name, image_position: 'center', category,
      pricing_group: 'single', base_price: null, price_note: '', serving_info: '',
      available_size_ids: ['single-14', 'single-16', 'single-18', 'single-20'], filling_ids: ['vanilla-strawberry', 'chocolate'],
      extra_ids: ['gold-leaf'], sort_order: (i + 1) * 10, enabled: i !== 5,
    })),
    fillings: [
      { id: 'vanilla-strawberry', name: 'فانيليا بالفراولة', description: 'كيك فانيليا مع كريمة وفراولة طازجة.', price: 0, price_status: 'known', sort_order: 10, enabled: true },
      { id: 'chocolate', name: 'شوكولاتة', description: 'كيك شوكولاتة مع جاناش.', price: 0, price_status: 'known', sort_order: 20, enabled: true },
      { id: 'lotus', name: 'لوتس', description: 'كريمة لوتس وبسكويت.', price: null, price_status: 'pending', sort_order: 30, enabled: true },
      { id: 'pistachio', name: 'فستق', description: '', price: null, price_status: 'pending', sort_order: 40, enabled: false },
    ],
    design_extras: [
      { id: 'gold-leaf', name: 'ورق ذهب', description: 'لمسات ورق ذهب صالح للأكل.', price: null, price_status: 'quote', sort_order: 10, enabled: true },
      { id: 'topper', name: 'توبر اسم', description: 'توبر أكريليك بالاسم.', price: 150, price_status: 'known', sort_order: 20, enabled: true },
      { id: 'figure', name: 'مجسم', description: 'مجسم سكر حسب التصميم.', price: null, price_status: 'quote', sort_order: 30, enabled: true },
    ],
    delivery_zones: [
      { id: 'cairo', name: 'القاهرة', enabled: true, sort_order: 10 },
      { id: 'giza', name: 'الجيزة', enabled: true, sort_order: 20 },
      { id: 'alex', name: 'الإسكندرية', enabled: false, sort_order: 30 },
    ],
  }
}

const refImage = readFileSync('src/assets/cakes/' + 'butterflies.jpeg', { flag: 'r' })

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}
const exp = Math.floor(Date.now() / 1000) + 3600
const fakeJwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'qa-admin', role: 'authenticated', email: 'owner@mestika.test', exp })}.qa`
const session = {
  access_token: fakeJwt,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: exp,
  refresh_token: 'qa-refresh',
  user: { id: 'qa-admin', aud: 'authenticated', role: 'authenticated', email: 'owner@mestika.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
}

/** Install Supabase mocks on a context. Returns a log of mutating calls. */
async function mockSupabase(context, opts = {}) {
  const db = fixtures()
  const log = { rpc: [], upserts: [], signed: 0, logout: 0, writesToOrders: 0 }
  const state = { mode: opts.mode || 'normal', isAdmin: opts.isAdmin ?? true, delay: opts.delay || 0 }

  await context.route(/\/(auth|rest|storage)\/v1\//, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()
    if (state.delay) await new Promise((r) => setTimeout(r, state.delay))
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path.includes('/auth/v1/token')) return json(session)
    if (path.includes('/auth/v1/logout')) {
      log.logout++
      return route.fulfill({ status: 204, body: '' })
    }
    if (path.includes('/auth/v1/user')) return json(session.user)

    if (path.endsWith('/rest/v1/rpc/is_admin')) return json(state.isAdmin)
    if (path.endsWith('/rest/v1/rpc/admin_update_order_status')) {
      const body = req.postDataJSON()
      log.rpc.push(body)
      const row = db.orders.find((o) => o.id === body.order_id)
      if (!row) return json({ ok: false, code: 'not_found', message: 'الطلب غير موجود.' })
      // Mirrors admin_update_order_status() in supabase/order-tracking.sql.
      const allowed = {
        pending_review: ['confirmed', 'rejected', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['in_production', 'cancelled'],
        in_production: ['ready'],
        ready: row.service_type === 'delivery' ? ['out_for_delivery'] : ['delivered'],
        out_for_delivery: ['delivered'],
      }[row.status] ?? []
      if (!allowed.includes(body.new_status)) {
        log.invalid = (log.invalid || 0) + 1
        return json({ ok: false, code: 'invalid_transition', message: 'لا يمكن تغيير حالة هذا الطلب بهذه الطريقة.' })
      }
      if (body.new_status === 'rejected' && String(body.reason ?? '').trim().length < 3) {
        return json({ ok: false, code: 'reason_required', message: 'اكتبي سبب رفض الطلب.' })
      }
      row.status = body.new_status
      if (body.new_status === 'rejected') row.rejection_reason = body.reason.trim()
      return json({ ok: true, order: { status: body.new_status } })
    }

    if (path.includes('/storage/v1/object/sign/')) {
      if (method === 'POST') {
        log.signed++
        const objectPath = path.split('/storage/v1/object/sign/')[1]
        return json({ signedURL: `/object/sign/${objectPath}?token=qa-signed` })
      }
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: refImage })
    }

    const table = path.split('/rest/v1/')[1]
    if (!(table in db)) return json({ message: 'not mocked' }, 404)

    if (method === 'GET') {
      if (state.mode === 'error') return json({ message: 'boom', code: 'XX000' }, 500)
      if (state.mode === 'empty') return json([])
      let rows = [...db[table]]
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'or', 'offset'].includes(key)) continue
        const [op, ...rest] = value.split('.')
        const v = rest.join('.')
        if (op === 'eq') rows = rows.filter((r) => String(r[key]) === v)
        if (op === 'gte') rows = rows.filter((r) => String(r[key]) >= v)
        if (op === 'lte') rows = rows.filter((r) => String(r[key]) <= v)
      }
      const or = url.searchParams.get('or')
      if (or) {
        const term = or.match(/ilike\.%([^%]*)%/)?.[1] ?? ''
        rows = rows.filter((r) => [r.order_number, r.customer_name, r.phone].some((f) => String(f).includes(term)))
      }
      if (table === 'orders') rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
      else rows.sort((a, b) => a.sort_order - b.sort_order)
      const limit = Number(url.searchParams.get('limit'))
      if (limit) rows = rows.slice(0, limit)
      return json(rows)
    }

    if (method === 'POST') {
      if (table === 'orders') log.writesToOrders++
      const body = req.postDataJSON()
      const items = Array.isArray(body) ? body : [body]
      for (const item of items) {
        log.upserts.push({ table, item })
        const idx = db[table].findIndex((r) => r.id === item.id)
        if (idx >= 0) db[table][idx] = { ...db[table][idx], ...item }
        else db[table].push(item)
      }
      return route.fulfill({ status: 201, body: '' })
    }
    if (table === 'orders') log.writesToOrders++
    return json({ message: 'method not mocked' }, 405)
  })
  return { log, state, db }
}

async function login(page) {
  await page.goto(`${BASE}/#/admin/login`, { waitUntil: 'networkidle' })
  await page.fill('#admin-email', 'owner@mestika.test')
  await page.fill('#admin-password', 'not-a-real-password')
  await page.click('button[type="submit"]')
  await page.waitForURL(/#\/admin$/, { timeout: 10000 })
}

async function measure(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const overflow = document.documentElement.scrollWidth > vw + 1
    const offenders = overflow
      ? [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed'
          })
          .slice(0, 5)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`)
      : []
    const small = [...document.querySelectorAll('main button, main a[href], main input, main select, header button, header a[href]')]
      .filter((el) => {
        if (el.closest('.sr-only') || el.classList.contains('sr-only')) return false
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return false
        const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
        return !inline && (r.height < 40 || r.width < 40)
      })
      .slice(0, 6)
      .map((el) => `${el.tagName}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
    return { overflow, scrollWidth: document.documentElement.scrollWidth, vw, offenders, small }
  })
}

const ROUTES = [
  ['home', '/admin'],
  ['orders', '/admin/orders'],
  ['order-detail', '/admin/orders/00000000-0000-0000-0000-000000000001'],
  ['cakes', '/admin/cakes'],
  ['sizes', '/admin/sizes'],
  ['fillings', '/admin/fillings'],
  ['extras', '/admin/extras'],
  ['zones', '/admin/zones'],
]
const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440]
const SHOT_WIDTHS = [1440, 1280, 768, 390]

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => !document.querySelector('[role="status"] .animate-pulse, .animate-pulse'), null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(150)
}

async function main() {
  const browser = await chromium.launch()

  // 1. Unauthorized user stays blocked.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await mockSupabase(context, { isAdmin: false })
    const page = await context.newPage()
    await page.goto(`${BASE}/#/admin/orders`, { waitUntil: 'networkidle' })
    if (/#\/admin\/login/.test(page.url())) ok('unauthenticated visit to /admin/orders redirects to login')
    else note(`unauthenticated visit not redirected: ${page.url()}`)
    await page.fill('#admin-email', 'someone@else.test')
    await page.fill('#admin-password', 'x')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(800)
    const alert = await page.locator('[role="alert"]').innerText().catch(() => '')
    if (/#\/admin\/login/.test(page.url()) && alert.includes('غير مصر')) ok(`non-admin login blocked with message: "${alert.trim()}"`)
    else note(`non-admin login not blocked (url=${page.url()}, alert=${alert})`)
    await page.screenshot({ path: join(OUT, 'login-blocked-1280.png') })
    await context.close()
  }

  // 2. Login screen renders at each width.
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await mockSupabase(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/#/admin/login`, { waitUntil: 'networkidle' })
    const m = await measure(page)
    if (m.overflow) note(`login overflow at ${width}: ${m.offenders.join(', ')}`)
    await page.screenshot({ path: join(OUT, `login-${width}.png`) })
    await context.close()
  }

  // 3. Main authenticated session.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const { log } = await mockSupabase(context)
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await login(page)
  ok('admin login works and lands on /admin')

  // Overflow + touch target sweep; screenshots.
  for (const [name, route] of ROUTES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
      await settle(page)
      const m = await measure(page)
      if (m.overflow) note(`${name} horizontal overflow at ${width} (scrollWidth ${m.scrollWidth}): ${m.offenders.join(' | ')}`)
      if (m.small.length && width <= 430) note(`${name} small touch targets at ${width}: ${m.small.join(' | ')}`)
      if (SHOT_WIDTHS.includes(width)) await page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true })
    }
  }
  ok(`swept ${ROUTES.length} routes × ${WIDTHS.length} widths`)

  // Sidebar active state + title.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/#/admin/sizes`, { waitUntil: 'networkidle' })
  const active = await page.locator('aside a[aria-current="page"]').innerText()
  if (active.includes('المقاسات والأسعار')) ok('sidebar marks current route as aria-current')
  else note(`sidebar active state wrong: ${active}`)

  // Orders: status chip filter, search, URL params.
  await page.goto(`${BASE}/#/admin/orders`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'قيد المراجعة', exact: true }).click()
  await settle(page)
  const pendingRows = await page.locator('table tbody tr').count()
  if (page.url().includes('status=pending_review') && pendingRows === 3) ok('orders status filter applies (3 pending rows, URL updated)')
  else note(`orders status filter: url=${page.url()} rows=${pendingRows}`)
  await page.fill('#filter-search', 'منى')
  await page.getByRole('button', { name: 'بحث', exact: true }).click()
  await settle(page)
  const searchRows = await page.locator('table tbody tr').count()
  if (searchRows === 1) ok('orders search narrows to 1 row')
  else note(`orders search rows=${searchRows}`)
  await page.getByRole('button', { name: 'مسح التصفية' }).first().click()
  await settle(page)
  if ((await page.locator('table tbody tr').count()) === 9) ok('clear filters restores 9 orders')
  else note('clear filters did not restore all orders')

  // Dashboard stat card deep link.
  await page.goto(`${BASE}/#/admin`, { waitUntil: 'networkidle' })
  await settle(page)
  const statText = await page.locator('section[aria-label="إحصاءات الطلبات"]').innerText()
  if (statText.includes('9') && statText.includes('قيد المراجعة') && statText.includes('طلبات اليوم')) ok('dashboard stats render')
  else note(`dashboard stats text: ${statText}`)
  await page.locator('section[aria-label="إحصاءات الطلبات"] a', { hasText: 'طلبات اليوم' }).click()
  await settle(page)
  if (page.url().includes('date=today') && (await page.locator('table tbody tr').count()) === 2) ok('“طلبات اليوم” card opens orders filtered to today (2)')
  else note(`today deep link: ${page.url()}`)

  // Order details: signed URL preview + status change through RPC with confirmation.
  await page.goto(`${BASE}/#/admin/orders/00000000-0000-0000-0000-000000000001`, { waitUntil: 'networkidle' })
  await settle(page)
  const imgOk = await page.locator('img[alt="الصورة المرجعية للطلب"]').evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false)
  if (imgOk && log.signed >= 1) ok('reference image loads via signed URL (createSignedUrl called)')
  else note(`signed image failed (signed calls=${log.signed}, loaded=${imgOk})`)
  await page.getByRole('button', { name: 'تأكيد الطلب', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor()
  const dialogText = await dialog.innerText()
  await page.screenshot({ path: join(OUT, 'confirm-status-1440.png') })
  // Focus trap: Tab cycles inside the dialog.
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  const focusInside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="alertdialog"]')))
  if (focusInside) ok('confirmation dialog traps keyboard focus')
  else note('focus escaped confirmation dialog')
  await page.keyboard.press('Escape')
  if (!(await dialog.isVisible().catch(() => false)) && log.rpc.length === 0) ok('Escape cancels confirmation without calling RPC')
  else note('Escape did not cancel cleanly')
  await page.getByRole('button', { name: 'تأكيد الطلب', exact: true }).click()
  await dialog.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await page.getByText('تم تحديث حالة الطلب بنجاح').waitFor({ timeout: 5000 })
  const last = log.rpc.at(-1)
  if (last?.order_id === '00000000-0000-0000-0000-000000000001' && last?.new_status === 'confirmed' && log.writesToOrders === 0)
    ok('status update goes through admin_update_order_status RPC only (no direct orders writes)')
  else note(`status RPC payload unexpected: ${JSON.stringify(last)} writes=${log.writesToOrders}`)
  if (dialogText.includes('تم التأكيد')) ok('confirmation copy explains the consequence')
  else note(`confirmation copy: ${dialogText}`)
  await page.screenshot({ path: join(OUT, 'order-detail-after-confirm-1440.png'), fullPage: true })

  // Full lifecycle on a delivery order: each step offers only the next allowed status.
  const lifecycle = [
    ['preparing', 'جاري التجهيز'],
    ['in_production', 'جاري التصنيع'],
    ['ready', 'جاهز'],
    ['out_for_delivery', 'خرج للتوصيل'],
    ['delivered', 'تم التسليم'],
  ]
  let lifecycleOk = true
  for (const [status, label] of lifecycle) {
    const button = page.getByRole('button', { name: `تغيير إلى «${label}»`, exact: true })
    if (!(await button.count())) {
      lifecycleOk = false
      note(`lifecycle: no button for ${status}`)
      break
    }
    const forwardButtons = await page.getByRole('group', { name: 'الحالات التالية المتاحة' }).getByRole('button', { name: /^تغيير إلى/ }).count()
    if (forwardButtons !== 1) {
      lifecycleOk = false
      note(`lifecycle: ${forwardButtons} forward buttons before ${status}`)
    }
    await button.click()
    await dialog.getByRole('button', { name: `تغيير إلى «${label}»` }).click()
    await page.getByText('تم تحديث حالة الطلب بنجاح').first().waitFor({ timeout: 5000 })
    await settle(page)
    if (log.rpc.at(-1)?.new_status !== status) {
      lifecycleOk = false
      note(`lifecycle RPC payload: ${JSON.stringify(log.rpc.at(-1))}`)
    }
  }
  const terminalActions = await page.getByRole('group', { name: 'الحالات التالية المتاحة' }).count()
  if (lifecycleOk && terminalActions === 0 && !log.invalid)
    ok('admin lifecycle confirmed → preparing → in_production → ready → out_for_delivery → delivered; delivered has no actions')
  else note(`lifecycle failed (terminalActions=${terminalActions}, invalid=${log.invalid || 0})`)
  await page.screenshot({ path: join(OUT, 'order-detail-delivered-1440.png'), fullPage: true })

  await page.goto(`${BASE}/#/admin/orders/00000000-0000-0000-0000-000000000003`, { waitUntil: 'networkidle' })
  await settle(page)
  const confirmedCancel = await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).count()
  if (confirmedCancel === 1) ok('confirmed order offers admin cancellation')
  else note(`confirmed cancel buttons=${confirmedCancel}`)

  // Rejection requires a reason, which is sent to the RPC.
  await page.goto(`${BASE}/#/admin/orders/00000000-0000-0000-0000-000000000002`, { waitUntil: 'networkidle' })
  await settle(page)
  const rpcBefore = log.rpc.length
  await page.getByRole('button', { name: 'رفض الطلب', exact: true }).click()
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'رفض الطلب' }).click()
  const reasonErr = await dialog.innerText()
  if (reasonErr.includes('اكتبي سبب الرفض') && log.rpc.length === rpcBefore) ok('rejecting without a reason is blocked client-side')
  else note('empty rejection reason was not blocked')
  await page.screenshot({ path: join(OUT, 'reject-reason-1440.png') })
  await dialog.getByLabel('سبب الرفض').fill('الموعد المطلوب غير متاح لهذا الحجم')
  await dialog.getByRole('button', { name: 'رفض الطلب' }).click()
  await page.getByText('تم تحديث حالة الطلب بنجاح').first().waitFor({ timeout: 5000 })
  await settle(page)
  const rej = log.rpc.at(-1)
  const rejText = await page.locator('main').innerText()
  if (rej?.new_status === 'rejected' && rej?.reason === 'الموعد المطلوب غير متاح لهذا الحجم' && rejText.includes('سبب الرفض'))
    ok('rejection reason is sent to admin_update_order_status and shown on the order')
  else note(`rejection payload: ${JSON.stringify(rej)}`)

  // Catalog CRUD: validation, edit save payload, disable confirmation.
  await page.goto(`${BASE}/#/admin/sizes`, { waitUntil: 'networkidle' })
  await settle(page)
  await page.getByRole('button', { name: 'إضافة مقاس' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click()
  const errs = await page.getByRole('dialog').innerText()
  if (errs.includes('أدخلي المعرّف') && errs.includes('أدخلي اسم المقاس') && log.upserts.length === 0) ok('required-field validation blocks save and shows inline errors')
  else note('validation did not show inline errors')
  await page.screenshot({ path: join(OUT, 'sizes-validation-1440.png') })
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click()

  await page.getByRole('button', { name: 'تعديل 24 سم' }).click()
  await page.fill('#size-price', '1100')
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click()
  await page.getByText('عملية الحفظ تمت بنجاح').waitFor({ timeout: 5000 })
  const saved = log.upserts.at(-1)
  if (saved?.table === 'cake_sizes' && saved.item.id === 'single-24' && saved.item.price === 1100 && saved.item.enabled === true)
    ok('size edit saves via cake_sizes upsert with unchanged payload shape')
  else note(`size upsert payload unexpected: ${JSON.stringify(saved)}`)

  await page.getByRole('button', { name: 'تعديل 24 سم' }).click()
  await page.getByRole('switch').click()
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click()
  const disableDialog = page.getByRole('alertdialog')
  await disableDialog.waitFor()
  await page.screenshot({ path: join(OUT, 'sizes-disable-confirm-1440.png') })
  const before = log.upserts.length
  await disableDialog.getByRole('button', { name: 'رجوع للتعديل' }).click()
  if (log.upserts.length === before && (await page.getByRole('dialog').isVisible())) ok('disable confirmation can be backed out without saving')
  else note('backing out of disable confirmation saved or closed editor')
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'تعطيل وحفظ' }).click()
  await page.getByText('عملية الحفظ تمت بنجاح').waitFor({ timeout: 5000 })
  if (log.upserts.at(-1)?.item.enabled === false) ok('confirmed disable saves enabled=false (soft-disable)')
  else note('disable did not save enabled=false')

  for (const [route, table, editName] of [
    ['/admin/cakes', 'cakes', 'تعديل تورتة الورد'],
    ['/admin/fillings', 'fillings', 'تعديل لوتس'],
    ['/admin/extras', 'design_extras', 'تعديل مجسم'],
    ['/admin/zones', 'delivery_zones', 'تعديل الجيزة'],
  ]) {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
    await settle(page)
    await page.getByRole('button', { name: editName }).click()
    await page.getByRole('dialog').waitFor()
    if (table === 'cakes') await page.screenshot({ path: join(OUT, 'cakes-editor-1440.png') })
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click()
    await page.getByText('عملية الحفظ تمت بنجاح').waitFor({ timeout: 5000 })
    if (log.upserts.at(-1)?.table === table) ok(`${table} edit saves through its upsert`)
    else note(`${table} save did not reach upsert`)
  }

  // Client-side catalog search.
  await page.goto(`${BASE}/#/admin/fillings`, { waitUntil: 'networkidle' })
  await settle(page)
  await page.fill('#fill-search', 'شوك')
  if ((await page.locator('table tbody tr').count()) === 1) ok('catalog search filters rows')
  else note('catalog search did not filter')

  // Mobile drawer.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/#/admin`, { waitUntil: 'networkidle' })
  await settle(page)
  if (!(await page.locator('aside').isVisible())) ok('desktop sidebar hidden on mobile')
  await page.getByRole('button', { name: 'فتح القائمة' }).click()
  const drawer = page.getByRole('dialog', { name: 'قائمة لوحة التحكم' })
  await drawer.waitFor()
  await page.screenshot({ path: join(OUT, 'drawer-390.png') })
  await page.keyboard.press('Escape')
  if (!(await drawer.isVisible().catch(() => false))) ok('drawer closes on Escape')
  else note('drawer did not close on Escape')
  await page.getByRole('button', { name: 'فتح القائمة' }).click()
  await drawer.getByRole('link', { name: 'الحشوات' }).click()
  await page.waitForURL(/#\/admin\/fillings/)
  if (!(await drawer.isVisible().catch(() => false))) ok('drawer navigation works and closes drawer')
  else note('drawer stayed open after navigation')

  // Mobile editor sheet.
  await settle(page)
  await page.getByRole('button', { name: 'تعديل لوتس' }).click()
  await page.getByRole('dialog').waitFor()
  await page.screenshot({ path: join(OUT, 'fillings-editor-390.png') })
  const sheet = await measure(page)
  if (sheet.overflow) note('editor overflows at 390')
  await page.keyboard.press('Escape')

  // Logout.
  await page.getByRole('button', { name: 'فتح القائمة' }).click()
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await page.waitForURL(/#\/admin\/login/, { timeout: 5000 })
  if (log.logout >= 1) ok('logout signs out and returns to login')
  else note('logout did not call auth logout')
  await page.goto(`${BASE}/#/admin`, { waitUntil: 'networkidle' })
  if (/#\/admin\/login/.test(page.url())) ok('after logout /admin redirects to login')
  else note('after logout /admin still accessible')

  if (consoleErrors.length) note(`page errors: ${consoleErrors.join(' | ')}`)
  await context.close()

  // 4. Loading, empty and error states.
  for (const [mode, label, delay] of [['normal', 'loading', 4000], ['empty', 'empty', 0], ['error', 'error', 0]]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const mock = await mockSupabase(ctx)
    const p = await ctx.newPage()
    await login(p)
    mock.state.mode = mode
    mock.state.delay = delay
    for (const [name, route] of [['home', '/admin'], ['orders', '/admin/orders'], ['fillings', '/admin/fillings']]) {
      await p.goto(`${BASE}/#${route}`)
      if (label === 'loading') await p.waitForTimeout(700)
      else await settle(p)
      await p.screenshot({ path: join(OUT, `${label}-${name}-1280.png`) })
      const text = await p.locator('main').innerText()
      const expected = label === 'loading' ? null : label === 'empty' ? 'لا توجد' : 'إعادة المحاولة'
      if (label === 'loading') {
        const skeletons = await p.locator('.animate-pulse').count()
        if (skeletons > 0) ok(`${name} shows skeleton while loading`)
        else note(`${name} has no loading skeleton`)
      } else if (text.includes(expected)) ok(`${name} ${label} state renders`)
      else note(`${name} ${label} state missing "${expected}"`)
    }
    await ctx.close()
  }

  await browser.close()
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ passes, issues }, null, 2))
  console.log(`\n=== ADMIN UI QA === passes: ${passes.length}  issues: ${issues.length}`)
  if (issues.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
