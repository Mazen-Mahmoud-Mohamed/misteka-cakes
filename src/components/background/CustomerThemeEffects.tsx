import type { ComponentType } from 'react'
import { PixelSnowBackground } from '@/components/background/PixelSnowBackground'
import { useTheme } from '@/providers/ThemeProvider'
import type { ThemeId } from '@/types/theme'

type ThemeEffectEntry = {
  id: ThemeId
  Component: ComponentType
}

/**
 * Registry of customer-facing decorative effects.
 * Ramadan is intentionally absent until its visual layer is implemented.
 */
const THEME_EFFECT_REGISTRY: ThemeEffectEntry[] = [
  { id: 'pixel_snow', Component: PixelSnowBackground },
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
