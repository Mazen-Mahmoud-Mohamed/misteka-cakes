import type { ComponentType } from 'react'
import { PixelSnowBackground } from '@/components/background/PixelSnowBackground'
import { RamadanThemeLayer } from '@/components/background/RamadanThemeLayer'
import { useTheme } from '@/providers/ThemeProvider'
import type { ThemeId } from '@/types/theme'

type ThemeEffectEntry = {
  id: ThemeId
  Component: ComponentType
}

/** Registry of customer-facing decorative effects. */
const THEME_EFFECT_REGISTRY: ThemeEffectEntry[] = [
  { id: 'pixel_snow', Component: PixelSnowBackground },
  { id: 'ramadan', Component: RamadanThemeLayer },
]

/** Mounts only registered, enabled theme effects. Customer routes only. */
export function CustomerThemeEffects() {
  const { themes } = useTheme()

  return (
    <>
      {THEME_EFFECT_REGISTRY.map(({ id, Component }) =>
        themes[id].enabled ? <Component key={id} /> : null,
      )}
    </>
  )
}
