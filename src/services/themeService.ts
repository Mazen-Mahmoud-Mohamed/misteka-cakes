import { getSupabase } from '@/lib/supabase'
import {
  DEFAULT_THEME_STATE,
  isThemeId,
  type RamadanConfig,
  type RamadanIntensity,
  type SiteThemeState,
  type ThemeId,
} from '@/types/theme'

type RawThemeRow = {
  id: string
  enabled: boolean
  config: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseIntensity(value: unknown): RamadanIntensity {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return DEFAULT_THEME_STATE.ramadan.config.intensity
}

function parseRamadanConfig(config: unknown): RamadanConfig {
  const defaults = DEFAULT_THEME_STATE.ramadan.config
  if (!isRecord(config)) return { ...defaults }
  return {
    lanterns: typeof config.lanterns === 'boolean' ? config.lanterns : defaults.lanterns,
    crescent: typeof config.crescent === 'boolean' ? config.crescent : defaults.crescent,
    decorations: typeof config.decorations === 'boolean' ? config.decorations : defaults.decorations,
    intensity: parseIntensity(config.intensity),
  }
}

function parsePixelSnowConfig(config: unknown): Record<string, never> {
  void config
  return {}
}

function applyRow(state: SiteThemeState, row: RawThemeRow): void {
  if (!isThemeId(row.id)) return
  const id: ThemeId = row.id
  if (id === 'pixel_snow') {
    state.pixel_snow = {
      enabled: Boolean(row.enabled),
      config: parsePixelSnowConfig(row.config),
    }
    return
  }
  state.ramadan = {
    enabled: Boolean(row.enabled),
    config: parseRamadanConfig(row.config),
  }
}

function cloneDefaults(): SiteThemeState {
  return {
    pixel_snow: { enabled: true, config: {} },
    ramadan: {
      enabled: false,
      config: { ...DEFAULT_THEME_STATE.ramadan.config },
    },
  }
}

/**
 * Public read of site theme settings.
 * On any failure, returns approved production defaults (snow ON, Ramadan OFF).
 */
export async function fetchThemeState(): Promise<{
  themes: SiteThemeState
  source: 'supabase' | 'defaults'
  error: string | null
}> {
  const fallback = cloneDefaults()
  const supabase = getSupabase()
  if (!supabase) {
    return { themes: fallback, source: 'defaults', error: null }
  }

  try {
    const { data, error } = await supabase.from('site_themes').select('id, enabled, config')
    if (error || !data) {
      return { themes: fallback, source: 'defaults', error: 'تعذّر تحميل إعدادات المظهر.' }
    }

    const themes = cloneDefaults()
    for (const row of data as RawThemeRow[]) {
      applyRow(themes, row)
    }
    return { themes, source: 'supabase', error: null }
  } catch {
    return { themes: fallback, source: 'defaults', error: 'تعذّر تحميل إعدادات المظهر.' }
  }
}
