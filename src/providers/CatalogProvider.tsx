import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadCatalog } from '@/services/catalogRepository'
import { getCatalogSource } from '@/services/catalogStore'
import type { DataSource } from '@/types'

export type CatalogStatus = 'loading' | 'ready' | 'error'

interface CatalogContextValue {
  status: CatalogStatus
  source: DataSource
  configured: boolean
  error: string | null
  /** Increments after every store update so consumers re-read. */
  version: number
  reload: () => Promise<void>
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

/**
 * Hydrates catalog data from Supabase when configured.
 * Always bumps `version` after loadCatalog finishes so the UI re-reads the store
 * (including under React StrictMode).
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CatalogStatus>('loading')
  const [source, setSource] = useState<DataSource>(getCatalogSource())
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const result = await loadCatalog()
      setConfigured(result.configured)
      setSource(result.source)

      if (result.configured && result.source !== 'supabase') {
        setError(result.error || 'تعذّر تحميل قائمة الأسعار من الخادم.')
        setStatus('error')
      } else {
        setError(null)
        setStatus('ready')
      }
    } catch (err) {
      console.warn('Catalog reload failed.', err)
      setConfigured(true)
      setSource(getCatalogSource())
      setError('تعذّر تحميل قائمة الأسعار من الخادم.')
      setStatus('error')
    } finally {
      setVersion((value) => value + 1)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo(
    () => ({ status, source, configured, error, version, reload }),
    [status, source, configured, error, version, reload],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext)
  if (!ctx) {
    throw new Error('useCatalog must be used within CatalogProvider')
  }
  return ctx
}
