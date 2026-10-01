/**
 * QA for the hero typing animation: layout stability, overflow, loop,
 * reduced motion, and no duplicate timers after navigation.
 * Usage: QA_BASE=http://127.0.0.1:4198 node scripts/hero-typing-qa.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:4198'
const OUT = 'qa-output/hero-typing'
mkdirSync(OUT, { recursive: true })
const TEXT = 'مستكة في كل تفاصيلها'
let failures = 0
const ok = (d) => console.log(`[PASS] ${d}`)
const fail = (d) => {
  failures++
  console.log(`[FAIL] ${d}`)
}

const typed = (page) => page.evaluate(() => document.querySelector('[data-text-type]')?.textContent ?? null)
const geometry = (page) =>
  page.evaluate(() => {
    const h1 = document.querySelector('main h1')
    const btn = document.querySelector('main a[href$="/order"]')
    const r = h1.getBoundingClientRect()
    return {
      h1: [Math.round(r.top), Math.round(r.height), Math.round(r.width)],
      btn: Math.round(btn.getBoundingClientRect().top),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })

const browser = await chromium.launch()

for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const samples = []
  for (let i = 0; i < 14; i++) {
    samples.push({ text: await typed(page), ...(await geometry(page)) })
    await page.waitForTimeout(250)
  }
  const stable = samples.every((s) => JSON.stringify([s.h1, s.btn]) === JSON.stringify([samples[0].h1, samples[0].btn]))
  const lengths = samples.map((s) => (s.text ?? '').length)
  const growing = new Set(lengths).size > 1
  const prefixOk = samples.every((s) => TEXT.startsWith(s.text ?? 'x'))
  if (stable && growing && prefixOk && !samples.some((s) => s.overflow))
    ok(`${width}px: heading/buttons fixed while typing (${lengths[0]}→${lengths.at(-1)} chars), no overflow`)
  else fail(`${width}px stable=${stable} growing=${growing} prefix=${prefixOk} ${JSON.stringify(samples.map((s) => [s.text?.length, s.h1, s.btn, s.overflow]))}`)
  if ([360, 390, 1440].includes(width)) {
    await page.waitForFunction((t) => document.querySelector('[data-text-type]')?.textContent === t, TEXT, { timeout: 6000 })
    await page.screenshot({ path: join(OUT, `hero-full-${width}.png`) })
  }
  await page.close()
}

// Full loop: types fully, deletes to empty, types again.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForFunction((t) => document.querySelector('[data-text-type]')?.textContent === t, TEXT, { timeout: 6000 })
  const fullAt = Date.now()
  await page.screenshot({ path: join(OUT, 'hero-full-1280.png') })
  await page.waitForFunction(() => document.querySelector('[data-text-type]')?.textContent === '', null, { timeout: 8000 })
  const pause = Date.now() - fullAt
  await page.waitForFunction(() => (document.querySelector('[data-text-type]')?.textContent ?? '').length >= 3, null, { timeout: 4000 })
  ok(`loop: full → pause → delete to empty (${pause}ms incl. pause) → types again`)

  // Navigate away and back: one animation, normal speed (no doubled timers).
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/#/catalog`)
    await page.waitForTimeout(200)
    await page.goto(`${BASE}/#/`)
  }
  await page.waitForTimeout(500)
  const instances = await page.locator('[data-text-type]').count()
  const a = (await typed(page)).length
  await page.waitForTimeout(1100)
  const b = (await typed(page)).length
  const rate = b - a
  if (instances === 1 && rate >= 7 && rate <= 12) ok(`after navigating away/back: 1 instance, normal speed (+${rate} chars in 1.1s)`)
  else fail(`after navigation: instances=${instances} rate=${rate}`)
  const label = await page.locator('main h1').evaluate((h) => h.querySelector('.sr-only')?.textContent)
  if (label === TEXT) ok('h1 keeps the full text for screen readers')
  else fail(`screen-reader text: ${label}`)
  await page.close()
}

// Reduced motion: complete static text, no cursor, no change.
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 860 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  const t1 = await page.locator('main h1').innerText()
  await page.waitForTimeout(1500)
  const t2 = await page.locator('main h1').innerText()
  const cursor = await page.locator('.text-type-cursor').count()
  if (t1.trim() === TEXT && t2 === t1 && cursor === 0) ok('reduced motion: full static heading, no cursor, no animation')
  else fail(`reduced motion: "${t1}" / "${t2}" cursor=${cursor}`)
  await page.screenshot({ path: join(OUT, 'hero-reduced-390.png') })
  await ctx.close()
}

await browser.close()
console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)
