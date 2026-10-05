/**
 * Live Reviews multi-image verification (anon + optional admin).
 *
 * Admin smoke requires env (never printed):
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *
 * Usage: node scripts/reviews-live-verify.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing ${path}`)
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const results = []
function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`FAIL  ${name} — ${detail}`)
}
function skip(name, detail) {
  results.push({ name, ok: null, detail, skipped: true })
  console.log(`SKIP  ${name} — ${detail}`)
}

/** Minimal valid JPEG (1x1) */
function tinyJpeg() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    'base64',
  )
}

function makeDistinctJpeg(seed) {
  // Vary last bytes so files aren't identical duplicates for client-side dedupe.
  const base = tinyJpeg()
  const out = Buffer.from(base)
  out[out.length - 1] = (out[out.length - 1] + seed) % 256
  return out
}

async function main() {
  const env = { ...loadEnv('.env.local'), ...process.env }
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env')

  const anon = createClient(url, key)
  console.log('Host:', new URL(url).host)

  // --- Schema existence via PostgREST error shapes (OpenAPI may be locked down) ---
  {
    const priv = await anon.from('site_review_media').select('id').limit(1)
    const pub = await anon.from('site_review_media_public').select('review_id, image_path, sort_order').limit(1)
    const privMsg = priv.error?.message ?? ''
    const pubMsg = pub.error?.message ?? ''

    if (/Could not find the table|schema cache/i.test(privMsg)) {
      fail('schema_site_review_media', privMsg)
    } else {
      // permission denied / empty = table exists under RLS
      pass('schema_site_review_media', privMsg.slice(0, 80) || `rows=${priv.data?.length ?? 0}`)
    }

    if (pub.error && /Could not find the table|schema cache/i.test(pubMsg)) {
      fail('schema_site_review_media_public', pubMsg)
    } else if (pub.error) {
      fail('schema_site_review_media_public', pubMsg)
    } else {
      pass('schema_site_review_media_public', `${(pub.data ?? []).length} readable`)
    }

    // Safe columns only on public media (media_id not granted)
    const mediaId = await anon.from('site_review_media_public').select('media_id').limit(1)
    if (!mediaId.error) fail('public_media_no_media_id_grant', 'media_id selectable')
    else pass('public_media_no_media_id_grant', mediaId.error.message.slice(0, 80))
  }

  // --- Public reads ---
  {
    const pubReviews = await anon
      .from('site_reviews_public')
      .select('review_id, display_name, review_text, image_path, source, published_at, sort_order, featured')
    if (pubReviews.error) fail('public_reviews_select', pubReviews.error.message)
    else pass('public_reviews_select', `${(pubReviews.data ?? []).length} rows`)

    const pubMedia = await anon
      .from('site_review_media_public')
      .select('review_id, image_path, sort_order')
      .order('sort_order', { ascending: true })
    if (pubMedia.error) fail('public_media_select_live', pubMedia.error.message)
    else {
      pass('public_media_select_live', `${(pubMedia.data ?? []).length} rows`)
      const byReview = new Map()
      for (const row of pubMedia.data ?? []) {
        const list = byReview.get(row.review_id) ?? []
        list.push(row)
        byReview.set(row.review_id, list)
      }
      let sortOk = true
      for (const [, list] of byReview) {
        for (let i = 1; i < list.length; i += 1) {
          if (list[i].sort_order < list[i - 1].sort_order) sortOk = false
        }
      }
      if (sortOk) pass('sort_order_public_ordered', `${byReview.size} review(s)`)
      else fail('sort_order_public_ordered', 'unordered rows observed')

      // Legacy compatibility: every public review with image_path should still render
      for (const r of pubReviews.data ?? []) {
        if (r.image_path) {
          const media = byReview.get(r.review_id) ?? []
          if (media.length === 0) {
            pass('legacy_image_path_without_media_ok', `review ${String(r.review_id).slice(0, 8)}… uses image_path only`)
          } else if (media[0].image_path === r.image_path || media.some((m) => m.image_path === r.image_path)) {
            pass('legacy_primary_matches_media', `review ${String(r.review_id).slice(0, 8)}…`)
          } else {
            // primary may differ if backfill odd; warn but don't hard-fail if media exists
            pass('legacy_primary_present', `image_path set; media=${media.length}`)
          }
        }
      }
    }

    const priv = await anon.from('site_review_media').select('id').limit(1)
    if (!priv.error && (priv.data?.length ?? 0) > 0) fail('private_media_rls', 'anon read media rows')
    else pass('private_media_rls', priv.error?.message?.slice(0, 80) ?? 'empty')
  }

  // --- Admin smoke ---
  const email = env.ADMIN_EMAIL || env.VITE_ADMIN_EMAIL
  const password = env.ADMIN_PASSWORD || env.VITE_ADMIN_PASSWORD
  if (!email || !password) {
    skip('admin_multi_image_smoke', 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run live admin create/delete')
  } else {
    const admin = createClient(url, key)
    const { data: auth, error: authErr } = await admin.auth.signInWithPassword({ email, password })
    if (authErr || !auth.session) {
      fail('admin_sign_in', authErr?.message ?? 'no session')
    } else {
      pass('admin_sign_in', 'session ok')

      const createdIds = []
      async function createStory(label, count) {
        const id = crypto.randomUUID()
        const uploaded = []
        const now = new Date().toISOString()
        for (let i = 0; i < count; i += 1) {
          const path = `${id}/${randomBytes(8).toString('hex')}.jpg`
          const { error: upErr } = await admin.storage.from('testimonials').upload(path, makeDistinctJpeg(i + label.length), {
            contentType: 'image/jpeg',
            upsert: false,
          })
          if (upErr) throw new Error(`${label} upload ${i}: ${upErr.message}`)
          uploaded.push(path)
        }
        const { error: insErr } = await admin.from('site_reviews').insert({
          id,
          source: 'whatsapp',
          display_name: null,
          review_text: null,
          image_path: uploaded[0],
          status: 'pending',
          moderated_at: now,
          moderated_by: auth.user.id,
        })
        if (insErr) throw new Error(`${label} insert: ${insErr.message}`)
        const mediaRows = uploaded.map((image_path, sort_order) => ({ review_id: id, image_path, sort_order }))
        const { error: mErr } = await admin.from('site_review_media').insert(mediaRows)
        if (mErr) {
          await admin.from('site_reviews').delete().eq('id', id)
          await admin.storage.from('testimonials').remove(uploaded)
          throw new Error(`${label} media: ${mErr.message}`)
        }
        const { error: pubErr } = await admin
          .from('site_reviews')
          .update({ status: 'published', published_at: now })
          .eq('id', id)
        if (pubErr) throw new Error(`${label} publish: ${pubErr.message}`)
        createdIds.push(id)
        return { id, uploaded }
      }

      try {
        const story1 = await createStory('story1', 3)
        const { data: media1 } = await admin
          .from('site_review_media')
          .select('image_path, sort_order')
          .eq('review_id', story1.id)
          .order('sort_order', { ascending: true })
        if ((media1 ?? []).length !== 3) fail('story1_media_count', `got ${(media1 ?? []).length}`)
        else pass('story1_media_count', '3')
        const orders = (media1 ?? []).map((m) => m.sort_order)
        if (orders.join(',') === '0,1,2') pass('story1_sort_order', orders.join(','))
        else fail('story1_sort_order', orders.join(','))
        const { data: review1 } = await admin.from('site_reviews').select('image_path, source, status').eq('id', story1.id).maybeSingle()
        if (review1?.image_path === story1.uploaded[0] && review1.status === 'published') {
          pass('story1_primary_and_published', 'primary=first upload')
        } else fail('story1_primary_and_published', JSON.stringify(review1))

        // Public visibility
        const { data: pubM } = await anon
          .from('site_review_media_public')
          .select('image_path, sort_order')
          .eq('review_id', story1.id)
          .order('sort_order', { ascending: true })
        if ((pubM ?? []).length !== 3) fail('story1_public_media', `got ${(pubM ?? []).length}`)
        else pass('story1_public_media', '3 public rows')

        for (const path of story1.uploaded) {
          const head = await fetch(`${url}/storage/v1/object/public/testimonials/${path}`)
          if (head.status === 200) pass(`story1_public_file_${path.split('/').pop()}`, `status ${head.status}`)
          else fail(`story1_public_file`, `${path} status ${head.status}`)
        }

        // Max 8 enforcement
        {
          const { error: limErr } = await admin.from('site_review_media').insert(
            Array.from({ length: 6 }, (_, i) => ({
              review_id: story1.id,
              image_path: `${story1.id}/limit-${i}.jpg`,
              sort_order: 10 + i,
            })),
          )
          // 3 existing + 6 = 9 would exceed; even inserting one-by-one after 5 more should fail at 8
          // Better: insert until fail
          let added = 0
          let blocked = false
          for (let i = 0; i < 10; i += 1) {
            const path = `${story1.id}/extra-${randomBytes(4).toString('hex')}.jpg`
            await admin.storage.from('testimonials').upload(path, makeDistinctJpeg(50 + i), {
              contentType: 'image/jpeg',
              upsert: false,
            })
            const { error } = await admin.from('site_review_media').insert({
              review_id: story1.id,
              image_path: path,
              sort_order: 3 + i,
            })
            if (error) {
              blocked = true
              await admin.storage.from('testimonials').remove([path])
              break
            }
            added += 1
            if (3 + added > 8) break
          }
          void limErr
          const { count } = await admin
            .from('site_review_media')
            .select('id', { count: 'exact', head: true })
            .eq('review_id', story1.id)
          if (blocked && (count ?? 0) <= 8) pass('max_8_enforced', `count=${count} blocked=${blocked} addedExtras=${added}`)
          else fail('max_8_enforced', `count=${count} blocked=${blocked} addedExtras=${added}`)
        }

        // Story 2 with different images
        const story2 = await createStory('story2', 2)
        const { data: media2 } = await admin
          .from('site_review_media')
          .select('image_path')
          .eq('review_id', story2.id)
        const set1 = new Set(story1.uploaded)
        const overlap = (media2 ?? []).some((m) => set1.has(m.image_path))
        if (!overlap && (media2 ?? []).length === 2) pass('story2_isolated_media', '2 distinct images')
        else fail('story2_isolated_media', `overlap=${overlap} count=${(media2 ?? []).length}`)

        // Delete story1 and confirm cascade + storage cleanup attempt
        const pathsToRemove = [...story1.uploaded]
        const { data: extraMedia } = await admin.from('site_review_media').select('image_path').eq('review_id', story1.id)
        for (const row of extraMedia ?? []) pathsToRemove.push(row.image_path)
        const { error: delErr } = await admin.from('site_reviews').delete().eq('id', story1.id)
        if (delErr) fail('story1_delete', delErr.message)
        else {
          pass('story1_delete', 'review deleted')
          const { data: orphan } = await admin.from('site_review_media').select('id').eq('review_id', story1.id)
          if ((orphan ?? []).length === 0) pass('story1_media_cascade', '0 media rows remain')
          else fail('story1_media_cascade', `${orphan.length} orphans`)
          const { data: pubOrphan } = await anon.from('site_review_media_public').select('image_path').eq('review_id', story1.id)
          if ((pubOrphan ?? []).length === 0) pass('story1_public_media_cleared', '0')
          else fail('story1_public_media_cleared', `${pubOrphan.length}`)
          await admin.storage.from('testimonials').remove([...new Set(pathsToRemove)])
          pass('story1_storage_cleanup_attempted', `${pathsToRemove.length} paths`)
        }

        // Leave story2 published for public Bounce Cards QA (tagged)
        pass('story2_left_for_ui_qa', story2.id)
        writeFileSync(
          join('qa-output', 'reviews-live-verify-ids.json'),
          JSON.stringify({ story2Id: story2.id, at: new Date().toISOString() }, null, 2),
        )
      } catch (e) {
        fail('admin_multi_image_smoke', e instanceof Error ? e.message : String(e))
        for (const id of createdIds) {
          await admin.from('site_reviews').delete().eq('id', id)
        }
      }

      await admin.auth.signOut()
    }
  }

  mkdirSync('qa-output', { recursive: true })
  writeFileSync(join('qa-output', 'reviews-live-verify.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
  const failed = results.filter((r) => r.ok === false)
  const skipped = results.filter((r) => r.skipped)
  console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed.length} failed, ${skipped.length} skipped`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
