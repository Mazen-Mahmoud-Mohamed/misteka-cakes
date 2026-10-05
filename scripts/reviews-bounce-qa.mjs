/**
 * Bounce Cards Reviews visual QA.
 * Usage: node scripts/reviews-bounce-qa.mjs
 * Requires: npx vite preview --host 127.0.0.1 --port 4173
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920]
/** Must match REVIEWS_AUTOPLAY_MS in ReviewsSection.tsx (+ buffer) */
const AUTOPLAY_WAIT_MS = 5500
const outDir = join('qa-output', 'reviews-bounce')
mkdirSync(outDir, { recursive: true })
const results = []

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const t = msg.text()
    if (/404|Failed to load resource/.test(t)) return
    errors.push(t)
  })

  for (const width of widths) {
    errors.length = 0
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)

    const reviews = page.locator('#reviews')
    const hasReviews = (await reviews.count()) > 0
    if (hasReviews) {
      await reviews.scrollIntoViewIfNeeded()
      await page.waitForTimeout(900)
    }

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const section = document.getElementById('reviews')
      const stack = document.querySelector('.mestika-bounce-stack')
      const cards = [...document.querySelectorAll('.mestika-bounce-card')]
      let cardsOutside = 0
      if (stack && section) {
        const sb = section.getBoundingClientRect()
        for (const c of cards) {
          const r = c.getBoundingClientRect()
          if (r.left < -2 || r.right > doc.clientWidth + 2) cardsOutside += 1
          if (r.top < sb.top - 48 || r.bottom > sb.bottom + 48) cardsOutside += 1
        }
      }
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasReviews: Boolean(section),
        hasStack: Boolean(stack),
        cardCount: cards.length,
        cardsOutside,
        heading: section?.querySelector('h2')?.textContent?.trim() ?? null,
      }
    })

    const shot = join(outDir, `reviews-${width}.png`)
    if (hasReviews) await reviews.screenshot({ path: shot })
    else await page.screenshot({ path: shot, fullPage: false })

    let lightboxOk = null
    let hoverOk = null
    let autoplayOk = null
    if (width === 1280 && metrics.hasReviews) {
      const storyCounter = page.locator('#reviews .tabular-nums').first()
      const hasCounter = (await storyCounter.count()) > 0
      if (hasCounter) {
        const before = (await storyCounter.textContent()) ?? ''
        const totalMatch = before.match(/\d+\s+من\s+(\d+)/)
        const totalStories = totalMatch ? Number(totalMatch[1]) : 0
        if (totalStories >= 2) {
          await page.locator('.reviews-story-autoplay[data-autoplay="on"]').waitFor({ timeout: 20000 })
          const beforeTick = (await storyCounter.textContent()) ?? ''
          await page.waitForTimeout(AUTOPLAY_WAIT_MS)
          const after = (await storyCounter.textContent()) ?? ''
          const advanced = beforeTick !== after
          autoplayOk = advanced

          const atOpen = after
          await page.locator('.mestika-bounce-card').first().click()
          await page.waitForTimeout(AUTOPLAY_WAIT_MS + 500)
          const duringLb = (await storyCounter.textContent()) ?? ''
          const lbPaused = atOpen === duringLb
          await page.keyboard.press('Escape')
          await page.waitForTimeout(300)
          await page.mouse.move(0, 0)
          await page.waitForTimeout(200)
          await page.waitForTimeout(AUTOPLAY_WAIT_MS)
          const afterClose = (await storyCounter.textContent()) ?? ''
          autoplayOk = autoplayOk && lbPaused && afterClose !== duringLb
        } else {
          autoplayOk = null
        }
      }
    }

    if (width === 1280 && metrics.cardCount > 0) {
      const fanCount = await page.locator('.mestika-bounce-fan').count()
      const hoverTarget = page.locator('.mestika-bounce-fan').nth(Math.min(1, Math.max(0, fanCount - 1)))
      await hoverTarget.hover()
      await page.waitForTimeout(450)
      const hoverMetrics = await page.evaluate(() => {
        const doc = document.documentElement
        const fans = [...document.querySelectorAll('.mestika-bounce-fan')]
        const active = document.querySelector('.mestika-bounce-fan[data-active="true"]')
        const overflow = doc.scrollWidth > doc.clientWidth + 1
        let outside = 0
        for (const el of fans) {
          const r = el.getBoundingClientRect()
          if (r.left < -4 || r.right > doc.clientWidth + 4) outside += 1
        }
        return {
          hasActive: Boolean(active),
          overflow,
          outside,
          activeZ: active ? Number(getComputedStyle(active).zIndex) : 0,
        }
      })
      hoverOk =
        hoverMetrics.hasActive &&
        !hoverMetrics.overflow &&
        hoverMetrics.outside === 0 &&
        hoverMetrics.activeZ >= 40

      await page.locator('.mestika-bounce-fan[data-active="true"] .mestika-bounce-card').click()
      await page.waitForTimeout(400)
      lightboxOk = (await page.locator('[role="dialog"][aria-label="عرض صورة الشهادة"]').count()) > 0
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)

      await page.mouse.move(0, 0)
      await page.waitForTimeout(250)
      const cleared = await page.locator('.mestika-bounce-fan[data-active="true"]').count()
      if (cleared !== 0) hoverOk = false
    }

    let reducedOk = null
    if (width === 390 && metrics.hasStack) {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      if ((await page.locator('#reviews').count()) > 0) {
        await page.locator('#reviews').scrollIntoViewIfNeeded()
        await page.waitForTimeout(400)
      }
      reducedOk = await page.evaluate(() => {
        const card = document.querySelector('.mestika-bounce-card')
        const fan = document.querySelector('.mestika-bounce-fan')
        if (!card || !fan) return false
        const cs = getComputedStyle(card)
        const fanCs = getComputedStyle(fan)
        const cardOk =
          cs.animationName === 'none' ||
          cs.animationDuration === '0s' ||
          (Number.parseFloat(cs.opacity) === 1 && cs.transform.includes('matrix'))
        const fanOk = fanCs.transitionDuration === '0s' || fanCs.transitionProperty === 'none'
        const autoplayOff =
          document.querySelector('.reviews-story-autoplay')?.getAttribute('data-autoplay') === 'off'
        return cardOk && fanOk && autoplayOff
      })
      const rmCounter = page.locator('#reviews .tabular-nums').first()
      if ((await rmCounter.count()) > 0) {
        const rmBefore = (await rmCounter.textContent()) ?? ''
        await page.waitForTimeout(AUTOPLAY_WAIT_MS + 500)
        const rmAfter = (await rmCounter.textContent()) ?? ''
        if (rmBefore !== rmAfter) reducedOk = false
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' })
    }

    const overflow = metrics.scrollWidth > metrics.clientWidth + 1
    const ok =
      !overflow &&
      errors.length === 0 &&
      metrics.cardsOutside === 0 &&
      (hoverOk === null || hoverOk === true) &&
      (autoplayOk === null || autoplayOk === true)
    results.push({
      width,
      ok,
      overflow,
      ...metrics,
      lightboxOk,
      hoverOk,
      autoplayOk,
      reducedOk,
      errors: [...errors],
      shot,
    })
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${width} overflow=${overflow} reviews=${metrics.hasReviews} cards=${metrics.cardCount} outside=${metrics.cardsOutside} lb=${lightboxOk} hover=${hoverOk} autoplay=${autoplayOk} rm=${reducedOk} err=${errors.length}`,
    )
  }

  await page.goto(`${BASE}/#/admin/reviews`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const adminBounce = await page.locator('.mestika-bounce-stack').count()
  results.push({ check: 'admin_no_bounce', ok: adminBounce === 0, adminBounce })
  console.log(`${adminBounce === 0 ? 'PASS' : 'FAIL'} admin_no_bounce count=${adminBounce}`)

  await browser.close()
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 2))
  const failed = results.filter((r) => r.ok === false)
  if (failed.length) {
    console.error(`${failed.length} failed`)
    process.exit(1)
  }
  console.log('All bounce QA checks OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
