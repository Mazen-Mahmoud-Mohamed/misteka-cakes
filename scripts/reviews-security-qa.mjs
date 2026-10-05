/**
 * Security QA for site reviews (anon key only — never service_role).
 * Loads credentials from .env.local. Never prints secrets.
 *
 * Usage: node scripts/reviews-security-qa.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function looksLikeServiceRole(key) {
  try {
    const payload = key.split('.')[1]
    if (!payload) return false
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return json.role === 'service_role'
  } catch {
    return false
  }
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

async function main() {
  const env = loadEnv('.env.local')
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  assert(url && key, 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  assert(!looksLikeServiceRole(key), 'Refusing service_role key')

  const sb = createClient(url, key)
  console.log('Host:', new URL(url).host)

  // 1) Public table readable; private columns / review_id blocked; base table blocked
  {
    const view = await sb.from('site_reviews_public').select('display_name, review_text, image_path, source, published_at, sort_order, featured')
    if (view.error) fail('public_view_select', view.error.message)
    else pass('public_view_select', `${(view.data ?? []).length} rows`)

    const forbiddenCols = await sb.from('site_reviews_public').select('order_id, admin_note, moderated_by')
    if (!forbiddenCols.error) fail('public_view_no_private_cols', 'Private columns unexpectedly selectable')
    else pass('public_view_no_private_cols', forbiddenCols.error.message.slice(0, 80))

    // Opaque review_id is granted by site-review-media.sql for joining public media.
    // Until that migration is applied, selecting review_id alone is denied (column grant).
    const idCol = await sb.from('site_reviews_public').select('review_id')
    if (idCol.error) {
      if (/permission denied|column/i.test(idCol.error.message)) {
        pass('public_review_id_join_key_pending_migration', idCol.error.message.slice(0, 100))
      } else {
        fail('public_review_id_join_key', idCol.error.message)
      }
    } else {
      pass('public_review_id_join_key', `${(idCol.data ?? []).length} rows`)
    }

    const spoofPublic = await sb.from('site_reviews_public').insert({
      display_name: 'x',
      review_text: 'should fail',
      source: 'whatsapp',
      sort_order: 0,
      featured: false,
    })
    if (!spoofPublic.error) fail('anon_public_table_insert_blocked', 'Insert into public table succeeded')
    else pass('anon_public_table_insert_blocked', spoofPublic.error.message.slice(0, 80))

    const base = await sb.from('site_reviews').select('*')
    if (!base.error && (base.data?.length ?? 0) >= 0 && base.data != null) {
      const msg = base.error?.message ?? `rows=${base.data.length}`
      if (base.error || base.data.length === 0) {
        pass('base_table_anon_blocked_or_empty', msg)
      } else {
        const sample = base.data[0]
        const leak = ['order_id', 'order_number', 'admin_note', 'moderated_by'].filter((k) => k in sample)
        if (leak.length) fail('base_table_column_leak', leak.join(','))
        else pass('base_table_published_only_no_private_keys', `rows=${base.data.length}`)
      }
    } else {
      pass('base_table_anon_denied', base.error?.message?.slice(0, 100) ?? 'empty')
    }
  }

  // 1b) Public media: anon can read safe columns only; cannot mutate; private media blocked
  {
    const mediaPublic = await sb
      .from('site_review_media_public')
      .select('review_id, image_path, sort_order')
    if (mediaPublic.error) {
      if (/Could not find the table|schema cache/i.test(mediaPublic.error.message)) {
        pass('media_public_select_pending_migration', mediaPublic.error.message.slice(0, 100))
      } else {
        fail('media_public_select', mediaPublic.error.message)
      }
    } else {
      pass('media_public_select', `${(mediaPublic.data ?? []).length} rows`)
    }

    const mediaIdLeak = await sb.from('site_review_media_public').select('media_id')
    if (mediaIdLeak.error) {
      if (/Could not find the table|schema cache|permission|column/i.test(mediaIdLeak.error.message)) {
        pass('media_public_no_media_id', mediaIdLeak.error.message.slice(0, 80))
      } else {
        fail('media_public_no_media_id', mediaIdLeak.error.message)
      }
    } else {
      fail('media_public_no_media_id', 'media_id unexpectedly selectable')
    }

    const mediaInsert = await sb.from('site_review_media_public').insert({
      media_id: '00000000-0000-4000-8000-000000000001',
      review_id: '00000000-0000-4000-8000-000000000002',
      image_path: 'x.jpg',
      sort_order: 0,
    })
    if (!mediaInsert.error) fail('anon_media_public_insert_blocked', 'Insert succeeded')
    else pass('anon_media_public_insert_blocked', mediaInsert.error.message.slice(0, 80))

    const mediaUpdate = await sb
      .from('site_review_media_public')
      .update({ sort_order: 99 })
      .eq('image_path', 'never-matches-hopefully')
    if (!mediaUpdate.error) fail('anon_media_public_update_blocked', 'Update succeeded')
    else pass('anon_media_public_update_blocked', mediaUpdate.error.message.slice(0, 80))

    const mediaDelete = await sb
      .from('site_review_media_public')
      .delete()
      .eq('image_path', 'never-matches-hopefully')
    if (!mediaDelete.error) fail('anon_media_public_delete_blocked', 'Delete succeeded')
    else pass('anon_media_public_delete_blocked', mediaDelete.error.message.slice(0, 80))

    const privateMedia = await sb.from('site_review_media').select('id, review_id, image_path, sort_order')
    if (!privateMedia.error && (privateMedia.data?.length ?? 0) > 0) {
      fail('private_media_anon_blocked', `rows=${privateMedia.data.length}`)
    } else {
      pass(
        'private_media_anon_blocked',
        privateMedia.error?.message?.slice(0, 100) ?? `empty=${privateMedia.data?.length ?? 0}`,
      )
    }

    const privateInsert = await sb.from('site_review_media').insert({
      review_id: '00000000-0000-4000-8000-000000000099',
      image_path: 'evil.jpg',
      sort_order: 0,
    })
    if (!privateInsert.error) fail('anon_private_media_insert_blocked', 'Insert succeeded')
    else pass('anon_private_media_insert_blocked', privateInsert.error.message.slice(0, 80))
  }

  // 2) Customer RPC rejects bad inputs / non-delivered
  {
    const badPhone = await sb.rpc('submit_customer_review', {
      p_phone: '01000000000',
      p_order_number: 'MK-DEADBEEF',
      p_display_name: 'اختبار',
      p_review_text: 'هذا نص رأي للاختبار فقط',
    })
    if (badPhone.error) fail('rpc_wrong_credentials_network', badPhone.error.message)
    else if (badPhone.data?.ok === true) fail('rpc_wrong_credentials', 'Unexpected success')
    else pass('rpc_wrong_credentials', badPhone.data?.code ?? 'rejected')
  }

  // 3) Cannot force published / whatsapp via RPC (RPC hardcodes source+status)
  {
    // Direct insert must fail for anon
    const insert = await sb.from('site_reviews').insert({
      source: 'whatsapp',
      display_name: 'attacker',
      review_text: 'should not work',
      status: 'published',
    })
    if (!insert.error) fail('anon_direct_insert_blocked', 'Insert succeeded')
    else pass('anon_direct_insert_blocked', insert.error.message.slice(0, 80))
  }

  // 4) Pending private media not publicly readable
  {
    const fakePath = `${'00000000-0000-4000-8000-000000000001'}/photo.jpg`
    const pub = await fetch(`${url}/storage/v1/object/public/review-uploads/${fakePath}`)
    if (pub.status === 200) fail('pending_bucket_not_public', `status ${pub.status}`)
    else pass('pending_bucket_not_public', `status ${pub.status}`)

    const list = await sb.storage.from('review-uploads').list('', { limit: 1 })
    if (!list.error && list.data && list.data.length > 0) fail('anon_list_review_uploads', 'Listed objects')
    else pass('anon_list_review_uploads_denied', list.error?.message?.slice(0, 80) ?? 'empty')
  }

  // 5) Attach to foreign review rejected
  {
    const attach = await sb.rpc('attach_customer_review_image', {
      p_phone: '01000000000',
      p_order_number: 'MK-DEADBEEF',
      p_review_id: '00000000-0000-4000-8000-000000000099',
      p_image_path: '00000000-0000-4000-8000-000000000099/photo.jpg',
    })
    if (attach.error) fail('attach_foreign_network', attach.error.message)
    else if (attach.data?.ok === true) fail('attach_foreign_blocked', 'Unexpected success')
    else pass('attach_foreign_blocked', attach.data?.code ?? 'rejected')
  }

  // 6) Invalid image upload path rejected by storage policy
  {
    const tiny = Buffer.from([0xff, 0xd8, 0xff, 0xd9]) // minimal jpeg bytes
    const bad = await sb.storage.from('review-uploads').upload(`evil/path-${randomBytes(4).toString('hex')}.jpg`, tiny, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (!bad.error) fail('storage_path_policy', 'Bad path upload succeeded')
    else pass('storage_path_policy', bad.error.message.slice(0, 80))
  }

  mkdirSync('qa-output', { recursive: true })
  const out = join('qa-output', 'reviews-security-qa.json')
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
  console.log('\nWrote', out)
  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error(`\n${failed.length} failed`)
    process.exit(1)
  }
  console.log(`\nAll ${results.length} checks passed`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
