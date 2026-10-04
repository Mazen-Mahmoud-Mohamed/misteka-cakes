import { getSupabase } from '@/lib/supabase'
import {
  DEFAULT_THEME_STATE,
  isThemeId,
  type RamadanConfig,
  type SiteThemeRow,
  type ThemeId,
} from '@/types/theme'

function fail<T>(message: string): { data: T | null; error: string } {
  return { data: null, error: message }
}

async function requireClient() {
  const supabase = getSupabase()
  if (!supabase) return { supabase: null, error: 'إعدادات الاتصال غير مكتملة.' as const }
  return { supabase, error: null as null }
}

function parseAdminRow(row: {
  id: string
  enabled: boolean
  config: unknown
  updated_at?: string
}): SiteThemeRow | null {
  if (!isThemeId(row.id)) return null
  if (row.id === 'pixel_snow') {
    return {
      id: 'pixel_snow',
      enabled: Boolean(row.enabled),
      config: {},
      updated_at: row.updated_at,
    }
  }
  const defaults = DEFAULT_THEME_STATE.ramadan.config
  const raw = row.config && typeof row.config === 'object' && !Array.isArray(row.config)
    ? (row.config as Record<string, unknown>)
    : {}
  const config: RamadanConfig = {
    lanterns: typeof raw.lanterns === 'boolean' ? raw.lanterns : defaults.lanterns,
    crescent: typeof raw.crescent === 'boolean' ? raw.crescent : defaults.crescent,
    decorations: typeof raw.decorations === 'boolean' ? raw.decorations : defaults.decorations,
    intensity:
      raw.intensity === 'low' || raw.intensity === 'medium' || raw.intensity === 'high'
        ? raw.intensity
        : defaults.intensity,
  }
  return {
    id: 'ramadan',
    enabled: Boolean(row.enabled),
    config,
    updated_at: row.updated_at,
  }
}

export async function listAdminThemes() {
  const { supabase, error } = await requireClient()
  if (!supabase) return fail<SiteThemeRow[]>(error!)

  const { data, error: qErr } = await supabase
    .from('site_themes')
    .select('id, enabled, config, updated_at')
    .order('id')

  if (qErr) return fail<SiteThemeRow[]>('تعذّر تحميل إعدادات المظهر.')

  const rows = (data ?? [])
    .map((row) => parseAdminRow(row as { id: string; enabled: boolean; config: unknown; updated_at?: string }))
    .filter((row): row is SiteThemeRow => row !== null)

  return { data: rows, error: null }
}

/** Toggle enabled only — preserves existing config JSON. */
export async function setThemeEnabled(id: ThemeId, enabled: boolean) {
  if (!isThemeId(id)) {
    return { ok: false as const, message: 'معرّف المظهر غير صالح.' }
  }

  const { supabase, error } = await requireClient()
  if (!supabase) return { ok: false as const, message: error! }

  const { data, error: qErr } = await supabase
    .from('site_themes')
    .update({ enabled })
    .eq('id', id)
    .select('id, enabled, config, updated_at')
    .maybeSingle()

  if (qErr || !data) {
    return { ok: false as const, message: 'تعذّر حفظ إعداد المظهر.' }
  }

  const parsed = parseAdminRow(data as { id: string; enabled: boolean; config: unknown; updated_at?: string })
  if (!parsed) {
    return { ok: false as const, message: 'تعذّر حفظ إعداد المظهر.' }
  }

  return { ok: true as const, message: 'تم حفظ إعداد المظهر.', row: parsed }
}
