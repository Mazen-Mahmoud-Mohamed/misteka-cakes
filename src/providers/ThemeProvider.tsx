import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchThemeState } from '@/services/themeService'
import { DEFAULT_THEME_STATE, type SiteThemeState } from '@/types/theme'

export type ThemeStatus = 'loading' | 'ready'

interface ThemeContextValue {
  status: ThemeStatus
  themes: SiteThemeState
  source: 'supabase' | 'defaults'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Customer-only theme hydration.
 * Initial state matches approved production appearance (Pixel Snow ON).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ThemeStatus>('loading')
  const [themes, setThemes] = useState<SiteThemeState>(DEFAULT_THEME_STATE)
  const [source, setSource] = useState<'supabase' | 'defaults'>('defaults')

  useEffect(() => {
    let active = true
    void fetchThemeState().then((result) => {
      if (!active) return
      setThemes(result.themes)
      setSource(result.source)
      setStatus('ready')
    })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({ status, themes, source }),
    [status, themes, source],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
