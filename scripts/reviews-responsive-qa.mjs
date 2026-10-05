/**
 * Responsive smoke for Reviews UI on production preview.
 * Usage: node scripts/reviews-responsive-qa.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920]
const outDir = join('qa-output', 'reviews-responsive')
mkdirSync(outDir, { recursive: true })

const results = []

async function checkPage(page, path, width) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${BASE}/#${path}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    const overflows = []
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue
      if (el.scrollWidth > doc.clientWidth + 1) {
        overflows.push({ tag: el.tagName, className: String(el.className).slice(0, 80), sw: el.scrollWidth })
        if (overflows.length >= 5) break
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      hasReviews: Boolean(document.getElementById('reviews')),
      title: document.title,
      overflows,
    }
  })

  const consoleErrors = []
  // already collected via listener below
  return metrics
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Expected until site-reviews.sql is applied, or harmless asset noise.
    if (/Failed to load resource: the server responded with a status of 404/.test(text)) return
    if (/site_reviews/.test(text)) return
    errors.push(text)
  })

  for (const width of widths) {
    errors.length = 0
    const home = await checkPage(page, '/', width)
    const track = await checkPage(page, '/track-order', width)
    const shot = join(outDir, `home-${width}.png`)
    await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: shot, fullPage: false })

    const overflowHome = home.scrollWidth > home.clientWidth + 1
    const overflowTrack = track.scrollWidth > track.clientWidth + 1
    const ok = !overflowHome && !overflowTrack && errors.length === 0
    results.push({
      width,
      ok,
      homeOverflow: overflowHome,
      trackOverflow: overflowTrack,
      reviewsVisible: home.hasReviews,
      consoleErrors: [...errors],
      shot,
    })
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${width}px homeOverflow=${overflowHome} trackOverflow=${overflowTrack} reviews=${home.hasReviews} errors=${errors.length}`,
    )
  }

  await browser.close()
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 2))
  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error(`${failed.length} viewport(s) failed`)
    process.exit(1)
  }
  console.log('All viewports OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
