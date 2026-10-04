export const THEME_IDS = ['pixel_snow', 'ramadan'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export type RamadanIntensity = 'low' | 'medium' | 'high'

export type PixelSnowConfig = Record<string, never>

export interface RamadanConfig {
  lanterns: boolean
  crescent: boolean
  decorations: boolean
  intensity: RamadanIntensity
}

export type ThemeConfigById = {
  pixel_snow: PixelSnowConfig
  ramadan: RamadanConfig
}

export type SiteThemeState = {
  [K in ThemeId]: {
    enabled: boolean
    config: ThemeConfigById[K]
  }
}

export interface SiteThemeRow {
  id: ThemeId
  enabled: boolean
  config: ThemeConfigById[ThemeId]
  updated_at?: string
}

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value)
}

export const DEFAULT_THEME_STATE: SiteThemeState = {
  pixel_snow: { enabled: true, config: {} },
  ramadan: {
    enabled: false,
    config: {
      lanterns: true,
      crescent: true,
      decorations: true,
      intensity: 'medium',
    },
  },
}
