/**
 * Products catalog responsive QA (منتجاتنا filters + overflow).
 * Usage: node scripts/products-catalog-qa.mjs
 * Requires: npx vite preview --host 127.0.0.1 --port 4173
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920]
const outDir = join('qa-output', 'products-catalog')
mkdirSync(outDir, { recursive: true })

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const results = []

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${BASE}/#/catalog`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(600)

    const heading = await page.getByRole('heading', { name: 'منتجاتنا' }).count()
    const navLabel = await page.getByRole('link', { name: 'منتجاتنا' }).count()
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        overflow: doc.scrollWidth > doc.clientWidth + 1,
        filters: [...document.querySelectorAll('[aria-label="تصفية المنتجات"] button')].map((b) => b.textContent?.trim()),
        productCards: document.querySelectorAll('article').length,
      }
    })

    // Click first non-all filter if present
    const filterButtons = page.locator('[aria-label="تصفية المنتجات"] button')
    const filterCount = await filterButtons.count()
    if (filterCount > 1) {
      await filterButtons.nth(1).click()
      await page.waitForTimeout(300)
    }

    const ok = heading > 0 && navLabel > 0 && !metrics.overflow
    results.push({ width, ok, heading, navLabel, ...metrics })
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${width} overflow=${metrics.overflow} heading=${heading} nav=${navLabel} filters=${metrics.filters?.length ?? 0} cards=${metrics.productCards}`,
    )
    await page.screenshot({ path: join(outDir, `catalog-${width}.png`), fullPage: true })
  }

  // Admin products route requires auth — only verify redirect/login shell loads.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}/#/admin/products`, { waitUntil: 'networkidle' })
  const adminShell =
    (await page.getByText('المنتجات').count()) +
    (await page.getByText('تسجيل الدخول').count()) +
    (await page.locator('input[type="email"], input[type="password"]').count())
  const adminOk = adminShell > 0
  console.log(`${adminOk ? 'PASS' : 'FAIL'} admin_products_route_reachable`)

  await browser.close()
  if (results.some((r) => !r.ok) || !adminOk) process.exit(1)
  console.log('All products catalog QA checks OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
