import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173'
const WIDTHS = [360, 390, 430, 768, 1024, 1440]
const issues = []

function note(severity, detail) {
  issues.push({ severity, detail })
  console.log(`[${severity}] ${detail}`)
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

function iso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const overflowing = [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (!(el instanceof HTMLElement)) return false
        if (el.matches('.skip-link, .sr-only, [aria-hidden="true"]')) return false
        const style = getComputedStyle(el)
        if (style.position === 'fixed' || style.position === 'sticky') return false
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return false
        return el.scrollWidth > el.clientWidth + 2 || rect.right > window.innerWidth + 1 || rect.left < -1
      })
      .slice(0, 8)
      .map((el) => `${el.tagName}.${(el.className || '').toString().slice(0, 50)}`)
    return {
      overflow: doc.scrollWidth > window.innerWidth + 1 || body.scrollWidth > window.innerWidth + 1,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      innerWidth: window.innerWidth,
      dir: document.documentElement.getAttribute('dir'),
      lang: document.documentElement.getAttribute('lang'),
      overflowing,
    }
  })
}

async function tinyButtons(page) {
  return page.evaluate(() => {
    const targets = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
    return targets
      .filter((el) => {
        if (el.matches('.skip-link, .sr-only')) return false
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return false
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') return false
        // Ignore visually clipped accessibility helpers
        if (r.width < 2 && r.height < 2) return false
        return r.height < 40
      })
      .slice(0, 10)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return `${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.textContent || '').trim().slice(0, 30)}`
      })
  })
}

async function stretchedImages(page) {
  return page.evaluate(() => {
    return [...document.images]
      .filter((img) => img.naturalWidth > 0 && img.clientWidth > 0)
      .filter((img) => {
        const nw = img.naturalWidth / img.naturalHeight
        const dw = img.clientWidth / img.clientHeight
        const fit = getComputedStyle(img).objectFit
        if (fit === 'cover' || fit === 'contain') return false
        return Math.abs(nw - dw) > 0.35
      })
      .map((img) => img.alt || img.src.slice(-40))
  })
}

async function dumpPrices(page) {
  return page.evaluate(() => {
    const text = document.body.innerText
    return {
      has500: text.includes('500'),
      has600: text.includes('600'),
      has700: text.includes('700'),
      has800: text.includes('800'),
      has1100: /1[,.]?100/.test(text),
      has1350: /1[,.]?350/.test(text),
      has1700: /1[,.]?700/.test(text),
      has1500: /1[,.]?500/.test(text),
      has1800: /1[,.]?800/.test(text),
      has2200: /2[,.]?200/.test(text),
      has2600: /2[,.]?600/.test(text),
      hasExperimental: text.includes('التجريبية') || text.includes('تجريبية'),
      hasTodo: /TODO|placeholder|lorem/i.test(text),
      bodySnippetPricing: text.includes('التورت الأساسية'),
    }
  })
}

async function main() {
  mkdirSync('qa-output', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Homepage + breakpoints
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const metrics = await measureOverflow(page)
    if (metrics.dir !== 'rtl') note('high', `Homepage not RTL at ${width}px`)
    if (metrics.lang !== 'ar') note('high', `Homepage lang not ar at ${width}px`)
    if (metrics.overflow) note('high', `Horizontal overflow on homepage at ${width}px (scroll=${metrics.scrollWidth})`)
    if (metrics.overflowing.length) note('medium', `Overflowing nodes homepage ${width}px: ${metrics.overflowing.join(' | ')}`)
    const tiny = await tinyButtons(page)
    if (tiny.length) note('medium', `Small targets homepage ${width}px: ${tiny.join(' ; ')}`)
    const stretched = await stretchedImages(page)
    if (stretched.length) note('medium', `Possibly stretched images homepage ${width}px: ${stretched.join(', ')}`)
    await page.screenshot({ path: join('qa-output', `home-${width}.png`), fullPage: false })
  }

  // Catalog + pricing pricing check at 390
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/#/catalog`, { waitUntil: 'networkidle' })
  let metrics = await measureOverflow(page)
  if (metrics.overflow) note('high', `Catalog horizontal overflow at 390`)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  // mobile: open menu first
  const menuBtn = page.getByRole('button', { name: /القائمة/ })
  if (await menuBtn.isVisible()) await menuBtn.click()
  await page.getByRole('link', { name: 'الأسعار' }).click()
  await page.waitForTimeout(700)
  const prices = await dumpPrices(page)
  for (const [key, ok] of Object.entries(prices)) {
    if (key.startsWith('has') && key !== 'hasExperimental' && key !== 'hasTodo' && !ok) {
      note('high', `Missing expected pricing signal: ${key}`)
    }
  }
  if (prices.hasTodo) note('high', 'TODO/placeholder/lorem visible on homepage')

  // Order flow
  await page.goto(`${BASE}/#/order`, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })

  // empty next
  await page.getByRole('button', { name: 'التالي' }).click()
  const emptyErrors = await page.locator('[role="alert"]').allTextContents()
  if (!emptyErrors.some((t) => t.includes('التوصيل') || t.includes('الاستلام'))) {
    note('medium', `Empty form did not show serviceType error: ${emptyErrors.join(' | ')}`)
  }

  await page.getByText('توصيل', { exact: true }).click()
  await page.locator('#area').selectOption('cairo')
  await page.locator('#servings').fill('20')

  // invalid date (< 3 days)
  const today = new Date()
  const tooSoon = iso(addDays(today, 1))
  // Far enough out to avoid collisions with prior live integration bookings.
  const valid = iso(addDays(today, 28))
  await page.locator('#date').fill(tooSoon)
  await page.waitForTimeout(200)
  const soonMsg = await page.locator('#date-error, [role="alert"]').allTextContents()
  if (!soonMsg.some((t) => t.includes('3 أيام'))) {
    note('high', `3-day rule message missing for ${tooSoon}: ${soonMsg.join(' | ')}`)
  }
  const timeDisabled = await page.locator('#time').isDisabled()
  if (!timeDisabled) note('high', 'Time select should be disabled for invalid date')

  // Pick a clear slot on the far date (try several times if a prior run booked one).
  const candidateTimes = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
  let chosenTime = null
  await page.locator('#date').fill(valid)
  await page.waitForTimeout(200)
  if (await page.locator('#time').isDisabled()) note('high', 'Time still disabled after valid date')

  for (const time of candidateTimes) {
    await page.locator('#time').selectOption(time)
    await page.waitForTimeout(700)
    const availText = await page.locator('[role="status"]').textContent().catch(() => '')
    if ((availText || '').includes('التجريبية') || (availText || '').includes('تجريبية')) {
      note('high', `Customer-facing availability message mentions experimental data: ${availText}`)
      break
    }
    if ((availText || '').includes('متعارض')) continue
    if ((availText || '').includes('تعذّر') || (availText || '').includes('تعذر')) continue
    chosenTime = time
    break
  }
  if (!chosenTime) {
    note('high', `Could not find a clear slot on ${valid}`)
  } else {
    // Sanity: far-future slot should not be an unexpected conflict once selected.
    const clearText = await page.locator('[role="status"]').textContent().catch(() => '')
    if ((clearText || '').includes('متعارض')) {
      note('high', `Selected slot still shows conflict: ${clearText}`)
    }
  }

  // continue happy path with clear slot
  if (chosenTime) {
    await page.locator('#time').selectOption(chosenTime)
    await page.waitForTimeout(500)
  }
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.waitForTimeout(400)

  // step 2 cake
  if (!(await page.getByRole('heading', { name: 'تفاصيل التورتة' }).count())) {
    note('high', 'Did not reach cake details step')
  }

  // custom design path briefly
  await page.getByText('تصميم مخصص', { exact: true }).click()
  await page.locator('#design-notes').fill('تورتة وردية مع فراشات ذهبية واسم سارة')
  await page.getByText('طبقة واحدة', { exact: true }).click()
  await page.getByRole('button', { name: /24 سم/ }).click()

  // sugar figures yes / edible yes
  await page.locator('fieldset').filter({ hasText: 'مجسمات عجينة سكر' }).getByRole('radio', { name: 'نعم' }).check()
  await page.locator('fieldset').filter({ hasText: 'صور قابلة للأكل' }).getByRole('radio', { name: 'نعم' }).check()

  const estimate = await page.locator('text=التقدير الحالي').textContent()
  if (!(estimate || '').includes('1,100') && !(estimate || '').includes('1100')) {
    note('high', `Expected 1100 estimate after 24cm, got: ${estimate}`)
  }
  if (!(estimate || '').includes('تُحدَّد لاحقًا') && !(estimate || '').includes('تحدد')) {
    note('medium', `Pending charges note missing with extras selected: ${estimate}`)
  }

  // back/forward state
  await page.getByRole('button', { name: 'السابق' }).click()
  await page.waitForTimeout(200)
  const servingsKept = await page.locator('#servings').inputValue()
  if (servingsKept !== '20') note('high', `Servings lost after back: ${servingsKept}`)
  const areaKept = await page.locator('#area').inputValue()
  if (areaKept !== 'cairo') note('high', `Area lost after back: ${areaKept}`)
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.waitForTimeout(200)

  // ensure custom notes kept
  const notesKept = await page.locator('#design-notes').inputValue()
  if (!notesKept.includes('سارة')) note('high', `Design notes lost after back/next: ${notesKept}`)

  // also verify catalog mode selection still works
  await page.getByText('تصميم من الموقع', { exact: true }).click()
  await page.getByRole('button', { name: 'تورتة الفراشات', exact: true }).click()
  await page.getByRole('button', { name: /24 سم/ }).click()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.waitForTimeout(200)

  // fillings
  await page.getByText('نوتيلا', { exact: true }).click()
  const estimate2 = await page.locator('text=التقدير الحالي').textContent()
  if (!(estimate2 || '').includes('1,100') && !(estimate2 || '').includes('1100')) {
    note('high', `Nutella should not inflate known total yet: ${estimate2}`)
  }
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.waitForTimeout(200)

  // summary
  const summaryText = await page.locator('article').filter({ hasText: 'ملخص الطلب' }).innerText()
  if (!summaryText.includes('تورتة الفراشات')) note('high', 'Summary missing cake name')
  if (!summaryText.includes('24 سم')) note('high', 'Summary missing size')
  if (!summaryText.includes('نوتيلا')) note('high', 'Summary missing filling')
  if (!summaryText.includes('القاهرة')) note('high', 'Summary missing area')
  if (!/\b20\b/.test(summaryText)) note('high', 'Summary missing servings')
  if (!summaryText.includes('فرد') && !summaryText.match(/20\s*فرد/)) {
    note('medium', 'Summary servings label lacks "فرد"')
  }
  if (!summaryText.includes('مجسمات') && !summaryText.includes('صور')) {
    note('medium', 'Summary missing selected extras')
  }

  await page.locator('#name').fill('مريم أحمد')
  await page.locator('#phone').fill('01012345678')

  // refresh persistence
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const stepHeading = await page.locator('form h2').textContent().catch(() => '')
  if (!(stepHeading || '').includes('الملخص')) {
    note('high', `Refresh should restore summary step, got: ${stepHeading}`)
  }
  const servingsLabel = await page.locator('article').filter({ hasText: 'ملخص الطلب' }).innerText().catch(() => '')
  if (servingsLabel && !servingsLabel.includes('20 فرد')) {
    note('medium', `Summary servings should include فرد: ${servingsLabel.slice(0, 200)}`)
  }

  const draftBundle = await page.evaluate(() => JSON.parse(sessionStorage.getItem('misteka.draft.v1') || '{}'))
  const draft = draftBundle.draft || draftBundle
  if (draft.cakeId !== 'butterflies') note('medium', `Unexpected draft cake after refresh: ${draft.cakeId}`)
  if (!draft.extraIds || draft.extraIds.length < 2) note('medium', `Extras not persisted: ${JSON.stringify(draft.extraIds)}`)
  if (draftBundle.step !== 3 && draftBundle.step !== undefined) {
    note('medium', `Expected saved step 3, got ${draftBundle.step}`)
  }

  if (await page.locator('#name').count()) {
    await page.locator('#name').fill('مريم أحمد')
    await page.locator('#phone').fill('01012345678')
  }
  await page.getByRole('button', { name: 'إرسال للمراجعة' }).click()
  await page.waitForTimeout(500)
  const doneText = await page.locator('main').innerText()
  if (!doneText.includes('طلبك قيد المراجعة') && !doneText.includes('رقم الطلب')) {
    note('high', `Order confirmation failed. Text: ${doneText.slice(0, 300)}`)
  }
  if (doneText.includes('مؤكد') && !doneText.includes('ليس مؤكد') && !doneText.includes('لا يُعد مؤكد')) {
    note('high', `Success copy may claim confirmation: ${doneText.slice(0, 300)}`)
  }
  if (doneText.includes('التجريبية')) note('high', 'Confirmation still mentions experimental wording')

  // duplicate slot conflict (after a successful submit, same date/time must conflict)
  const usedDate = valid
  const usedTime = chosenTime || '14:00'
  await page.getByRole('button', { name: 'طلب جديد' }).click()
  await page.waitForTimeout(200)
  await page.getByText('توصيل', { exact: true }).click()
  await page.locator('#area').selectOption('cairo')
  await page.locator('#servings').fill('20')
  await page.locator('#date').fill(usedDate)
  await page.locator('#time').selectOption(usedTime)
  await page.waitForTimeout(800)
  const dupStatus = await page.locator('[role="status"]').textContent().catch(() => '')
  if (!(dupStatus || '').includes('متعارض')) {
    note('high', `Expected conflict after saving same slot: ${dupStatus}`)
  }

  // giza path smoke
  await page.locator('#area').selectOption('giza')
  const giza = await page.locator('#area').inputValue()
  if (giza !== 'giza') note('high', 'Giza selection failed')

  // desktop order layout
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/#/order`, { waitUntil: 'networkidle' })
  metrics = await measureOverflow(page)
  if (metrics.overflow) note('high', 'Order page overflow at 1440')
  await page.screenshot({ path: join('qa-output', 'order-1440.png') })

  // tablet catalog
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto(`${BASE}/#/catalog`, { waitUntil: 'networkidle' })
  metrics = await measureOverflow(page)
  if (metrics.overflow) note('high', 'Catalog overflow at 768')
  await page.screenshot({ path: join('qa-output', 'catalog-768.png') })

  writeFileSync('qa-output/issues.json', JSON.stringify(issues, null, 2))
  console.log('\n=== QA SUMMARY ===')
  console.log(`Issues: ${issues.length}`)
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
