import { useEffect, useState, type ReactNode } from 'react'
import { loadCatalog } from '@/services/catalogRepository'

/**
 * Hydrates catalog data from Supabase when configured.
 * Local MVP data is available immediately; remote data replaces it when complete.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    let active = true
    void loadCatalog().then(() => {
      if (!active) return
      setTick((value) => value + 1)
    })
    return () => {
      active = false
    }
  }, [])

  return children
}
