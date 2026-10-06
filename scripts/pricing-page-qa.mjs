/**
 * Public pricing page responsive QA (Admin-managed sections).
 * Usage: node scripts/pricing-page-qa.mjs
 * Requires: npx vite preview --host 127.0.0.1 --port 4173
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920]
const outDir = join('qa-output', 'pricing-page')
mkdirSync(outDir, { recursive: true })

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  const results = []

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('#pricing h3', { timeout: 15000 }).catch(() => {})
    const m = await page.evaluate(() => {
      const doc = document.documentElement
      const root = document.querySelector('#pricing')
      const cards = [...(root?.querySelectorAll('h3') ?? [])].map((h) => h.textContent?.trim() ?? '')
      const rows = root?.querySelectorAll('ul li') ?? []
      const prices = [...rows].map((li) => li.textContent ?? '').filter((t) => /ج\.م|EGP|اطلب السعر|\d/.test(t))
      const halfCards = [...(root?.querySelectorAll('h3') ?? [])].map((h) => h.parentElement?.getBoundingClientRect().width ?? 0)
      return {
        overflow: doc.scrollWidth > doc.clientWidth + 1,
        cards,
        rows: rows.length,
        prices: prices.length,
        widest: Math.max(0, ...halfCards),
        narrowest: Math.min(...halfCards.filter(Boolean)),
      }
    })
    const hasCakes = m.cards.some((t) => t.includes('التورت'))
    const sideBySide = width >= 1024 ? m.narrowest < m.widest * 0.75 : true
    const ok = !m.overflow && m.cards.length > 0 && m.prices > 0 && hasCakes && sideBySide
    results.push(ok)
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${width} overflow=${m.overflow} sections=${m.cards.length} rows=${m.rows} priced=${m.prices} cakes=${hasCakes} halfColumns=${sideBySide}`,
    )
    await page.screenshot({ path: join(outDir, `pricing-${width}.png`), fullPage: true })
  }

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}/#/admin/pricing`, { waitUntil: 'networkidle' })
  const adminReachable =
    (await page.getByText('الأسعار').count()) + (await page.locator('input[type="email"], input[type="password"]').count()) > 0
  console.log(`${adminReachable ? 'PASS' : 'FAIL'} admin_pricing_route_reachable`)
  await page.goto(`${BASE}/#/admin/cakes`, { waitUntil: 'networkidle' })
  console.log(`INFO legacy /admin/cakes → ${page.url().split('#')[1]}`)

  console.log(errors.length ? `FAIL page_errors ${errors.join(' | ')}` : 'PASS no_page_errors')
  await browser.close()
  if (results.some((r) => !r) || !adminReachable || errors.length) process.exit(1)
  console.log('All pricing page QA checks OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
